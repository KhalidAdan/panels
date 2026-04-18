export type SpreadUnit =
  | { kind: "solo"; index: number }
  | { kind: "pair"; left: number; right: number };

export function computeSpreads(isWide: boolean[]): SpreadUnit[] {
  const units: SpreadUnit[] = [];
  let i = 0;

  if (isWide.length > 0) {
    units.push({ kind: "solo", index: 0 });
    i = 1;
  }

  while (i < isWide.length) {
    const here = isWide[i] ?? false;
    const next = isWide[i + 1] ?? false;
    if (here) {
      units.push({ kind: "solo", index: i });
      i += 1;
      continue;
    }
    if (i + 1 < isWide.length && !next) {
      units.push({ kind: "pair", left: i, right: i + 1 });
      i += 2;
      continue;
    }
    units.push({ kind: "solo", index: i });
    i += 1;
  }

  return units;
}

export function findSpreadIndex(units: SpreadUnit[], pageIndex: number): number {
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.kind === "solo" && u.index === pageIndex) return i;
    if (u.kind === "pair" && (u.left === pageIndex || u.right === pageIndex)) return i;
  }
  return 0;
}

export function spreadLeadPage(u: SpreadUnit): number {
  return u.kind === "solo" ? u.index : u.left;
}