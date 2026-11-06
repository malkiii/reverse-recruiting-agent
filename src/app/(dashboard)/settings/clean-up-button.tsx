"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/button";
import { Spinner } from "@/components/submit-button";

export type CleanUpResult = {
  jobs: number;
  applications: number;
  recipients: number;
  functionRuns: number;
  actorRuns: number;
  decisionMakers: number;
};

export function CleanUpButton({ cleanUp }: { cleanUp: () => Promise<CleanUpResult> }) {
  const [result, action, pending] = useActionState<CleanUpResult | null>(() => cleanUp(), null);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Delete all data 6 months old or more? This can't be undone.")) event.preventDefault();
      }}
    >
      <button type="submit" disabled={pending} className={buttonClass("danger")}>
        {pending && <Spinner />}
        {pending ? "Cleaning up…" : "Clean up old data"}
      </button>
      {result && (
        <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Deleted {result.jobs} Jobs, {result.applications} Applications, {result.recipients} recipients,{" "}
          {result.functionRuns} Function runs, {result.actorRuns} actor runs and {result.decisionMakers} Decision
          Makers.
        </p>
      )}
    </form>
  );
}
