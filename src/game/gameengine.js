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
    this.currentSeed = null;
    this.currentSeedMode = "random";
    this.isPointerLocked = false;
    this.unlockRequestedBySystem = false;

    this.bindInput();
    this.render();
  }

  bindInput() {
    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.isPointerLocked;
      this.isPointerLocked = document.pointerLockElement === this.canvas;

      this.canvas.classList.toggle("locked", this.isPointerLocked);

      if (!this.isPointerLocked) {
        this.pointer.rawLastX = null;
        this.pointer.rawLastY = null;
        this.pointer.inside = false;

        const isActiveTrial =
          this.trial &&
          (this.trial.state === TrialState.COUNTDOWN ||
            this.trial.state === TrialState.RUNNING);

        if (wasLocked && isActiveTrial && !this.unlockRequestedBySystem) {
          this.forceFinishFromEscape();
        }

        this.unlockRequestedBySystem = false;
      } else {
        this.pointer.inside = true;
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;

      this.pointer.x += e.movementX * this.pointer.sensitivity;
      this.pointer.y += e.movementY * this.pointer.sensitivity;

      this.pointer.x = clamp(this.pointer.x, 0, CONFIG.canvas.width);
      this.pointer.y = clamp(this.pointer.y, 0, CONFIG.canvas.height);
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mouseenter", (e) => {
      if (this.isPointerLocked) return;

      const { x, y } = this.getCanvasPoint(e);
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.rawLastX = x;
      this.pointer.rawLastY = y;
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isPointerLocked) return;

      const { x: rawX, y: rawY } = this.getCanvasPoint(e);

      this.pointer.x = rawX;
      this.pointer.y = rawY;
      this.pointer.rawLastX = rawX;
      this.pointer.rawLastY = rawY;
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mouseleave", () => {
      if (this.isPointerLocked) return;

      this.pointer.inside = false;
      this.pointer.rawLastX = null;
      this.pointer.rawLastY = null;
    });
  }

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  requestPointerLock() {
    if (this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) {
      this.unlockRequestedBySystem = true;
      document.exitPointerLock();
    }
  }

  start({ durationSec, seed, pattern, seedMode = "random" }) {
    this.stop();

    this.currentSeed = Number(seed) || 1;
    this.currentSeedMode = seedMode;

    this.rng = new SeededRNG(this.currentSeed);
    this.pathGenerator = new PathGenerator(this.rng);

    this.schedule = this.pathGenerator.createSchedule(durationSec, pattern);
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.target.x = CONFIG.canvas.width / 2;
    this.target.y = CONFIG.canvas.height / 2;
    this.target.vx = 0;
    this.target.vy = 0;

    this.pointer.x = CONFIG.canvas.width / 2;
    this.pointer.y = CONFIG.canvas.height / 2;
    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;
    this.pointer.inside = true;

    this.scoring.reset();
    this.results = null;

    this.trial = new TrialManager(durationSec, CONFIG.trial.preCountdownSec);
    this.trial.startCountdown();

    this.lastTimestamp = performance.now();

    this.hud.render({
      state: this.trial.state,
      timeLeft: 0,
      metrics: null,
      seedInfo: this.currentSeed,
      seedMode: this.currentSeedMode
    });

    this.loop(this.lastTimestamp);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reset() {
    this.stop();
    this.exitPointerLock();

    this.results = null;
    this.currentSeed = null;
    this.currentSeedMode = "random";

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

    this.pointer.x = CONFIG.canvas.width / 2;
    this.pointer.y = CONFIG.canvas.height / 2;
    this.pointer.inside = false;
    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;

    this.schedule = [];
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.hud.render({
      state: TrialState.IDLE,
      timeLeft: 0,
      metrics: null,
      seedInfo: "-",
      seedMode: "random"
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

    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;
  }

  getCurrentSeed() {
    return this.currentSeed;
  }

  forceFinishFromEscape() {
    this.stop();

    if (!this.trial) return;

    this.trial.finish();
    this.results = this.scoring.getResults();

    this.hud.render({
      state: TrialState.FINISHED,
      timeLeft: 0,
      metrics: this.results,
      seedInfo: this.currentSeed ?? "-",
      seedMode: this.currentSeedMode
    });

    this.showOverlay("Esc");
    window.setTimeout(() => {
      if (this.trial && this.trial.state === TrialState.FINISHED) {
        this.hideOverlay();
      }
    }, 700);

    this.render();
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
      metrics: this.results,
      seedInfo: this.currentSeed ?? "-",
      seedMode: this.currentSeedMode
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
      metrics: this.results,
      seedInfo: this.currentSeed ?? "-",
      seedMode: this.currentSeedMode
    });

    this.exitPointerLock();
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
    if (!this.pointer.inside) return;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = CONFIG.colors.text;
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
}