export class HUD {
  constructor(root) {
    this.root = root;
    this.render({
      state: "idle",
      timeLeft: 0,
      metrics: null
    });
  }

  render({ state, timeLeft, metrics }) {
    this.root.innerHTML = `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">สถานะ</div>
          <div class="metric-value">${this.getStateLabel(state)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">เวลาคงเหลือ</div>
          <div class="metric-value">${timeLeft.toFixed(1)}s</div>
        </div>
      </div>

      ${
        metrics
          ? `
          <div class="panel result-block">
            <h3>ผลการทดสอบ</h3>
            <div class="status">Time on Target: <strong>${metrics.timeOnTargetPct.toFixed(2)}%</strong></div>
            <div class="status">Mean Error: <strong>${metrics.meanError.toFixed(2)} px</strong></div>
            <div class="status">RMSE: <strong>${metrics.rmse.toFixed(2)} px</strong></div>
            <div class="status">Max Error: <strong>${metrics.maxError.toFixed(2)} px</strong></div>
            <div class="status">On Target Time: <strong>${metrics.onTargetTime.toFixed(2)} s</strong></div>
          </div>
        `
          : `
          <div class="panel">
            <h3>ผลการทดสอบ</h3>
            <div class="status">ยังไม่มีผลลัพธ์</div>
          </div>
        `
      }
    `;
  }

  getStateLabel(state) {
    const map = {
      idle: "พร้อม",
      countdown: "เตรียม",
      running: "กำลังทดสอบ",
      finished: "เสร็จสิ้น"
    };
    return map[state] || state;
  }
}