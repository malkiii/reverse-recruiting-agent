import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card, CardHeader, checkboxClass, inputClass, labelClass, PageHeader } from "@/components/ui";
import { connection } from "next/server";
import {
  cleanUpOldData,
  drizzleExcludedKeywordStore,
  drizzleJobBoardSettingsStore,
  drizzleJobFeedStore,
  drizzleLlmSettingsStore,
  drizzleScheduleSettingsStore,
} from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { glassdoorJobBoard } from "@/lib/glassdoor-job-board";
import { linkedInJobBoard } from "@/lib/linkedin-job-board";
import { LLM_PROVIDER_NAMES, SUGGESTED_MODELS } from "@/lib/llm";
import { LLM_PROVIDERS, type JobSearch, type LlmProvider } from "@/lib/schema";
import { CleanUpButton } from "./clean-up-button";

const SEPARATOR = "|";

function databaseUrl() {
  return parseDashboardEnv(process.env).DATABASE_URL;
}

function parseSearch(line: string): JobSearch {
  const [keywords = "", location = ""] = line.split(SEPARATOR).map((part) => part.trim());
  return { keywords, location };
}

function feedUrl(formData: FormData) {
  const url = String(formData.get("url")).trim();
  if (!URL.canParse(url)) throw new Error(`Not a URL: ${url}`);
  return url;
}

async function saveSchedule(formData: FormData) {
  "use server";

  await drizzleScheduleSettingsStore(databaseUrl()).saveCollectionEnabled(formData.get("enabled") === "on");
  revalidatePath("/settings");
}

async function saveLinkedIn(formData: FormData) {
  "use server";

  const searches = String(formData.get("searches"))
    .split("\n")
    .filter((line) => line.trim())
    .map(parseSearch);

  await drizzleJobBoardSettingsStore(databaseUrl()).save({
    source: linkedInJobBoard.source,
    enabled: formData.get("enabled") === "on",
    searches,
  });
  revalidatePath("/settings");
}

async function saveGlassdoor(formData: FormData) {
  "use server";

  const keywords = String(formData.get("keywords")).trim();
  const location = String(formData.get("location")).trim();
  await drizzleJobBoardSettingsStore(databaseUrl()).save({
    source: glassdoorJobBoard.source,
    enabled: formData.get("enabled") === "on",
    searches: keywords ? [{ keywords, location }] : [],
  });
  revalidatePath("/settings");
}

async function saveExcludedKeywords(formData: FormData) {
  "use server";

  const keywords = String(formData.get("keywords"))
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const unique = [...new Map(keywords.map((keyword) => [keyword.toLowerCase(), keyword])).values()];
  await drizzleExcludedKeywordStore(databaseUrl()).replace(unique);
  revalidatePath("/settings");
}

async function addJobFeed(formData: FormData) {
  "use server";

  await drizzleJobFeedStore(databaseUrl()).add(feedUrl(formData));
  revalidatePath("/settings");
}

async function saveJobFeed(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));
  const store = drizzleJobFeedStore(databaseUrl());
  if (formData.get("remove")) await store.remove(id);
  else await store.update({ id, url: feedUrl(formData), enabled: formData.get("enabled") === "on" });
  revalidatePath("/settings");
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

async function cleanUp() {
  "use server";

  return cleanUpOldData(databaseUrl());
}

export default async function SettingsPage() {
  await connection();
  const settingsStore = drizzleJobBoardSettingsStore(databaseUrl());
  const [linkedIn, glassdoor, feeds, excludedKeywords, llm, scheduledCollection] = await Promise.all([
    settingsStore.get(linkedInJobBoard.source),
    settingsStore.get(glassdoorJobBoard.source),
    drizzleJobFeedStore(databaseUrl()).list(),
    drizzleExcludedKeywordStore(databaseUrl()).list(),
    drizzleLlmSettingsStore(databaseUrl()).get(),
    drizzleScheduleSettingsStore(databaseUrl()).collectionEnabled(),
  ]);
  const linkedInSearches = linkedIn?.searches.map(({ keywords, location }) => `${keywords} ${SEPARATOR} ${location}`);
  const glassdoorSearch = glassdoor?.searches[0];

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <Card>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          <LinkRow href="/google" title="Google" description="Gmail connection and Resume Folder" />
          <LinkRow href="/function-runs" title="Function runs" description="Recent runs and their errors" />
        </ul>
      </Card>

      <Section title="Schedule" description="Runs Job Collection every day at 10:00 in your timezone.">
        <form action={saveSchedule} className="flex items-center justify-between gap-3">
          <Enabled checked={scheduledCollection} />
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section title="LinkedIn Job Board">
        <form action={saveLinkedIn} className="space-y-3">
          <Enabled checked={linkedIn?.enabled} />
          <label className="block">
            <span className={labelClass}>Searches, one per line, as keywords {SEPARATOR} location</span>
            <textarea
              name="searches"
              rows={5}
              placeholder={`software engineer ${SEPARATOR} Remote`}
              defaultValue={linkedInSearches?.join("\n")}
              className={inputClass}
            />
          </label>
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section title="Glassdoor Job Board">
        <form action={saveGlassdoor} className="space-y-3">
          <Enabled checked={glassdoor?.enabled} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Keywords</span>
              <input
                name="keywords"
                placeholder="software engineer"
                defaultValue={glassdoorSearch?.keywords}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Location</span>
              <input
                name="location"
                placeholder="New York"
                defaultValue={glassdoorSearch?.location}
                className={inputClass}
              />
            </label>
          </div>
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section
        title="Job Feeds"
        description="Filtered job listing URLs from any website. Each enabled Job Feed costs one Firecrawl request a day."
      >
        {feeds.map((feed) => (
          <form
            key={feed.id}
            action={saveJobFeed}
            className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
          >
            <input type="hidden" name="id" value={feed.id} />
            <input
              name="url"
              type="url"
              defaultValue={feed.url}
              required
              aria-label="Job Feed URL"
              className={inputClass}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Enabled checked={feed.enabled} />
              <div className="flex gap-2">
                <SubmitButton variant="danger" name="remove" value="1" pendingText="Removing…" confirm="Remove this Job Feed?">
                  Remove
                </SubmitButton>
                <SubmitButton variant="secondary" name="save" value="1" pendingText="Saving…">
                  Save
                </SubmitButton>
              </div>
            </div>
          </form>
        ))}
        <form action={addJobFeed} className="flex flex-col gap-2 sm:flex-row">
          <input
            name="url"
            type="url"
            placeholder="https://example.com/jobs?q=engineer"
            required
            aria-label="New Job Feed URL"
            className={inputClass}
          />
          <SubmitButton pendingText="Adding…" className="shrink-0">
            Add Job Feed
          </SubmitButton>
        </form>
      </Section>

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
        title="Excluded Keywords"
        description="A Job whose title contains any of these words or phrases, ignoring case, is skipped."
      >
        <form action={saveExcludedKeywords} className="space-y-3">
          <input
            name="keywords"
            placeholder="senior, lead, manager"
            defaultValue={excludedKeywords.join(", ")}
            aria-label="Excluded Keywords, comma separated"
            className={inputClass}
          />
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
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        {children}
      </div>
    </Card>
  );
}

function Enabled({ checked }: { checked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input type="checkbox" name="enabled" defaultChecked={checked} className={checkboxClass} /> Enabled
    </label>
  );
}

function LinkRow({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/40 dark:active:bg-slate-800"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <span aria-hidden="true" className="text-slate-400">
          ›
        </span>
      </Link>
    </li>
  );
}
