"use client";

import { useActionState } from "react";

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
      <button type="submit" disabled={pending}>
        {pending ? "Cleaning up…" : "Clean up old data"}
      </button>
      {result && (
        <p role="status">
          Deleted {result.jobs} Jobs, {result.applications} Applications, {result.recipients} recipients,{" "}
          {result.functionRuns} Function runs, {result.actorRuns} actor runs and {result.decisionMakers} Decision
          Makers.
        </p>
      )}
    </form>
  );
}
