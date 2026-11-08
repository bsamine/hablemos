// AudioWorklet: converts mic audio to 16 kHz 16-bit PCM chunks (~100 ms) for Gemini Live.
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.acc = 0; // fractional position for resampling
    this.sum = 0;
    this.count = 0;
    this.out = new Int16Array(1600);
    this.len = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.sum += ch[i];
      this.count++;
      this.acc += 1;
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.sum / this.count));
        this.sum = 0;
        this.count = 0;
        this.out[this.len++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.len === this.out.length) {
          this.port.postMessage(this.out.buffer.slice(0));
          this.len = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-recorder", PcmRecorder);
