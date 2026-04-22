import { CONFIG } from "../config.js";
import { clamp } from "../utils/math.js";
import { SeededRNG } from "../utils/rng.js";
import { PathGenerator } from "./PathGenerator.js";
import { getVelocityAt } from "./MotionProfile.js";
import { ScoringTracker } from "./Scoring.js";
import { TrialManager, TrialState } from "./TrialManager.js";

export class GameEngine {
  constructor(canvas, hud, overlay) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud;
    this.overlay = overlay;

    this.bounds = {
      minX: CONFIG.canvas.margin + CONFIG.target.radius,
      maxX: CONFIG.canvas.width - CONFIG.canvas.margin - CONFIG.target.radius,
      minY: CONFIG.canvas.margin + CONFIG.target.radius,
      maxY: CONFIG.canvas.height - CONFIG.canvas.margin - CONFIG.target.radius
    };

    this.pointer = {
      x: CONFIG.canvas.width / 2,
      y: CONFIG.canvas.height / 2,
      inside: false,
      sensitivity: CONFIG.input.defaultSensitivity,
      rawLastX: null,
      rawLastY: null
    };

    this.target = {
      x: CONFIG.canvas.width / 2,
      y: CONFIG.canvas.height / 2,
      vx: 0,
      vy: 0
    };

    this.trial = null;
    this.scoring = new ScoringTracker();
    this.schedule = [];
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;
    this.lastTimestamp = 0;
    this.rafId = null;
    this.results = null;

