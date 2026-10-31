import Link from "next/link";
import { connection } from "next/server";
import { collectionServices } from "@/lib/collection";
import { drizzleJobStore } from "@/lib/drizzle";
import { runCollection } from "@/lib/job-collection";

async function startCollection() {
  "use server";

  await runCollection(collectionServices());
}

export default async function JobsPage() {
  await connection();
  const jobs = await drizzleJobStore().list();

  return (
    <main>
      <h1>Jobs</h1>
      <Link href="/settings">Settings</Link>
      <form action={startCollection}>
        <button type="submit">Run collection</button>
      </form>
      {jobs.length === 0 ? (
        <p>No Jobs yet.</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.url}>
              <a href={job.url}>{job.title}</a> at {job.companyName} ({job.source})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
