import { connection } from "next/server";
import { supabaseJobStore } from "@/lib/supabase";

export default async function JobsPage() {
  await connection();
  const jobs = await supabaseJobStore().list();

  return (
    <main>
      <h1>Jobs</h1>
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
