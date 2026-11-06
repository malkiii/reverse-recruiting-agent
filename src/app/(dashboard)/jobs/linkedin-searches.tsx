"use client";

import { useState } from "react";
import { buttonClass } from "@/components/button";
import { inputClass, labelClass } from "@/components/ui";
import type { JobSearch } from "@/lib/schema";

type Row = JobSearch & { id: number };

/** The LinkedIn Job Board's searches as Keywords and Location rows, sent as parallel `keywords` and `location` fields. */
export function LinkedInSearches({ searches }: { searches: JobSearch[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    (searches.length ? searches : [{ keywords: "", location: "" }]).map((search, id) => ({ ...search, id })),
  );
  const [nextId, setNextId] = useState(rows.length);

  const add = () => {
    setRows([...rows, { keywords: "", location: "", id: nextId }]);
    setNextId(nextId + 1);
  };
  const remove = (id: number) => setRows(rows.filter((row) => row.id !== id));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_2rem] gap-2">
        <span className={labelClass}>Keywords</span>
        <span className={labelClass}>Location</span>
      </div>
      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
          <input
            name="keywords"
            placeholder="software engineer"
            defaultValue={row.keywords}
            aria-label={`Search ${index + 1} keywords`}
            className={inputClass}
          />
          <input
            name="location"
            placeholder="New York"
            defaultValue={row.location}
            aria-label={`Search ${index + 1} location`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            aria-label={`Remove search ${index + 1}`}
            className={`${buttonClass("ghost")} px-0`}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={buttonClass("ghost")}>
        + Add search
      </button>
    </div>
  );
}
