import { CONFIG } from "../config";
import type { Point, ScoreResults } from "../types";
import { distance } from "../utils/math";

export class ScoringTracker {
  totalTime = 0;
  onTargetTime = 0;
  distanceTimeIntegral = 0;
  squaredDistanceTimeIntegral = 0;
  samples = 0;
  maxError = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.totalTime = 0;
    this.onTargetTime = 0;
    this.distanceTimeIntegral = 0;
    this.squaredDistanceTimeIntegral = 0;
    this.samples = 0;
    this.maxError = 0;
  }

  update(dt: number, cursor: Point, target: Point): void {
    const d = distance(cursor.x, cursor.y, target.x, target.y);
    const onTargetRadius =
      CONFIG.target.radius * CONFIG.scoring.onTargetRadiusMultiplier;

    this.totalTime += dt;
    this.distanceTimeIntegral += d * dt;
    this.squaredDistanceTimeIntegral += d * d * dt;
    this.samples += 1;
    this.maxError = Math.max(this.maxError, d);

    if (d <= onTargetRadius) {
      this.onTargetTime += dt;
    }
  }

  getResults(): ScoreResults {
    const safeTime = Math.max(this.totalTime, 0.0001);

    const timeOnTargetPct = (this.onTargetTime / safeTime) * 100;
    const meanError = this.distanceTimeIntegral / safeTime;
    const rmse = Math.sqrt(this.squaredDistanceTimeIntegral / safeTime);

    return {
      totalTime: this.totalTime,
      onTargetTime: this.onTargetTime,
      timeOnTargetPct,
      meanError,
      rmse,
      maxError: this.maxError,
      samples: this.samples
    };
  }
}