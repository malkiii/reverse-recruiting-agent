import { expect, test } from "vitest";
import { FakeGoogleConnectionStore, FakeGoogleOAuth } from "./fake-gateways";
import { connectGoogle, googleAccessToken } from "./google-connection";

const now = new Date("2026-11-04T12:00:00Z");
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

test("a fresh access token is used without asking Google", async () => {
  const store = new FakeGoogleConnectionStore({ refreshToken: "refresh", accessToken: "fresh", expiresAt: inMinutes(30) });
  const oauth = new FakeGoogleOAuth();

  expect(await googleAccessToken({ store, oauth, now: () => now })).toBe("fresh");
  expect(oauth.refreshed).toEqual([]);
});

test("an access token about to expire is refreshed and saved, keeping the refresh token", async () => {
  const store = new FakeGoogleConnectionStore({ refreshToken: "refresh", accessToken: "stale", expiresAt: inMinutes(0.5) });
  const oauth = new FakeGoogleOAuth();

  expect(await googleAccessToken({ store, oauth, now: () => now })).toBe("renewed");
  expect(oauth.refreshed).toEqual(["refresh"]);
  expect(store.tokens).toEqual({ refreshToken: "refresh", accessToken: "renewed", expiresAt: inMinutes(60) });
});

test("a new refresh token from Google replaces the old one", async () => {
  const store = new FakeGoogleConnectionStore({ refreshToken: "refresh", accessToken: "stale", expiresAt: inMinutes(-5) });
  const oauth = new FakeGoogleOAuth();
  oauth.grant = { accessToken: "renewed", expiresInSeconds: 3600, refreshToken: "rotated" };

  await googleAccessToken({ store, oauth, now: () => now });

  expect(store.tokens?.refreshToken).toBe("rotated");
});

test("a refresh token Google no longer accepts asks the Admin to reconnect", async () => {
  const store = new FakeGoogleConnectionStore({ refreshToken: "revoked", accessToken: "stale", expiresAt: inMinutes(-5) });

  await expect(googleAccessToken({ store, oauth: new FakeGoogleOAuth(), now: () => now })).rejects.toThrow(
    /reconnect Google/,
  );
});

test("without a Google connection, the Admin is asked to connect", async () => {
  const store = new FakeGoogleConnectionStore();

  await expect(googleAccessToken({ store, oauth: new FakeGoogleOAuth(), now: () => now })).rejects.toThrow(
    /connect Google/,
  );
});

test("connecting Google saves the granted tokens, so later access tokens refresh without signing in again", async () => {
  const store = new FakeGoogleConnectionStore();
  const oauth = new FakeGoogleOAuth();
  oauth.grant = { accessToken: "first", expiresInSeconds: 3600, refreshToken: "refresh" };

  await connectGoogle({ store, oauth, now: () => now }, "code", "http://localhost:3000/google/callback");

  expect(oauth.exchanged).toEqual([{ code: "code", redirectUri: "http://localhost:3000/google/callback" }]);
  expect(store.tokens).toEqual({ refreshToken: "refresh", accessToken: "first", expiresAt: inMinutes(60) });
});
