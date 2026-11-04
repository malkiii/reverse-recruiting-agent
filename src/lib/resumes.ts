import type { DriveFile } from "./gateways";

const PDF = "application/pdf";
const RESUME_NAME = /(resume|cv)(\.pdf)?$/i;

/** The Resumes among the Resume Folder's files: PDFs whose names end in "resume" or "CV", in any case. */
export function resumesIn(files: DriveFile[]) {
  return files.filter(({ name, mimeType }) => mimeType === PDF && RESUME_NAME.test(name.trim()));
}
