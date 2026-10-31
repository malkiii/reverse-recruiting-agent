export function nextToken(apifyTokens: string, lastToken: string | undefined) {
  const tokens = apifyTokens
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw new Error("No Apify tokens configured");

  return tokens[(tokens.indexOf(lastToken ?? "") + 1) % tokens.length]!;
}
