import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { drizzleJobBoardSettingsStore } from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { linkedInJobBoard } from "@/lib/linkedin-job-board";
import type { JobSearch } from "@/lib/schema";

const { source } = linkedInJobBoard;
const SEPARATOR = "|";

function parseSearch(line: string): JobSearch {
  const [keywords = "", location = ""] = line.split(SEPARATOR).map((part) => part.trim());
  return { keywords, location };
}

async function saveLinkedIn(formData: FormData) {
  "use server";

  const searches = String(formData.get("searches"))
    .split("\n")
    .filter((line) => line.trim())
    .map(parseSearch);

  const { DATABASE_URL } = parseDashboardEnv(process.env);
  await drizzleJobBoardSettingsStore(DATABASE_URL).save({
    source,
    enabled: formData.get("enabled") === "on",
    searches,
  });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  await connection();
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const settings = await drizzleJobBoardSettingsStore(DATABASE_URL).get(source);
  const searches = settings?.searches.map(({ keywords, location }) => `${keywords} ${SEPARATOR} ${location}`);

  return (
    <main>
      <h1>Settings</h1>
      <Link href="/jobs">Jobs</Link>
      <h2>LinkedIn Job Board</h2>
      <form action={saveLinkedIn}>
        <p>
          <label>
            <input type="checkbox" name="enabled" defaultChecked={settings?.enabled} /> Enabled
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
              defaultValue={searches?.join("\n")}
            />
          </label>
        </p>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
