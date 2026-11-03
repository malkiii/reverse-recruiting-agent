import { expect, test } from "vitest";
import { AllApifyTokensUsedUpError, ApifyTokenUsedUpError, apifyTokenRouter } from "./apify-tokens";
import { FakeSkippedApifyTokenStore } from "./fake-gateways";

const now = new Date("2026-11-01T22:00:00Z");

function setup({ apifyTokens = "first,second,third", lastToken = undefined as string | undefined } = {}) {
  const skippedTokens = new FakeSkippedApifyTokenStore();
  const state = { lastToken, now };
  const router = apifyTokenRouter({
    apifyTokens,
    skippedTokens,
    lastToken: async () => state.lastToken,
    now: () => state.now,
  });
  return { router, skippedTokens, state };
}

test("tokens rotate round-robin from the last token an actor run stored", async () => {
  const { router, state } = setup({ lastToken: "second" });
  const used: string[] = [];

  for (let index = 0; index < 3; index++) {
    const { token } = await router.withToken(async (token) => token);
    used.push(token);
    state.lastToken = token;
  }

  expect(used).toEqual(["third", "first", "second"]);
});

test("a rate-limited or out-of-credit token moves the start to the next token", async () => {
  const { router } = setup();
  const tried: string[] = [];

  const { token, result } = await router.withToken(async (token) => {
    tried.push(token);
    if (token === "first") throw new ApifyTokenUsedUpError(402);
    return "run-1";
  });

  expect(tried).toEqual(["first", "second"]);
  expect({ token, result }).toEqual({ token: "second", result: "run-1" });
});

test("a skipped token isn't used again until the next UTC day, across Function runs", async () => {
  const { router, skippedTokens } = setup({ apifyTokens: "first,second" });
  await router.withToken(async (token) => {
    if (token === "first") throw new ApifyTokenUsedUpError(429);
  });

  // Later Function runs, with rotation pointing back at the skipped token.
  const routerAt = (at: string) =>
    apifyTokenRouter({ apifyTokens: "first,second", skippedTokens, lastToken: async () => "second", now: () => new Date(at) });

  expect((await routerAt("2026-11-01T23:59:59Z").withToken(async () => {})).token).toBe("second");
  expect((await routerAt("2026-11-02T00:00:00Z").withToken(async () => {})).token).toBe("first");
});

test("any other error isn't a reason to change tokens", async () => {
  const { router, skippedTokens } = setup();

  await expect(router.withToken(async () => Promise.reject(new Error("Apify request failed: 500")))).rejects.toThrow(
    /500/,
  );

  expect(await skippedTokens.listSkipped(now)).toEqual([]);
});

test("when all tokens are used up, the router says so without trying them again", async () => {
  const { router } = setup({ apifyTokens: "first,second" });
  const tried: string[] = [];
  const usedUp = async (token: string) => {
    tried.push(token);
    throw new ApifyTokenUsedUpError(402);
  };

  await expect(router.withToken(usedUp)).rejects.toThrow(AllApifyTokensUsedUpError);
  await expect(router.withToken(usedUp)).rejects.toThrow(AllApifyTokensUsedUpError);

  expect(tried).toEqual(["first", "second"]);
});
