// CLI version comparison (`R6.33`). A separate module with no vscode
// dependency: the "is the agent new enough" rule has to be unit-tested, and the
// installer module pulls in vscode, which will not load under bare node.

/** Compares dotted versions ("0.2.10" vs "0.2.9"): true when a is strictly newer. */
export function dottedNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  const parse = (v: string | null | undefined) => {
    const parts = (v || '').trim().replace(/^v/, '').split('.').map(Number);
    return parts.length && parts.every((n) => Number.isInteger(n) && n >= 0) ? parts : null;
  };
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Compares versions shaped like R6.33: true when a >= b. Garbage is always false. */
export function versionAtLeast(a: string | null | undefined, b: string): boolean {
  const pa = /^R(\d+)\.(\d+)$/.exec((a || '').trim());
  const pb = /^R(\d+)\.(\d+)$/.exec(b.trim());
  if (!pa || !pb) return false;
  const aMaj = Number(pa[1]), aMin = Number(pa[2]);
  const bMaj = Number(pb[1]), bMin = Number(pb[2]);
  return aMaj !== bMaj ? aMaj > bMaj : aMin >= bMin;
}
