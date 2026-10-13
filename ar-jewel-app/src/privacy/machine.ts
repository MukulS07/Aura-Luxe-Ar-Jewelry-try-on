export type Screen = 'start' | 'notice' | 'pick' | 'live' | 'photo' | 'qr';

/** Allowed transitions (agent.md §7). Anything else is impossible. Idle reset is `reset()`: any state -> start. */
const NEXT: Record<Screen, Screen[]> = {
  start: ['notice'],
  notice: ['start', 'pick'],
  pick: ['start', 'live'],
  live: ['pick', 'start', 'photo'],
  photo: ['live', 'qr', 'start'],
  qr: ['start'],
};

/** The camera runs only here. */
export const CAMERA_SCREENS: Screen[] = ['live', 'photo'];

export class Machine {
  state: Screen = 'start';
  constructor(private onChange: (to: Screen, from: Screen) => void = () => {}) {}
  go(to: Screen): void {
    if (!NEXT[this.state].includes(to)) throw new Error(`Illegal transition ${this.state} -> ${to}`);
    this.set(to);
  }
  reset(): void {
    this.set('start');
  }
  private set(to: Screen) {
    const from = this.state;
    this.state = to;
    this.onChange(to, from);
  }
}
