import { drizzleGoogleConnectionStore, drizzleResumeFolderStore } from "./drizzle";
import { parseDashboardEnv } from "./env";
import { googleDrive, googleOAuth } from "./google";
import { type GoogleConnectionServices, googleAccessToken } from "./google-connection";

export const OAUTH_STATE_COOKIE = "google_oauth_state";
export const CALLBACK_PATH = "/google/callback";

/** The dashboard's Google services. Each environment sends Google back to its own origin. */
export function dashboardGoogle() {
  const { DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = parseDashboardEnv(process.env);
  const connection: GoogleConnectionServices = {
    store: drizzleGoogleConnectionStore(DATABASE_URL),
    oauth: googleOAuth(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    now: () => new Date(),
  };
  return {
    clientId: GOOGLE_CLIENT_ID,
    connection,
    resumeFolder: drizzleResumeFolderStore(DATABASE_URL),
    async drive() {
      return googleDrive(await googleAccessToken(connection));
    },
  };
}
