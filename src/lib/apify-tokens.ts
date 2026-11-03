import type { SkippedApifyTokenStore } from "./gateways";

export function parseTokens(apifyTokens: string) {
  const tokens = apifyTokens
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw new Error("No Apify tokens configured");
  return tokens;
}

type RouterDeps = {
  apifyTokens: string;
  skippedTokens: SkippedApifyTokenStore;
  /** The token the latest actor run stored. */
  lastToken: () => Promise<string | undefined>;
  now: () => Date;
};

/** Apify refused the token because it is rate-limited or out of credit. */
export class ApifyTokenUsedUpError extends Error {
  constructor(status: number) {
    super(`Apify token used up: ${status}`);
  }
}

export class AllApifyTokensUsedUpError extends Error {
  constructor() {
    super("All Apify tokens are used up until the next UTC day");
  }
}

const startOfNextUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));

/**
 * Round-robin over the Apify tokens, skipping a used-up token until the next UTC day.
 * Functions keep no state between runs, so rotation continues from the last token an actor run stored,
 * and skipped tokens live in Postgres.
 */
export function apifyTokenRouter({ apifyTokens, skippedTokens, lastToken, now }: RouterDeps) {
  const tokens = parseTokens(apifyTokens);

  return {
    async withToken<T>(start: (token: string) => Promise<T>) {
      const next = tokens.indexOf((await lastToken()) ?? "") + 1;
      const rotation = tokens.map((_, index) => tokens[(next + index) % tokens.length]);
      const skipped = await skippedTokens.listSkipped(now());

      for (const token of rotation.filter((token) => !skipped.includes(token))) {
        try {
          return { token, result: await start(token) };
        } catch (error) {
          if (!(error instanceof ApifyTokenUsedUpError)) throw error;
          console.warn(`An Apify token was used up (${error.message}), skipped until the next UTC day`);
          await skippedTokens.skip(token, startOfNextUtcDay(now()));
        }
      }
      throw new AllApifyTokensUsedUpError();
    },
  };
}
