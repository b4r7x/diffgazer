/**
 * Format a token context window into a short human label, e.g. 1048576 -> "1M",
 * 131072 -> "131K". Shared by the per-model description and the provider
 * capability card so the two never disagree on the same number.
 */
export function formatContextTokens(context: number): string {
  const thousands = Math.round(context / 1000);
  if (thousands >= 1000) {
    const millions = (context / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${millions}M`;
  }
  return `${thousands}K`;
}
