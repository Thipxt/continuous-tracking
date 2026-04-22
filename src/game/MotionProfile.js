import { CONFIG } from "../config.js";
import { normalize } from "../utils/math.js";

export const MotionType = {
  LINEAR: "linear",
  ZIGZAG: "zigzag",
  SINUSOIDAL: "sinusoidal",
  JITTER: "jitter"
};

export function createMotionSegment({
  type,
  duration,
  speed,
  directionAngle,
  amplitude = 70,
  frequency = 0.3,
  zigzagTurnInterval = 0.4,
  zigzagLateralRatio = 1.15,
  jitterHeadingInterval = 0.24,
  jitterMaxHeadingStepDeg = 18,
  jitterDriftBlend = 0.82,
  rng
}) {
  return {
    type,
    duration,
    speed,
    directionAngle,
    amplitude,
    frequency,
    zigzagTurnInterval,
    zigzagLateralRatio,
    jitterHeadingInterval,
    jitterMaxHeadingStepDeg,
    jitterDriftBlend,
    rng,

    jitterHeadingAngle: directionAngle,
    jitterHeadingTimer: 0
  };
}

export function getVelocityAt(segment, localTime, dt = 0.016) {
  const baseDx = Math.cos(segment.directionAngle);
  const baseDy = Math.sin(segment.directionAngle);

  if (segment.type === MotionType.LINEAR) {
    return {
      x: baseDx * segment.speed,
      y: baseDy * segment.speed
    };
  }

  if (segment.type === MotionType.SINUSOIDAL) {
    const perp = { x: -baseDy, y: baseDx };
    const omega = Math.PI * 2 * segment.frequency;
    const lateralVelocity =
      Math.cos(localTime * omega) *
      omega *
      segment.amplitude *
      CONFIG.motion.sinusoidal.lateralVelocityScale;

    return {
      x: baseDx * segment.speed + perp.x * lateralVelocity,
      y: baseDy * segment.speed + perp.y * lateralVelocity
    };
  }

  if (segment.type === MotionType.ZIGZAG) {
    const cycleIndex = Math.floor(localTime / segment.zigzagTurnInterval);
    const sign = cycleIndex % 2 === 0 ? 1 : -1;
    const perp = { x: -baseDy, y: baseDx };

    const raw = {
      x:
        baseDx * segment.speed +
        perp.x * segment.speed * segment.zigzagLateralRatio * sign,
      y:
        baseDy * segment.speed +
        perp.y * segment.speed * segment.zigzagLateralRatio * sign
    };

    const n = normalize(raw.x, raw.y);
    return {
      x: n.x * segment.speed,
      y: n.y * segment.speed
    };
  }

  if (segment.type === MotionType.JITTER) {
    segment.jitterHeadingTimer += dt;

    if (segment.jitterHeadingTimer >= segment.jitterHeadingInterval) {
      segment.jitterHeadingTimer = 0;

      const maxStepRad = (segment.jitterMaxHeadingStepDeg * Math.PI) / 180;
      const step = (segment.rng.next() * 2 - 1) * maxStepRad;

      const desired = segment.jitterHeadingAngle + step;
      segment.jitterHeadingAngle =
        segment.jitterHeadingAngle * segment.jitterDriftBlend +
        desired * (1 - segment.jitterDriftBlend);
    }

    const jitterDx = Math.cos(segment.jitterHeadingAngle);
    const jitterDy = Math.sin(segment.jitterHeadingAngle);

    const blend = 0.55;
    const mixed = {
      x: baseDx * (1 - blend) + jitterDx * blend,
      y: baseDy * (1 - blend) + jitterDy * blend
    };

    const n = normalize(mixed.x, mixed.y);
    return {
      x: n.x * segment.speed,
      y: n.y * segment.speed
    };
  }

  return { x: 0, y: 0 };
}