    this.bindInput();
    this.render();
  }

  bindInput() {
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const rawX = (e.clientX - rect.left) * scaleX;
      const rawY = (e.clientY - rect.top) * scaleY;

      if (
        !this.pointer.inside ||
        this.pointer.rawLastX === null ||
        this.pointer.rawLastY === null
      ) {
        this.pointer.x = rawX;
        this.pointer.y = rawY;
        this.pointer.rawLastX = rawX;
        this.pointer.rawLastY = rawY;
        this.pointer.inside = true;
        return;
      }

      const dx = rawX - this.pointer.rawLastX;
      const dy = rawY - this.pointer.rawLastY;

      this.pointer.x += dx * this.pointer.sensitivity;
      this.pointer.y += dy * this.pointer.sensitivity;

      this.pointer.x = Math.max(0, Math.min(CONFIG.canvas.width, this.pointer.x));
      this.pointer.y = Math.max(0, Math.min(CONFIG.canvas.height, this.pointer.y));

      this.pointer.rawLastX = rawX;
      this.pointer.rawLastY = rawY;
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.pointer.inside = false;
      this.pointer.rawLastX = null;
      this.pointer.rawLastY = null;
    });
  }

  start({ durationSec, seed, pattern }) {
    this.stop();

    this.rng = new SeededRNG(Number(seed) || 1);
    this.pathGenerator = new PathGenerator(this.rng);

    this.schedule = this.pathGenerator.createSchedule(durationSec, pattern);
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.target.x = CONFIG.canvas.width / 2;
    this.target.y = CONFIG.canvas.height / 2;
    this.target.vx = 0;
    this.target.vy = 0;

    this.scoring.reset();
    this.results = null;

    this.trial = new TrialManager(durationSec, CONFIG.trial.preCountdownSec);
    this.trial.startCountdown();

    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reset() {
    this.stop();
    this.results = null;
    this.trial = new TrialManager(
      CONFIG.trial.defaultDurationSec,
      CONFIG.trial.preCountdownSec
    );
    this.trial.reset();
    this.scoring.reset();

    this.target.x = CONFIG.canvas.width / 2;
    this.target.y = CONFIG.canvas.height / 2;
    this.target.vx = 0;
    this.target.vy = 0;

    this.schedule = [];
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;

    this.hud.render({
      state: TrialState.IDLE,
      timeLeft: 0,
      metrics: null
    });

    this.hideOverlay();
    this.render();
  }

  setSensitivity(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;

    this.pointer.sensitivity = Math.max(
      CONFIG.input.minSensitivity,
      Math.min(CONFIG.input.maxSensitivity, numeric)
    );
  }

  loop(timestamp) {
    const dt = clamp((timestamp - this.lastTimestamp) / 1000, 0, 0.05);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    if (this.trial && this.trial.state !== TrialState.FINISHED) {
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    } else {
      this.finishRun();
    }
  }

  update(dt) {
    if (!this.trial) return;

    const prevState = this.trial.state;
    this.trial.update(dt);

    if (this.trial.state === TrialState.COUNTDOWN) {
      this.showOverlay(Math.ceil(this.trial.countdownRemaining).toString());
    } else {
      this.hideOverlay();
    }

    if (
      prevState === TrialState.COUNTDOWN &&
      this.trial.state === TrialState.RUNNING
    ) {
      this.currentSegmentIndex = 0;
      this.currentSegmentElapsed = 0;
    }

    if (this.trial.state === TrialState.RUNNING) {
      this.updateTarget(dt);
      this.scoring.update(dt, this.pointer, this.target);
    }

    this.hud.render({
      state: this.trial.state,
      timeLeft:
        this.trial.state === TrialState.RUNNING ? this.trial.getTimeLeft() : 0,
      metrics: this.results
    });
  }

  updateTarget(dt) {
    const segment = this.schedule[this.currentSegmentIndex];
    if (!segment) return;

    this.currentSegmentElapsed += dt;

    const velocity = getVelocityAt(segment, this.currentSegmentElapsed, dt);
    this.target.vx = velocity.x;
    this.target.vy = velocity.y;

    let nextX = this.target.x + this.target.vx * dt;
    let nextY = this.target.y + this.target.vy * dt;

    let bouncedX = false;
    let bouncedY = false;

    if (nextX <= this.bounds.minX) {
      nextX = this.bounds.minX;
      bouncedX = true;
    } else if (nextX >= this.bounds.maxX) {
      nextX = this.bounds.maxX;
      bouncedX = true;
    }

    if (nextY <= this.bounds.minY) {
      nextY = this.bounds.minY;
      bouncedY = true;
    } else if (nextY >= this.bounds.maxY) {
      nextY = this.bounds.maxY;
      bouncedY = true;
    }

    if (bouncedX || bouncedY) {
      const currentAngle = segment.directionAngle;
      let dx = Math.cos(currentAngle);
      let dy = Math.sin(currentAngle);

      if (bouncedX) dx *= -1;
      if (bouncedY) dy *= -1;

      segment.directionAngle = Math.atan2(dy, dx);

      if (segment.type === "jitter") {
        segment.jitterHeadingAngle = segment.directionAngle;
        segment.jitterHeadingTimer = 0;
      }

      const reflectedVelocity = getVelocityAt(
        segment,
        this.currentSegmentElapsed,
        dt
      );
      this.target.vx = reflectedVelocity.x;
      this.target.vy = reflectedVelocity.y;

      const pushOut = 1.0;

      nextX += this.target.vx * dt * pushOut;
      nextY += this.target.vy * dt * pushOut;

      nextX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, nextX));
      nextY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, nextY));
    }

    this.target.x = nextX;
    this.target.y = nextY;

    if (this.currentSegmentElapsed >= segment.duration) {
      this.currentSegmentIndex++;
      this.currentSegmentElapsed = 0;
    }
  }

  finishRun() {
    if (!this.trial || this.results) return;

    this.results = this.scoring.getResults();

    this.hud.render({
      state: TrialState.FINISHED,
      timeLeft: 0,
      metrics: this.results
    });

    this.render();
  }

  showOverlay(text) {
    this.overlay.textContent = text;
    this.overlay.classList.remove("hidden");
  }

  hideOverlay() {
    this.overlay.classList.add("hidden");
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawArena(ctx);
    this.drawTarget(ctx);
    this.drawPointer(ctx);

    if (this.results) {
      this.drawResultBanner(ctx);
    }
  }

  drawArena(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      CONFIG.canvas.margin,
      CONFIG.canvas.margin,
      CONFIG.canvas.width - CONFIG.canvas.margin * 2,
      CONFIG.canvas.height - CONFIG.canvas.margin * 2
    );
    ctx.restore();
  }

  drawTarget(ctx) {
    ctx.save();

    ctx.beginPath();
    ctx.fillStyle = CONFIG.colors.targetRing;
    ctx.arc(
      this.target.x,
      this.target.y,
      CONFIG.target.visibleRingRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = CONFIG.colors.target;
    ctx.arc(
      this.target.x,
      this.target.y,
      CONFIG.target.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  drawPointer(ctx) {
    ctx.save();

    ctx.beginPath();
    ctx.fillStyle = this.pointer.inside
      ? CONFIG.colors.text
      : CONFIG.colors.danger;
    ctx.arc(
      this.pointer.x,
      this.pointer.y,
      CONFIG.cursor.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  drawResultBanner(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
    ctx.fillRect(20, 20, 320, 108);

    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("ผลการทดสอบ", 36, 52);

    ctx.font = "16px sans-serif";
    ctx.fillText(
      `Time on Target: ${this.results.timeOnTargetPct.toFixed(2)}%`,
      36,
      82
    );
    ctx.fillText(`RMSE: ${this.results.rmse.toFixed(2)} px`, 36, 108);
    ctx.restore();
  }
}