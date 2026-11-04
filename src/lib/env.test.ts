import { expect, test } from "vitest";
import { parseDashboardEnv, parseFunctionsEnv } from "./env";

const sharedVariables = {
  DATABASE_URL: "postgres://user:password@db.example.com:6543/postgres",
  FUNCTIONS_SECRET: "secret",
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "client-secret",
};

const functionsVariables = {
  ...sharedVariables,
  APIFY_TOKENS: "first,second",
  FIRECRAWL_API_KEY: "fc-key",
  TELEGRAM_BOT_TOKEN: "bot-token",
  TELEGRAM_CHAT_ID: "12345",
  DASHBOARD_URL: "https://dashboard.example.com",
};

const dashboardVariables = {
  ...sharedVariables,
  DASHBOARD_PASSWORD: "password",
  FUNCTIONS_BASE_URL: "http://worker:8000",
};

test("Functions need only their own variables", () => {
  expect(parseFunctionsEnv(functionsVariables)).toEqual(functionsVariables);
});

test("Functions need Telegram settings and the dashboard URL for Failure Alerts", () => {
  const { TELEGRAM_BOT_TOKEN, ...withoutBotToken } = functionsVariables;
  const { TELEGRAM_CHAT_ID, ...withoutChatId } = functionsVariables;
  const { DASHBOARD_URL, ...withoutDashboardUrl } = functionsVariables;

  expect(() => parseFunctionsEnv(withoutBotToken)).toThrow(/TELEGRAM_BOT_TOKEN/);
  expect(() => parseFunctionsEnv(withoutChatId)).toThrow(/TELEGRAM_CHAT_ID/);
  expect(() => parseFunctionsEnv(withoutDashboardUrl)).toThrow(/DASHBOARD_URL/);
});

test("the dashboard needs its password and the Functions base URL", () => {
  expect(parseDashboardEnv(dashboardVariables)).toEqual(dashboardVariables);
  expect(() => parseDashboardEnv(sharedVariables)).toThrow(/DASHBOARD_PASSWORD/);
});

test("both sides need the Google OAuth client, because both refresh the Google connection", () => {
  const { GOOGLE_CLIENT_SECRET, ...withoutSecret } = functionsVariables;
  const { GOOGLE_CLIENT_ID, ...withoutId } = dashboardVariables;

  expect(() => parseFunctionsEnv(withoutSecret)).toThrow(/GOOGLE_CLIENT_SECRET/);
  expect(() => parseDashboardEnv(withoutId)).toThrow(/GOOGLE_CLIENT_ID/);
});

test("variables the other side owns are left out of the parsed result", () => {
  expect(parseFunctionsEnv({ ...functionsVariables, DASHBOARD_PASSWORD: "password" })).toEqual(functionsVariables);
  expect(parseDashboardEnv({ ...dashboardVariables, APIFY_TOKENS: "first" })).toEqual(dashboardVariables);
});
