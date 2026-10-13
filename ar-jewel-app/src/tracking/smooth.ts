/** One Euro filter: low jitter when still, low lag when moving. */
export class OneEuro {
  private x?: number;
  private dx = 0;
  private t?: number;
  constructor(
    private minCut = 1.5,
    private beta = 0.01,
    private dCut = 1,
  ) {}
  private a(c: number, dt: number) {
    const r = 2 * Math.PI * c * dt;
    return r / (r + 1);
  }
  step(v: number, tMs: number): number {
    if (this.x === undefined || this.t === undefined) {
      this.x = v;
      this.t = tMs;
      return v;
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3);
    this.t = tMs;
    this.dx += this.a(this.dCut, dt) * ((v - this.x) / dt - this.dx);
    this.x += this.a(this.minCut + this.beta * Math.abs(this.dx), dt) * (v - this.x);
    return this.x;
  }
  /** Smoothed speed in units per second (for extrapolating over a known delay). */
  get rate(): number {
    return this.dx;
  }
  reset() {
    this.x = undefined;
    this.t = undefined;
    this.dx = 0;
  }
}
