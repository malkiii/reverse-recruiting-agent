import type { TelegramGateway, TelegramLink } from "./gateways";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const keyboard = ({ label, url }: TelegramLink) => ({ inline_keyboard: [[{ text: label, url }]] });

export function telegramGateway(botToken: string, chatId: string): TelegramGateway {
  async function call(method: string, body: BodyInit, headers?: HeadersInit) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { method: "POST", headers, body });
    if (!response.ok) throw new Error(`Telegram refused the message: ${response.status} ${await response.text()}`);
  }

  const sendMessage = (fields: object) =>
    call("sendMessage", JSON.stringify({ chat_id: chatId, ...fields }), { "content-type": "application/json" });

  return {
    async send(text, link) {
      await sendMessage({ text, ...(link && { reply_markup: keyboard(link) }) });
    },

    async sendHtml(html, link, photo) {
      if (!photo) return sendMessage({ text: html, parse_mode: "HTML", reply_markup: keyboard(link) });

      // Uploaded rather than given as a URL, so a broken image is caught before Telegram sees it.
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", html);
      form.append("parse_mode", "HTML");
      form.append("reply_markup", JSON.stringify(keyboard(link)));
      form.append("photo", new Blob([photo.bytes], { type: photo.type }), `photo.${EXTENSIONS[photo.type] ?? "jpg"}`);
      await call("sendPhoto", form);
    },
  };
}
