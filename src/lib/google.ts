import type { DriveFile, DriveFolder, DriveGateway, GoogleOAuthGateway, GrantedTokens } from "./gateways";

/** The only scopes the agent asks for: it sends Applications and reads the Resume Folder. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

/** The consent page. Offline access with a forced prompt, so Google always returns a refresh token. */
export function googleAuthUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

export function googleOAuth(clientId: string, clientSecret: string): GoogleOAuthGateway {
  async function requestTokens(fields: Record<string, string>) {
    return fetch(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
    });
  }

  const granted = ({ access_token, expires_in, refresh_token }: TokenResponse): GrantedTokens => ({
    accessToken: access_token,
    expiresInSeconds: expires_in,
    ...(refresh_token && { refreshToken: refresh_token }),
  });

  return {
    async exchange(code: string, redirectUri: string) {
      const response = await requestTokens({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
      if (!response.ok) throw new Error(`Google refused the sign-in: ${response.status} ${await response.text()}`);
      const tokens = (await response.json()) as TokenResponse;
      const scopes = tokens.scope?.split(" ") ?? [];
      const missing = GOOGLE_SCOPES.filter((scope) => !scopes.includes(scope));
      if (missing.length > 0) throw new Error(`Google access wasn't granted for: ${missing.join(", ")}`);
      if (!tokens.refresh_token) throw new Error("Google returned no refresh token");
      return { ...granted(tokens), refreshToken: tokens.refresh_token };
    },

    async refresh(refreshToken: string) {
      const response = await requestTokens({ refresh_token: refreshToken, grant_type: "refresh_token" });
      if (response.status === 400) {
        const { error } = (await response.json()) as { error?: string };
        if (error === "invalid_grant") return null;
        throw new Error(`Google refused the token refresh: ${error}`);
      }
      if (!response.ok) throw new Error(`Google refused the token refresh: ${response.status} ${await response.text()}`);
      return granted((await response.json()) as TokenResponse);
    },
  };
}

export function googleDrive(accessToken: string): DriveGateway {
  async function get<T>(url: URL) {
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Google Drive refused the request: ${response.status} ${await response.text()}`);
    return (await response.json()) as T;
  }

  async function listAll<T>(query: string, fields: string) {
    const files: T[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(DRIVE_FILES_URL);
      url.search = new URLSearchParams({
        q: `${query} and trashed = false`,
        fields: `nextPageToken, files(${fields})`,
        orderBy: "name",
        pageSize: "1000",
        ...(pageToken && { pageToken }),
      }).toString();
      const page = await get<{ files: T[]; nextPageToken?: string }>(url);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  return {
    listFolders() {
      return listAll<DriveFolder>(`mimeType = '${FOLDER}' and 'me' in owners`, "id, name");
    },

    listFiles(folderId: string) {
      return listAll<DriveFile>(`'${folderId.replaceAll("'", "\\'")}' in parents`, "id, name, mimeType, webViewLink");
    },

    async isSharedByLink(folderId: string) {
      const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}`);
      url.searchParams.set("fields", "permissions(type, role)");
      const { permissions = [] } = await get<{ permissions?: { type: string; role: string }[] }>(url);
      return permissions.some(({ type }) => type === "anyone");
    },
  };
}
