import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { drizzleExcludedKeywordStore, drizzleJobBoardSettingsStore, drizzleJobFeedStore } from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { glassdoorJobBoard } from "@/lib/glassdoor-job-board";
import { linkedInJobBoard } from "@/lib/linkedin-job-board";
import type { JobSearch } from "@/lib/schema";

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

export default async function SettingsPage() {
  await connection();
  const settingsStore = drizzleJobBoardSettingsStore(databaseUrl());
  const [linkedIn, glassdoor, feeds, excludedKeywords] = await Promise.all([
    settingsStore.get(linkedInJobBoard.source),
    settingsStore.get(glassdoorJobBoard.source),
    drizzleJobFeedStore(databaseUrl()).list(),
    drizzleExcludedKeywordStore(databaseUrl()).list(),
  ]);
  const linkedInSearches = linkedIn?.searches.map(({ keywords, location }) => `${keywords} ${SEPARATOR} ${location}`);
  const glassdoorSearch = glassdoor?.searches[0];

  return (
    <main>
      <h1>Settings</h1>
      <Link href="/jobs">Jobs</Link>

      <h2>LinkedIn Job Board</h2>
      <form action={saveLinkedIn}>
        <p>
          <label>
            <input type="checkbox" name="enabled" defaultChecked={linkedIn?.enabled} /> Enabled
          </label>
        </p>
        <p>
          <label>
            Searches, one per line, as keywords {SEPARATOR} location
            <br />
            <textarea
              name="searches"
              rows={5}
              cols={50}
              placeholder={`software engineer ${SEPARATOR} Remote`}
              defaultValue={linkedInSearches?.join("\n")}
            />
          </label>
        </p>
        <button type="submit">Save</button>
      </form>

      <h2>Glassdoor Job Board</h2>
      <form action={saveGlassdoor}>
        <p>
          <label>
            <input type="checkbox" name="enabled" defaultChecked={glassdoor?.enabled} /> Enabled
          </label>
        </p>
        <p>
          <label>
            Keywords <input name="keywords" placeholder="software engineer" defaultValue={glassdoorSearch?.keywords} />
          </label>{" "}
          <label>
            Location <input name="location" placeholder="New York" defaultValue={glassdoorSearch?.location} />
          </label>
        </p>
        <button type="submit">Save</button>
      </form>

      <h2>Job Feeds</h2>
      <p>Filtered job listing URLs from any website. Each enabled Job Feed costs one Firecrawl request a day.</p>
      {feeds.map((feed) => (
        <form key={feed.id} action={saveJobFeed}>
          <input type="hidden" name="id" value={feed.id} />
          <label>
            <input type="checkbox" name="enabled" defaultChecked={feed.enabled} /> Enabled
          </label>{" "}
          <input name="url" type="url" size={60} defaultValue={feed.url} required />{" "}
          <button type="submit">Save</button>{" "}
          <button type="submit" name="remove" value="1">
            Remove
          </button>
        </form>
      ))}
      <form action={addJobFeed}>
        <input name="url" type="url" size={60} placeholder="https://example.com/jobs?q=engineer" required />{" "}
        <button type="submit">Add Job Feed</button>
      </form>

      <h2>Excluded Keywords</h2>
      <p>A Job whose title contains any of these words or phrases, ignoring case, is skipped.</p>
      <form action={saveExcludedKeywords}>
        <input
          name="keywords"
          size={60}
          placeholder="senior, lead, manager"
          defaultValue={excludedKeywords.join(", ")}
        />{" "}
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
