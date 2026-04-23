export class HUD {
  constructor(root) {
    this.root = root;
    this.render({
      state: "idle",
      timeLeft: 0,
      metrics: null,
      seedInfo: "-",
      seedMode: "random"
    });
  }

  render({ state, timeLeft, metrics, seedInfo = "-", seedMode = "random" }) {
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

      <div class="seed-card">
        <div class="seed-label">Seed ที่ใช้งาน</div>
        <div class="seed-row">
          <div class="seed-value">${seedInfo}</div>
        </div>
        <div class="seed-mode">โหมด: ${seedMode === "fixed" ? "Fixed Seed" : "Random"}</div>
      </div>

      ${
        metrics
          ? `
            <div class="result-panel">
              <div class="result-header">
                <h3>ผลการทดสอบ</h3>
                <div class="result-badge">Completed</div>
              </div>

              <div class="result-grid">
                <div class="result-item">
                  <div class="result-item-label">Time on Target</div>
                  <div class="result-item-value">${metrics.timeOnTargetPct.toFixed(2)}%</div>
                </div>

                <div class="result-item">
                  <div class="result-item-label">Mean Error</div>
                  <div class="result-item-value">${metrics.meanError.toFixed(2)} px</div>
                </div>

                <div class="result-item">
                  <div class="result-item-label">RMSE</div>
                  <div class="result-item-value">${metrics.rmse.toFixed(2)} px</div>
                </div>

                <div class="result-item">
                  <div class="result-item-label">Max Error</div>
                  <div class="result-item-value">${metrics.maxError.toFixed(2)} px</div>
                </div>

                <div class="result-item">
                  <div class="result-item-label">On Target Time</div>
                  <div class="result-item-value">${metrics.onTargetTime.toFixed(2)} s</div>
                </div>

                <div class="result-item">
                  <div class="result-item-label">Total Time</div>
                  <div class="result-item-value">${metrics.totalTime.toFixed(2)} s</div>
                </div>
              </div>
            </div>
          `
          : `
            <div class="result-panel">
              <div class="result-header">
                <h3>ผลการทดสอบ</h3>
                <div class="result-badge">Waiting</div>
              </div>
              <div class="status-note">ยังไม่มีผลลัพธ์ เริ่มการทดสอบเพื่อบันทึกคะแนน</div>
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