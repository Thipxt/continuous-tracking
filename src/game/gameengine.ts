import { CONFIG } from "../config";
import type { Bounds, Pattern, PointerState, SeedMode, TargetState } from "../types";
import { clamp } from "../utils/math";
import { SeededRNG } from "../utils/rng";
import { PathGenerator } from "./PathGenerator";
import { getVelocityAt } from "./MotionProfile";
import { ScoringTracker } from "./Scoring";
import { TrialManager, TrialState } from "./TrialManager";
import type { HUD } from "../ui/HUD";
import type { CustomPathManager } from "./CustomPathManager";
import type { MotionSegment } from "../types";

type StartArgs = {
  durationSec: number;
  seed: number;
  pattern: Pattern;
  seedMode?: SeedMode;
  customPathManager?: CustomPathManager | null;
};

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hud: HUD;
  overlay: HTMLElement;

  bounds: Bounds;
  pointer: PointerState;
  target: TargetState;

  trial: TrialManager | null;
  scoring: ScoringTracker;
  schedule: MotionSegment[];
  currentSegmentIndex: number;
  currentSegmentElapsed: number;
  lastTimestamp: number;
  rafId: number | null;
  results: ReturnType<ScoringTracker["getResults"]> | null;

  currentSeed: number | null;
  currentSeedMode: SeedMode;
  isPointerLocked: boolean;
  unlockRequestedBySystem: boolean;

  currentPattern: Pattern;
  previewPattern: Pattern;
  customPathManager: CustomPathManager | null;
  customPathDistance: number;

  rng: SeededRNG | null;
  pathGenerator: PathGenerator | null;

  constructor(canvas: HTMLCanvasElement, hud: HUD, overlay: HTMLElement) {
    this.canvas = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get 2D context from canvas");
    }

    this.ctx = ctx;
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

    this.currentPattern = "mixed";
    this.previewPattern = "mixed";
    this.customPathManager = null;
    this.customPathDistance = 0;

    this.rng = null;
    this.pathGenerator = null;

    this.bindInput();
    this.render();
  }

  bindInput(): void {
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

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.isPointerLocked) return;

      this.pointer.x += e.movementX * this.pointer.sensitivity;
      this.pointer.y += e.movementY * this.pointer.sensitivity;

      this.pointer.x = clamp(this.pointer.x, 0, CONFIG.canvas.width);
      this.pointer.y = clamp(this.pointer.y, 0, CONFIG.canvas.height);
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mouseenter", (e: MouseEvent) => {
      if (this.isPointerLocked) return;

      const { x, y } = this.getCanvasPoint(e);
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.rawLastX = x;
      this.pointer.rawLastY = y;
      this.pointer.inside = true;
    });

    this.canvas.addEventListener("mousemove", (e: MouseEvent) => {
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

  getCanvasPoint(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  requestPointerLock(): void {
    if (this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) {
      this.unlockRequestedBySystem = true;
      document.exitPointerLock();
    }
  }

  setPreviewPattern(pattern: Pattern, customPathManager: CustomPathManager | null = null): void {
    this.previewPattern = pattern;
    this.customPathManager = customPathManager;

    const isRunning =
      this.trial &&
      (this.trial.state === TrialState.COUNTDOWN ||
        this.trial.state === TrialState.RUNNING);

    if (!isRunning) {
      if (
        pattern === "custom" &&
        customPathManager &&
        customPathManager.hasValidPath()
      ) {
        const firstPoint = customPathManager.getRenderPoints()[0];
        this.target.x = firstPoint.x;
        this.target.y = firstPoint.y;
      } else {
        this.target.x = CONFIG.canvas.width / 2;
        this.target.y = CONFIG.canvas.height / 2;
      }

      this.target.vx = 0;
      this.target.vy = 0;
    }

    this.render();
  }

  resetForPatternChange(
    pattern: Pattern,
    customPathManager: CustomPathManager | null = null
  ): void {
    this.stop();
    this.exitPointerLock();

    this.results = null;
    this.currentSeed = null;
    this.currentSeedMode = "random";
    this.currentPattern = pattern;
    this.previewPattern = pattern;
    this.customPathManager = customPathManager;
    this.customPathDistance = 0;

    this.trial = new TrialManager(
      CONFIG.trial.defaultDurationSec,
      CONFIG.trial.preCountdownSec
    );
    this.trial.reset();
    this.scoring.reset();

    this.schedule = [];
    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.pointer.x = CONFIG.canvas.width / 2;
    this.pointer.y = CONFIG.canvas.height / 2;
    this.pointer.inside = false;
    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;

    if (
      pattern === "custom" &&
      customPathManager &&
      customPathManager.hasValidPath()
    ) {
      const firstPoint = customPathManager.getRenderPoints()[0];
      this.target.x = firstPoint.x;
      this.target.y = firstPoint.y;
    } else {
      this.target.x = CONFIG.canvas.width / 2;
      this.target.y = CONFIG.canvas.height / 2;
    }

    this.target.vx = 0;
    this.target.vy = 0;

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

  start({
    durationSec,
    seed,
    pattern,
    seedMode = "random",
    customPathManager = null
  }: StartArgs): void {
    this.stop();

    this.currentSeed = Number(seed) || 1;
    this.currentSeedMode = seedMode;
    this.currentPattern = pattern;
    this.previewPattern = pattern;
    this.customPathManager = customPathManager;
    this.customPathDistance = 0;

    this.rng = new SeededRNG(this.currentSeed);
    this.pathGenerator = new PathGenerator(this.rng);

    if (pattern !== "custom") {
      this.schedule = this.pathGenerator.createSchedule(durationSec, pattern);
    } else {
      this.schedule = [];
    }

    this.currentSegmentIndex = 0;
    this.currentSegmentElapsed = 0;

    this.target.x = CONFIG.canvas.width / 2;
    this.target.y = CONFIG.canvas.height / 2;
    this.target.vx = 0;
    this.target.vy = 0;

    if (
      pattern === "custom" &&
      this.customPathManager &&
      this.customPathManager.hasValidPath()
    ) {
      const firstPoint = this.customPathManager.getRenderPoints()[0];
      this.target.x = firstPoint.x;
      this.target.y = firstPoint.y;
    }

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

    this.render();
    this.loop(this.lastTimestamp);
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reset(): void {
    this.stop();
    this.exitPointerLock();

    this.results = null;
    this.currentSeed = null;
    this.currentSeedMode = "random";
    this.currentPattern = "mixed";
    this.previewPattern = "mixed";
    this.customPathDistance = 0;

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

  setSensitivity(value: string | number): void {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;

    this.pointer.sensitivity = Math.max(
      CONFIG.input.minSensitivity,
      Math.min(CONFIG.input.maxSensitivity, numeric)
    );

    this.pointer.rawLastX = null;
    this.pointer.rawLastY = null;
  }

  getCurrentSeed(): number | null {
    return this.currentSeed;
  }

  forceFinishFromEscape(): void {
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

  loop(timestamp: number): void {
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

  update(dt: number): void {
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

      if (
        this.currentPattern === "custom" &&
        this.customPathManager &&
        this.customPathManager.hasValidPath()
      ) {
        const firstPoint = this.customPathManager.getRenderPoints()[0];
        this.target.x = firstPoint.x;
        this.target.y = firstPoint.y;
        this.customPathDistance = 0;
      }
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

  updateTarget(dt: number): void {
    if (
      this.currentPattern === "custom" &&
      this.customPathManager?.hasValidPath()
    ) {
      this.customPathDistance += this.customPathManager.speed * dt;

      const point = this.customPathManager.getPointAtDistance(this.customPathDistance);
      if (point) {
        this.target.x = point.x;
        this.target.y = point.y;
      }
      return;
    }

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

  finishRun(): void {
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

  showOverlay(text: string): void {
    this.overlay.textContent = text;
    this.overlay.classList.remove("hidden");
  }

  hideOverlay(): void {
    this.overlay.classList.add("hidden");
  }

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawArena(ctx);
    this.drawCustomPath(ctx);
    this.drawTarget(ctx);
    this.drawPointer(ctx);
  }

  drawArena(ctx: CanvasRenderingContext2D): void {
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

  drawCustomPath(ctx: CanvasRenderingContext2D): void {
    const shouldShowCustomPath =
      this.previewPattern === "custom" &&
      this.customPathManager &&
      this.customPathManager.points.length >= 2;

    if (!shouldShowCustomPath || !this.customPathManager) return;

    const points = this.customPathManager.getRenderPoints();

    ctx.save();
    ctx.strokeStyle = "rgba(96, 165, 250, 0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();

    ctx.fillStyle = "rgba(96, 165, 250, 0.95)";
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawTarget(ctx: CanvasRenderingContext2D): void {
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

  drawPointer(ctx: CanvasRenderingContext2D): void {
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