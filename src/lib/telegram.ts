import type { TelegramGateway } from "./gateways";

export function telegramGateway(botToken: string, chatId: string): TelegramGateway {
  return {
    async send(text, link) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(link && { reply_markup: { inline_keyboard: [[{ text: link.label, url: link.url }]] } }),
        }),
      });
      if (!response.ok) throw new Error(`Telegram refused the message: ${response.status}`);
    },
  };
}
