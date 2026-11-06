import type { ReactNode } from "react";
import { STEP_NAMES } from "@/components/status";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import type { ApplicationStep } from "@/lib/gateways";
import { APPLICATION_STEPS } from "@/lib/schema";

const STEP_DETAILS: Record<ApplicationStep, string> = {
  "read-job": "Reads the Job page and summarizes it.",
  "choose-resume": "The LLM picks the best-fitting Resume from your Resume Folder.",
  "find-company-page": "Confirms the Company's LinkedIn page. If it can't, the Application ends in Direct Apply.",
  "find-decision-makers":
    "Finds up to 4 Decision Makers with email addresses. If none has one, the Application ends in No Contacts.",
  "write-cover-letter": "Writes one Cover Letter for the Job, personalized for each Decision Maker.",
  "check-sharing": "Makes sure the Resume Folder is shared by link, so recipients can open the Resume.",
  send: "After you click Send, emails each Decision Maker from your Gmail. They then enter a 30-day Cooldown.",
};

export default function HowItWorksPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="How it works" subtitle="A quick guide, from finding Jobs to sending Applications." />

      <Section title="Overview">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <b>Job Collection</b> gathers new Jobs daily from your enabled Job Boards and Job Feeds, and sends each new
            Job to you as a Job Alert.
          </li>
          <li>
            <b>Prepare</b> a Job you like. The agent builds an Application: Resume, Cover Letter and Decision Makers.
            Nothing is sent yet.
          </li>
          <li>
            <b>Review</b> the Application. Edit the subject, Cover Letter or Resume, or remove a Decision Maker.
          </li>
          <li>
            <b>Send</b> it, or <b>Cancel</b> it. A Failed Application can be Retried from the step it failed at.
          </li>
        </ol>
      </Section>

      <Section title="Settings">
        <Items>
          <Item name="LLM">The provider and model used to choose a Resume and write the Cover Letter.</Item>
          <Item name="Sending">Must be on for Send to work. While it&apos;s off, Send is refused.</Item>
          <Item name="Google">Connect Gmail, used to send, and choose the Resume Folder holding your Resume PDFs.</Item>
          <Item name="Function runs">Recent background runs and their errors.</Item>
          <Item name="Old Data">Deletes data 6 months old or more.</Item>
        </Items>
      </Section>

      <Section title="Collection settings" description="In the Jobs page's side panel.">
        <Items>
          <Item name="Schedule">Runs Job Collection every day at 10:00 in your timezone. You can also start it by hand.</Item>
          <Item name="LinkedIn Job Board">One or more keyword and location searches.</Item>
          <Item name="Glassdoor Job Board">One keyword and location search, optionally remote only.</Item>
          <Item name="Job Feeds">Filtered job listing URLs from any website. Each costs one Firecrawl request a day.</Item>
          <Item name="Excluded Keywords">Jobs whose title contains any of these are skipped.</Item>
        </Items>
      </Section>

      <Section title="Application steps" description="What Prepare and Send do, in order. Each attempt shows as a Step Log.">
        <ol className="list-decimal space-y-2 pl-5">
          {APPLICATION_STEPS.map((step) => (
            <li key={step}>
              <b>{STEP_NAMES[step]}</b>: {STEP_DETAILS[step]}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="space-y-3 px-4 py-4 text-sm text-fg-2">
        {description && <p className="text-muted">{description}</p>}
        {children}
      </div>
    </Card>
  );
}

function Items({ children }: { children: ReactNode }) {
  return <dl className="space-y-2">{children}</dl>;
}

function Item({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-fg">{name}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}
