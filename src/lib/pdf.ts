import { extractText, getDocumentProxy } from "unpdf";
import type { PdfReader } from "./gateways";

/** Reads a PDF's text with pdf.js, one paragraph per page, so no LLM is paid to read a Resume. */
export const pdfReader: PdfReader = {
  async toMarkdown(pdf: Uint8Array) {
    const { text } = await extractText(await getDocumentProxy(pdf), { mergePages: false });
    return text.map((page) => page.trim()).filter(Boolean).join("\n\n");
  },
};
