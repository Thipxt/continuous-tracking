export class CustomPathManager {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.points = [];
    this.isDrawing = false;
    this.loop = true;
    this.speed = 180;
    this.autoClose = true;
  }

  startDrawing() {
    this.isDrawing = true;
    this.points = [];
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  clear() {
    this.points = [];
    this.isDrawing = false;
  }

  addPoint(x, y) {
    const last = this.points[this.points.length - 1];
    if (!last) {
      this.points.push({ x, y });
      return;
    }

    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= 4) {
      this.points.push({ x, y });
    }
  }

  hasValidPath() {
    return this.points.length >= 2;
  }

  getRenderPoints() {
    if (!this.hasValidPath()) return [...this.points];

    const pts = [...this.points];
    if (this.autoClose) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        pts.push({ x: first.x, y: first.y });
      }
    }

    return pts;
  }

  exportPath() {
    return JSON.stringify(
      {
        version: 1,
        type: "custom_path",
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight,
        loop: this.loop,
        autoClose: this.autoClose,
        speed: this.speed,
        points: this.points
      },
      null,
      2
    );
  }

  importPath(jsonText) {
    const parsed = JSON.parse(jsonText);

    if (
      !parsed ||
      parsed.type !== "custom_path" ||
      !Array.isArray(parsed.points) ||
      parsed.points.length < 2
    ) {
      throw new Error("Invalid custom path data");
    }

    const srcW = parsed.canvasWidth || this.canvasWidth;
    const srcH = parsed.canvasHeight || this.canvasHeight;

    const scaleX = this.canvasWidth / srcW;
    const scaleY = this.canvasHeight / srcH;

    this.loop = parsed.loop !== undefined ? Boolean(parsed.loop) : true;
    this.autoClose = parsed.autoClose !== undefined ? Boolean(parsed.autoClose) : true;
    this.speed = Number(parsed.speed) || 180;

    this.points = parsed.points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));

    this.isDrawing = false;
  }

  getTraversalPoints() {
    return this.getRenderPoints();
  }

  getTotalLength() {
    const pts = this.getTraversalPoints();
    if (pts.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  }

  getPointAtDistance(distance) {
    const pts = this.getTraversalPoints();

    if (pts.length === 0) return null;
    if (pts.length === 1) return pts[0];

    const totalLength = this.getTotalLength();
    if (totalLength <= 0) return pts[0];

    let d = distance;

    if (this.loop) {
      d = ((d % totalLength) + totalLength) % totalLength;
    } else {
      d = Math.max(0, Math.min(totalLength, d));
    }

    let accumulated = 0;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);

      if (accumulated + segLen >= d) {
        const t = segLen === 0 ? 0 : (d - accumulated) / segLen;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        };
      }

      accumulated += segLen;
    }

    return pts[pts.length - 1];
  }
}