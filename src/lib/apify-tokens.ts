export function parseTokens(apifyTokens: string) {
  const tokens = apifyTokens
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw new Error("No Apify tokens configured");
  return tokens;
}

/** Functions keep no state between runs, so rotation continues from the last token an actor run stored. */
export function nextToken(tokens: string[], lastToken: string | undefined) {
  return tokens[(tokens.indexOf(lastToken ?? "") + 1) % tokens.length];
}
