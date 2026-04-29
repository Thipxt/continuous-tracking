import type { TrialStateValue } from "../types";

export const TrialState = {
  IDLE: "idle",
  COUNTDOWN: "countdown",
  RUNNING: "running",
  FINISHED: "finished"
} as const satisfies Record<string, TrialStateValue>;

export class TrialManager {
  durationSec: number;
  preCountdownSec: number;
  state: TrialStateValue;
  countdownRemaining: number;
  elapsed: number;

  constructor(durationSec: number, preCountdownSec = 3) {
    this.durationSec = durationSec;
    this.preCountdownSec = preCountdownSec;
    this.state = TrialState.IDLE;
    this.countdownRemaining = preCountdownSec;
    this.elapsed = 0;
  }

  startCountdown(): void {
    this.state = TrialState.COUNTDOWN;
    this.countdownRemaining = this.preCountdownSec;
    this.elapsed = 0;
  }

  startRun(): void {
    this.state = TrialState.RUNNING;
    this.elapsed = 0;
  }

  finish(): void {
    this.state = TrialState.FINISHED;
  }

  reset(): void {
    this.state = TrialState.IDLE;
    this.countdownRemaining = this.preCountdownSec;
    this.elapsed = 0;
  }

  update(dt: number): void {
    if (this.state === TrialState.COUNTDOWN) {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.startRun();
      }
    } else if (this.state === TrialState.RUNNING) {
      this.elapsed += dt;
      if (this.elapsed >= this.durationSec) {
        this.finish();
      }
    }
  }

  getTimeLeft(): number {
    return Math.max(0, this.durationSec - this.elapsed);
  }
}