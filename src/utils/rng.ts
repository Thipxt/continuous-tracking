export class SeededRNG {
  private state: number;

  constructor(seed = 123456789) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    return arr[Math.floor(this.next() * arr.length)];
  }

  sign(): -1 | 1 {
    return this.next() < 0.5 ? -1 : 1;
  }
}