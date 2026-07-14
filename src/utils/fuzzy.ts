/** Simple Levenshtein distance for command typo suggestions */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function suggestCommands(input: string, candidates: string[], limit = 5): string[] {
  const scored = candidates
    .map((name) => {
      const dist = levenshtein(input, name);
      const starts = name.startsWith(input) ? -2 : 0;
      const includes = name.includes(input) ? -1 : 0;
      return { name, score: dist + starts + includes };
    })
    .filter((s) => s.score <= Math.max(3, Math.floor(input.length / 2) + 1))
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit).map((s) => s.name);
}
