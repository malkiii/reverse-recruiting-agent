import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ImageGateway } from "./gateways";

const TIMEOUT_MS = 10_000;
// Telegram's limit for an uploaded photo.
const MAX_BYTES = 10 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; ReverseRecruitingAssistant/1.0)";

const FILE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const PHOTO_TYPES = new Set([...Object.values(FILE_TYPES), "image/gif"]);

export const PLACEHOLDERS_DIR = path.join(process.cwd(), "assets", "job-alert-placeholders");

const OG_IMAGE_KEYS = new Set(["og:image", "og:image:url", "og:image:secure_url"]);

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match && (match[1] ?? match[2] ?? match[3]);
}

/** The absolute URL of a page's og:image, from its HTML. */
export function ogImageUrl(html: string, pageUrl: string) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name"))?.toLowerCase();
    const content = attribute(tag, "content")?.trim().replaceAll("&amp;", "&");
    if (key && OG_IMAGE_KEYS.has(key) && content && URL.canParse(content, pageUrl)) {
      return new URL(content, pageUrl).href;
    }
  }
  return null;
}

const get = (url: string) =>
  fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });

export function webImageGateway(placeholdersDir = PLACEHOLDERS_DIR): ImageGateway {
  return {
    async download(url) {
      try {
        const response = await get(url);
        const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
        if (!response.ok || !PHOTO_TYPES.has(type)) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.length > 0 && bytes.length <= MAX_BYTES ? { bytes, type } : null;
      } catch {
        return null;
      }
    },

    async pageImageUrl(pageUrl) {
      try {
        const response = await get(pageUrl);
        return response.ok ? ogImageUrl(await response.text(), response.url || pageUrl) : null;
      } catch {
        return null;
      }
    },

    async placeholder(name) {
      try {
        const file = (await readdir(placeholdersDir)).find(
          (file) => path.parse(file).name === name && FILE_TYPES[path.extname(file).toLowerCase()],
        );
        if (!file) return null;
        const bytes = new Uint8Array(await readFile(path.join(placeholdersDir, file)));
        return { bytes, type: FILE_TYPES[path.extname(file).toLowerCase()] };
      } catch {
        return null;
      }
    },
  };
}
