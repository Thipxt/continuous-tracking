export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

export function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function reflectInsideBounds(position, velocity, bounds) {
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