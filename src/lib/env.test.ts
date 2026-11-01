import { expect, test } from "vitest";
import { parseDashboardEnv, parseFunctionsEnv } from "./env";

const sharedVariables = {
  DATABASE_URL: "postgres://user:password@db.example.com:6543/postgres",
  FUNCTIONS_SECRET: "secret",
};

const functionsVariables = { ...sharedVariables, APIFY_TOKENS: "first,second" };

const dashboardVariables = {
  ...sharedVariables,
  DASHBOARD_PASSWORD: "password",
  FUNCTIONS_BASE_URL: "http://worker:8000",
};

test("Functions need only their own variables", () => {
  expect(parseFunctionsEnv(functionsVariables)).toEqual(functionsVariables);
});

test("the dashboard needs its password and the Functions base URL", () => {
  expect(parseDashboardEnv(dashboardVariables)).toEqual(dashboardVariables);
  expect(() => parseDashboardEnv(sharedVariables)).toThrow(/DASHBOARD_PASSWORD/);
});

test("variables the other side owns are left out of the parsed result", () => {
  expect(parseFunctionsEnv({ ...functionsVariables, DASHBOARD_PASSWORD: "password" })).toEqual(functionsVariables);
  expect(parseDashboardEnv({ ...dashboardVariables, APIFY_TOKENS: "first" })).toEqual(dashboardVariables);
});
