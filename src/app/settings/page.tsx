import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { drizzleJobBoardSettingsStore } from "@/lib/drizzle";
import { linkedInJobBoard } from "@/lib/linkedin-job-board";

const { source } = linkedInJobBoard;

async function saveLinkedIn(formData: FormData) {
  "use server";

  const searchUrls = String(formData.get("searchUrls"))
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);

  await drizzleJobBoardSettingsStore().save({
    source,
    enabled: formData.get("enabled") === "on",
    searchUrls: z.url().array().parse(searchUrls),
  });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  await connection();
  const settings = await drizzleJobBoardSettingsStore().get(source);

  return (
    <main>
      <h1>Settings</h1>
      <Link href="/jobs">Jobs</Link>
      <h2>LinkedIn Job Board</h2>
      <form action={saveLinkedIn}>
        <label>
          <input type="checkbox" name="enabled" defaultChecked={settings?.enabled} /> Enabled
        </label>
        <label>
          Search URLs, one per line
          <textarea name="searchUrls" rows={5} defaultValue={settings?.searchUrls.join("\n")} />
        </label>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
