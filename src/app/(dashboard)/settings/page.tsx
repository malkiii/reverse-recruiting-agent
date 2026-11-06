import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, Card, CardHeader, checkboxClass, inputClass, labelClass, PageHeader } from "@/components/ui";
import { cleanUpOldData, drizzleLlmSettingsStore, drizzleSendSettingsStore } from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { LLM_PROVIDER_NAMES, SUGGESTED_MODELS } from "@/lib/llm";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/schema";
import { isDarkTheme } from "@/lib/theme";
import { CleanUpButton } from "./clean-up-button";

function databaseUrl() {
  return parseDashboardEnv(process.env).DATABASE_URL;
}

async function saveLlm(formData: FormData) {
  "use server";

  const provider = String(formData.get("provider")) as LlmProvider;
  if (!LLM_PROVIDERS.includes(provider)) throw new Error(`Unknown LLM provider: ${provider}`);
  const model = String(formData.get("model")).trim();
  if (!model) throw new Error("Choose a model");
  await drizzleLlmSettingsStore(databaseUrl()).save({ provider, model });
  revalidatePath("/settings");
}

async function saveSending(formData: FormData) {
  "use server";

  await drizzleSendSettingsStore(databaseUrl()).saveSendingAllowed(formData.get("allowed") === "on");
  revalidatePath("/settings");
}

async function cleanUp() {
  "use server";

  return cleanUpOldData(databaseUrl());
}

export default async function SettingsPage() {
  await connection();
  const [llm, sendingAllowed, dark] = await Promise.all([
    drizzleLlmSettingsStore(databaseUrl()).get(),
    drizzleSendSettingsStore(databaseUrl()).sendingAllowed(),
    isDarkTheme(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        action={<ThemeToggle initialDark={dark} className="md:hidden" />}
      />

      <Card>
        <ul className="divide-y divide-line">
          <LinkRow href="/jobs" title="Job Collection" description="Schedule, Job Boards, Job Feeds and Excluded Keywords" />
          <LinkRow href="/google" title="Google" description="Gmail connection and Resume Folder" />
          <LinkRow href="/function-runs" title="Function runs" description="Recent runs and their errors" />
          <LinkRow
            href="/how-it-works"
            title="How it works"
            description="The steps, settings and Collection settings explained"
            className="md:hidden"
          />
        </ul>
      </Card>

      <Section
        title="LLM"
        description="Used to choose a Resume and write the Cover Letter. The provider's API key must be set for Functions."
      >
        {!llm && <Alert tone="warning">No LLM is chosen yet, so Prepare can&apos;t choose a Resume.</Alert>}
        <form action={saveLlm} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Provider</span>
              <select name="provider" defaultValue={llm?.provider ?? "claude"} required className={inputClass}>
                {LLM_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {LLM_PROVIDER_NAMES[provider]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Model</span>
              <input name="model" list="llm-models" defaultValue={llm?.model} required className={inputClass} />
            </label>
          </div>
          <datalist id="llm-models">
            {LLM_PROVIDERS.flatMap((provider) =>
              SUGGESTED_MODELS[provider].map((model) => (
                <option key={model} value={model}>
                  {LLM_PROVIDER_NAMES[provider]}
                </option>
              )),
            )}
          </datalist>
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section
        title="Sending"
        description="Lets Send email Decision Makers from your Gmail. While it's off, Send is refused. Compose's DISABLE_SEND keeps it off whatever this says."
      >
        <form action={saveSending} className="flex items-center justify-between gap-3">
          <label className="flex min-h-9 items-center gap-2.5 text-sm text-fg-2">
            <input type="checkbox" name="allowed" defaultChecked={sendingAllowed} className={checkboxClass} /> Allow
            sending
          </label>
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section
        title="Old Data"
        description="Deletes Jobs, Applications with their recipients, Function runs, actor runs and Decision Makers 6 months old or more. Keeps a Job whose Application is newer or still in progress, and Decision Makers in Cooldown."
      >
        <CleanUpButton cleanUp={cleanUp} />
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="space-y-4 px-4 py-4">
        {description && <p className="text-sm text-muted">{description}</p>}
        {children}
      </div>
    </Card>
  );
}

function LinkRow({
  href,
  title,
  description,
  className,
}: {
  href: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <li className={className}>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-subtle active:bg-subtle"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="truncate text-sm text-muted">{description}</p>
        </div>
        <span aria-hidden="true" className="text-faint">
          ›
        </span>
      </Link>
    </li>
  );
}
