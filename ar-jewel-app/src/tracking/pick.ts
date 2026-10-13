/** Index of the widest (= closest) face, or -1 when empty. FR-7. */
export function pickClosest(widths: number[]): number {
  let best = -1,
    max = -1;
  widths.forEach((w, i) => {
    if (w > max) {
      max = w;
      best = i;
    }
  });
  return best;
}

/** Index of the item whose x is nearest `x`, or -1. Used to match a pose to the chosen face. */
export function nearestX(xs: number[], x: number): number {
  let best = -1,
    d = Infinity;
  xs.forEach((v, i) => {
    const k = Math.abs(v - x);
    if (k < d) {
      d = k;
      best = i;
    }
  });
  return best;
}
