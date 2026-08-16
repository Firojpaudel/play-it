/**
 * AuraWave Real-Time Audio Canvas Visualizer
 * Renders smooth Spotify-style glowing spectrum & wave bars.
 */

class AudioVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.animationFrameId = null;
    this.isRunning = false;
    this.barCount = 48;
  }

  attach(canvasElement) {
    this.canvas = canvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render() {
    if (!this.isRunning) return;

    if (!this.canvas || !this.ctx) {
      this.animationFrameId = requestAnimationFrame(() => this.render());
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    const player = window.audioPlayer;
    if (!player || !player.analyser || !player.isPlaying) {
      // Idle gentle undulating wave
      this.renderIdleWave(width, height);
      this.animationFrameId = requestAnimationFrame(() => this.render());
      return;
    }

    const bufferLength = player.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    player.analyser.getByteFrequencyData(dataArray);

    const barWidth = (width / this.barCount) - 3;
    let x = 0;

    for (let i = 0; i < this.barCount; i++) {
      const dataIndex = Math.floor((i / this.barCount) * (bufferLength * 0.7));
      const value = dataArray[dataIndex] || 0;
      const barHeight = Math.max(4, (value / 255) * height * 0.85);

      const y = height - barHeight;

      // Spotify Emerald Gradient
      const gradient = this.ctx.createLinearGradient(0, height, 0, y);
      gradient.addColorStop(0, '#1ed760');
      gradient.addColorStop(0.6, '#1db954');
      gradient.addColorStop(1, '#a8ffb2');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      x += barWidth + 3;
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  renderIdleWave(width, height) {
    const time = Date.now() * 0.003;
    const barWidth = (width / this.barCount) - 3;
    let x = 0;

    for (let i = 0; i < this.barCount; i++) {
      const sinVal = Math.sin(time + (i * 0.2)) * 0.5 + 0.5;
      const barHeight = 4 + (sinVal * 12);
      const y = height - barHeight;

      this.ctx.fillStyle = 'rgba(30, 215, 96, 0.25)';
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
      this.ctx.fill();

      x += barWidth + 3;
    }
  }
}

window.audioVisualizer = new AudioVisualizer(null);
