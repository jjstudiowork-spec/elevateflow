/**
 * ltcDecoder.js — SMPTE LTC biphase-mark decoder
 *
 * LTC is biphase-mark encoded: a transition occurs at every bit boundary,
 * plus an extra transition in the middle of a bit cell for a '1'.
 *
 * One frame = 80 bits. Sync word = bits 64-79 = 0011111111111101
 *
 * Usage:
 *   const dec = new LTCDecoder(sampleRate, fps);
 *   dec.onFrame = ({ h, m, s, f, df, string }) => { ... };
 *   dec.process(float32Array); // call from ScriptProcessor.onaudioprocess
 */

export class LTCDecoder {
  constructor(sampleRate = 48000, fps = 29.97) {
    this.sampleRate = sampleRate;
    this.fps        = fps;
    this.onFrame    = null;
    this._reset();
  }

  setFPS(fps) {
    this.fps = fps;
    this._reset();
  }

  _reset() {
    // Expected samples per half-bit
    this._half = this.sampleRate / (this.fps * 80 * 2);
    this._tol  = this._half * 0.45;

    // Shift register: b[0] = oldest bit (bit 0 of frame), b[79] = newest
    this._bits     = new Uint8Array(80);
    this._filled   = 0;

    this._lastSign = 0;
    this._count    = 0;   // samples since last crossing
    this._phase    = 0;   // 0 = at boundary, 1 = inside bit cell
  }

  process(samples) {
    const half = this._half;
    const tol  = this._tol;

    for (let i = 0; i < samples.length; i++) {
      const sign = samples[i] >= 0 ? 1 : -1;

      if (this._lastSign !== 0 && sign !== this._lastSign) {
        // Zero crossing
        const d = this._count;
        this._count = 0;

        if (d >= half - tol && d <= half + tol) {
          // ~half-period edge
          if (this._phase === 0) {
            // Clock edge — start of new bit, no middle yet (assume 0)
            this._phase = 1;
          } else {
            // Middle-of-cell edge — this bit is 1
            this._addBit(1);
            this._phase = 0;
          }
        } else if (d >= 2 * half - tol * 2 && d <= 2 * half + tol * 2) {
          // ~full-period edge — no middle transition, bit is 0
          // This full-period edge IS also the clock edge of the next bit
          this._addBit(0);
          this._phase = 1; // we're already one half into the next bit
        } else {
          // Out of range — lost sync
          this._phase = 0;
        }
      }

      this._count++;
      this._lastSign = sign;
    }
  }

  _addBit(bit) {
    // Shift register: shift left, put newest at end
    const b = this._bits;
    for (let i = 0; i < 79; i++) b[i] = b[i + 1];
    b[79] = bit;

    this._filled = Math.min(this._filled + 1, 80);
    if (this._filled === 80) this._checkSync();
  }

  _checkSync() {
    // Sync word occupies bits 64-79 of the frame.
    // In our shift register (b[0]=oldest, b[79]=newest),
    // the 80 frame bits map directly: b[n] = frame bit n.
    // Sync word bits 64-79: 0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1
    // As uint16 (b[64]=lsb): 0xBFFC
    const b = this._bits;
    let sw = 0;
    for (let i = 0; i < 16; i++) sw |= (b[64 + i] << i);
    if (sw === 0xBFFC) this._decode();
  }

  _decode() {
    const b = this._bits;
    const n = (start, len) => {
      let v = 0;
      for (let i = 0; i < len; i++) v |= (b[start + i] << i);
      return v;
    };

    // SMPTE 12M correct bit layout (user bits occupy bits 4-7, 12-15, 20-23, etc.)
    //  0- 3  frames units (BCD)
    //  4- 7  user bits 1
    //  8- 9  frames tens
    //  10    drop-frame flag
    //  11    color frame flag
    //  12-15 user bits 2
    //  16-19 seconds units (BCD)
    //  20-23 user bits 3
    //  24-26 seconds tens
    //  27    biphase mark polarity correction
    //  28-31 user bits 4
    //  32-35 minutes units (BCD)
    //  36-39 user bits 5
    //  40-42 minutes tens
    //  43    binary group flag 0
    //  44-47 user bits 6
    //  48-51 hours units (BCD)
    //  52-55 user bits 7
    //  56-57 hours tens
    //  58-59 binary group flags
    //  60-63 user bits 8
    //  64-79 sync word 0011111111111101
    const fu  = n(0,  4);
    const ft  = n(8,  2);
    const df  = b[10];
    const su  = n(16, 4);
    const st  = n(24, 3);
    const mu  = n(32, 4);
    const mt  = n(40, 3);
    const hru = n(48, 4);
    const hrt = n(56, 2);

    const f = ft * 10 + fu;
    const s = st * 10 + su;
    const m = mt * 10 + mu;
    const h = hrt * 10 + hru;

    // Sanity check
    if (f > 29 || s > 59 || m > 59 || h > 23) return;

    const pad = v => String(v).padStart(2, '0');
    this.onFrame?.({
      h, m, s, f, df: !!df,
      string: `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`,
    });
  }
}