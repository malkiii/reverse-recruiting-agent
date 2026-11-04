import { z } from "zod";
import type { CompanyPageSearch } from "./gateways";

const SEARCH_URL = "https://api.firecrawl.dev/v2/search";

const responseSchema = z.object({
  data: z.object({ web: z.array(z.object({ url: z.string(), title: z.string().nullish() })).nullish() }),
});

/** Searches the web for a Company's LinkedIn page, in one Firecrawl search for one result. */
export function firecrawlCompanyPageSearch(apiKey: string): CompanyPageSearch {
  return {
    async firstResult(query: string) {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 1 }),
      });
      if (!response.ok) throw new Error(`Firecrawl search failed: ${response.status} ${await response.text()}`);
      const first = responseSchema.parse(await response.json()).data.web?.[0];
      return first ? { url: first.url, title: first.title ?? "" } : null;
    },
  };
}
