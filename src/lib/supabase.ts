import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Job, JobStore } from "./gateways";

type JobRow = {
  source: string;
  title: string;
  company_name: string;
  location: string;
  url: string;
  post_day: string;
  description: string | null;
};

export function supabaseJobStore(): JobStore {
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  return {
    async save(jobs: Job[]) {
      const rows: JobRow[] = jobs.map(({ companyName, postDay, ...job }) => ({
        ...job,
        company_name: companyName,
        post_day: postDay,
      }));
      const { error } = await supabase.from("jobs").insert(rows);
      if (error) throw new Error(error.message);
    },

    async list() {
      const { data, error } = await supabase
        .from("jobs")
        .select("source, title, company_name, location, url, post_day, description")
        .order("post_day", { ascending: false })
        .returns<JobRow[]>();
      if (error) throw new Error(error.message);
      return data.map(({ company_name, post_day, ...job }) => ({
        ...job,
        companyName: company_name,
        postDay: post_day,
      }));
    },
  };
}
