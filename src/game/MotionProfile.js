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
  amplitude = 60,
  frequency = 0.4,
  zigzagTurnInterval = 0.5,
  jitterScale = 24,
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
    jitterScale,
    rng
  };
}

export function getVelocityAt(segment, localTime) {
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
    const wave = Math.sin(localTime * Math.PI * 2 * segment.frequency);
    const lateralSpeed =
      Math.cos(localTime * Math.PI * 2 * segment.frequency) *
      (Math.PI * 2 * segment.frequency) *
      segment.amplitude;

    return {
      x: baseDx * segment.speed + perp.x * lateralSpeed * 0.35,
      y: baseDy * segment.speed + perp.y * lateralSpeed * 0.35
    };
  }

  if (segment.type === MotionType.ZIGZAG) {
    const cycle = Math.floor(localTime / segment.zigzagTurnInterval);
    const sign = cycle % 2 === 0 ? 1 : -1;
    const perp = { x: -baseDy, y: baseDx };

    const v = {
      x: baseDx * segment.speed + perp.x * segment.speed * 0.65 * sign,
      y: baseDy * segment.speed + perp.y * segment.speed * 0.65 * sign
    };

    const n = normalize(v.x, v.y);
    return {
      x: n.x * segment.speed,
      y: n.y * segment.speed
    };
  }

  if (segment.type === MotionType.JITTER) {
    const jitterX = (segment.rng.next() - 0.5) * 2 * segment.jitterScale;
    const jitterY = (segment.rng.next() - 0.5) * 2 * segment.jitterScale;

    const v = {
      x: baseDx * segment.speed + jitterX,
      y: baseDy * segment.speed + jitterY
    };

    const n = normalize(v.x, v.y);
    return {
      x: n.x * segment.speed,
      y: n.y * segment.speed
    };
  }

  return { x: 0, y: 0 };
}