import type { Bounds, Point, Velocity } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

export function normalize(x: number, y: number): Point {
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function reflectInsideBounds(
  position: Point,
  velocity: Velocity,
  bounds: Bounds
): { position: Point; velocity: Velocity } {
  let { x, y } = position;
  let { x: vx, y: vy } = velocity;

  if (x < bounds.minX) {
    x = bounds.minX;
    vx *= -1;
  } else if (x > bounds.maxX) {
    x = bounds.maxX;
    vx *= -1;
  }

  if (y < bounds.minY) {
    y = bounds.minY;
    vy *= -1;
  } else if (y > bounds.maxY) {
    y = bounds.maxY;
    vy *= -1;
  }

  return {
    position: { x, y },
    velocity: { x: vx, y: vy }
  };
}