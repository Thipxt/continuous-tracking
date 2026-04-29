import { CONFIG } from "../config";
import type { MotionSegment, MotionTypeValue, Pattern } from "../types";
import type { SeededRNG } from "../utils/rng";
import { MotionType, createMotionSegment } from "./MotionProfile";

export class PathGenerator {
  rng: SeededRNG;
  options: Record<string, unknown>;

  constructor(rng: SeededRNG, options: Record<string, unknown> = {}) {
    this.rng = rng;
    this.options = options;
  }

  createSchedule(durationSec: number, pattern: Pattern = "mixed"): MotionSegment[] {
    const segments: MotionSegment[] = [];
    let total = 0;

    while (total < durationSec) {
      const duration = this.rng.range(
        CONFIG.motion.segmentDurationRangeSec[0],
        CONFIG.motion.segmentDurationRangeSec[1]
      );

      const type = this.pickType(pattern, segments.length);
      const speed = this.rng.range(
        CONFIG.motion.baseSpeedPxPerSec,
        CONFIG.motion.maxSpeedPxPerSec
      );

      const directionAngle = this.pickDirection(type, segments);

      const segment = createMotionSegment({
        type,
        duration: Math.min(duration, durationSec - total),
        speed,
        directionAngle,

        amplitude: this.rng.range(
          CONFIG.motion.sinusoidal.amplitudeRange[0],
          CONFIG.motion.sinusoidal.amplitudeRange[1]
        ),
        frequency: this.rng.range(
          CONFIG.motion.sinusoidal.frequencyRange[0],
          CONFIG.motion.sinusoidal.frequencyRange[1]
        ),

        zigzagTurnInterval: this.rng.range(
          CONFIG.motion.zigzag.turnIntervalRangeSec[0],
          CONFIG.motion.zigzag.turnIntervalRangeSec[1]
        ),
        zigzagLateralRatio: CONFIG.motion.zigzag.lateralRatio,

        jitterHeadingInterval: this.rng.range(
          CONFIG.motion.jitter.headingChangeIntervalRangeSec[0],
          CONFIG.motion.jitter.headingChangeIntervalRangeSec[1]
        ),
        jitterMaxHeadingStepDeg: CONFIG.motion.jitter.maxHeadingStepDeg,
        jitterDriftBlend: CONFIG.motion.jitter.driftBlend,

        rng: this.rng
      });

      segments.push(segment);
      total += segment.duration;
    }

    return segments;
  }

  pickType(pattern: Pattern, index: number): MotionTypeValue {
    if (pattern !== "mixed") return pattern as MotionTypeValue;

    const cycle: MotionTypeValue[] = [
      MotionType.LINEAR,
      MotionType.SINUSOIDAL,
      MotionType.ZIGZAG,
      MotionType.JITTER
    ];

    return cycle[index % cycle.length];
  }

  pickDirection(type: MotionTypeValue, segments: MotionSegment[]): number {
    const right = 0;
    const down = Math.PI / 2;
    const left = Math.PI;
    const up = -Math.PI / 2;

    const axisDirections = [right, down, left, up];
    const diagonalDirections = [
      Math.PI / 4,
      (3 * Math.PI) / 4,
      (-3 * Math.PI) / 4,
      -Math.PI / 4
    ];

    if (type === MotionType.LINEAR) {
      const base = this.rng.pick(axisDirections.concat(diagonalDirections));
      const jitter =
        ((this.rng.next() * 2 - 1) *
          CONFIG.motion.linear.headingJitterDeg *
          Math.PI) /
        180;
      return base + jitter;
    }

    if (type === MotionType.ZIGZAG) {
      return this.rng.pick([right, left, down, up]);
    }

    if (type === MotionType.SINUSOIDAL) {
      return this.rng.pick([right, left]);
    }

    if (type === MotionType.JITTER) {
      if (segments.length > 0) {
        const prev = segments[segments.length - 1].directionAngle;
        const offset = this.rng.pick([
          Math.PI / 6,
          -Math.PI / 6,
          Math.PI / 4,
          -Math.PI / 4
        ]);
        return prev + offset;
      }
      return this.rng.range(0, Math.PI * 2);
    }

    return this.rng.range(0, Math.PI * 2);
  }
}