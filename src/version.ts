// CLI version comparison (`R6.33`). A separate module with no vscode
// dependency: the "is the agent new enough" rule has to be unit-tested, and the
// installer module pulls in vscode, which will not load under bare node.

/** Compares versions shaped like R6.33: true when a >= b. Garbage is always false. */
export function versionAtLeast(a: string | null | undefined, b: string): boolean {
  const pa = /^R(\d+)\.(\d+)$/.exec((a || '').trim());
  const pb = /^R(\d+)\.(\d+)$/.exec(b.trim());
  if (!pa || !pb) return false;
  const aMaj = Number(pa[1]), aMin = Number(pa[2]);
  const bMaj = Number(pb[1]), bMin = Number(pb[2]);
  return aMaj !== bMaj ? aMaj > bMaj : aMin >= bMin;
}
