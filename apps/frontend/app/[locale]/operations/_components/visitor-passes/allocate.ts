/**
 * Splits `total` new passes across floor-wings by their share of visits
 * (largest-remainder, so the parts always add up to `total`). Floors with no
 * visits get none; with no traffic recorded at all, the split is even.
 */
export function allocatePasses(
  total: number,
  rows: { zone: string; visits: number }[],
): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(
    rows.map((r) => [r.zone, 0]),
  );
  if (total <= 0 || rows.length === 0) return out;

  const traffic = rows.reduce((sum, r) => sum + Math.max(0, r.visits), 0);
  const weights = rows.map((r) => (traffic > 0 ? Math.max(0, r.visits) : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  rows.forEach((r, i) => {
    out[r.zone] = Math.floor(exact[i]!);
  });
  let left = total - rows.reduce((sum, r) => sum + out[r.zone]!, 0);
  // Hand the remainder to the largest fractions; ties go to the busier floor.
  const order = rows
    .map((r, i) => ({ zone: r.zone, frac: exact[i]! % 1, w: weights[i]! }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.frac - a.frac || b.w - a.w);
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) {
    out[order[i]!.zone]! += 1;
  }
  return out;
}
