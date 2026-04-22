export const TrialState = {
  IDLE: "idle",
  COUNTDOWN: "countdown",
  RUNNING: "running",
  FINISHED: "finished"
};

export class TrialManager {
  constructor(durationSec, preCountdownSec = 3) {
    this.durationSec = durationSec;
    this.preCountdownSec = preCountdownSec;
    this.state = TrialState.IDLE;
    this.countdownRemaining = preCountdownSec;
    this.elapsed = 0;
  }

  startCountdown() {
    this.state = TrialState.COUNTDOWN;
    this.countdownRemaining = this.preCountdownSec;
    this.elapsed = 0;
  }

  startRun() {
    this.state = TrialState.RUNNING;
    this.elapsed = 0;
  }

  finish() {
    this.state = TrialState.FINISHED;
  }

  reset() {
    this.state = TrialState.IDLE;
    this.countdownRemaining = this.preCountdownSec;
    this.elapsed = 0;
  }

  update(dt) {
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

  getTimeLeft() {
    return Math.max(0, this.durationSec - this.elapsed);
  }
}