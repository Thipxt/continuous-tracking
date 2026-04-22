import { CONFIG } from "../config.js";
import { MotionType, createMotionSegment } from "./MotionProfile.js";

export class PathGenerator {
  constructor(rng, options = {}) {
    this.rng = rng;
    this.options = options;
  }

  createSchedule(durationSec, pattern = "mixed") {
    const segments = [];
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

      const directionAngle = this.rng.range(0, Math.PI * 2);

      const segment = createMotionSegment({
        type,
        duration: Math.min(duration, durationSec - total),
        speed,
        directionAngle,
        amplitude: this.rng.range(
          CONFIG.motion.sinusoidAmplitudeRange[0],
          CONFIG.motion.sinusoidAmplitudeRange[1]
        ),
        frequency: this.rng.range(
          CONFIG.motion.sinusoidFrequencyRange[0],
          CONFIG.motion.sinusoidFrequencyRange[1]
        ),
        zigzagTurnInterval: this.rng.range(
          CONFIG.motion.zigzagTurnIntervalRange[0],
          CONFIG.motion.zigzagTurnIntervalRange[1]
        ),
        jitterScale: CONFIG.motion.jitterNoiseScale,
        rng: this.rng
      });

      segments.push(segment);
      total += segment.duration;
    }

    return segments;
  }

  pickType(pattern, index) {
    if (pattern !== "mixed") return pattern;

    const cycle = [
      MotionType.LINEAR,
      MotionType.ZIGZAG,
      MotionType.SINUSOIDAL,
      MotionType.JITTER
    ];

    return cycle[index % cycle.length];
  }
}