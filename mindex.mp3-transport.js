(() => {
  "use strict";
  function parseMp3(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 10) throw Error("Invalid MP3 input");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offsets = [], sizes = [];
    let p = 0, sampleRate = 0, samples = 0;
    if (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) {
      p = 10;
      for (let j = 6; j < 10; j++) p += (bytes[j] & 127) * 2 ** (7 * (9 - j));
      if (bytes[5] & 16) p += 10;
    }
    while (p + 4 <= bytes.length) {
      const h = view.getUint32(p), version = h >>> 19 & 3, layer = h >>> 17 & 3, br = h >>> 12 & 15, sr = h >>> 10 & 3;
      if (h >>> 21 !== 2047 || version === 1 || layer !== 1 || !br || br === 15 || sr === 3) break;
      const rate = [ 44100, 48e3, 32e3 ][sr] / (version === 3 ? 1 : version === 2 ? 2 : 4), spf = version === 3 ? 1152 : 576;
      const kb = (version === 3 ? [ 0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320 ] : [ 0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160 ])[br];
      const size = Math.floor((version === 3 ? 144e3 : 72e3) * kb / rate) + (h >>> 9 & 1);
      if (p + size > bytes.length) throw Error("Truncated MP3 frame");
      if (sampleRate && (sampleRate !== rate || samples !== spf)) throw Error("Mixed MP3 frame rates");
      sampleRate = rate;
      samples = spf;
      offsets.push(p);
      sizes.push(size);
      p += size;
    }
    if (offsets.length < 12) throw Error("Unsupported MP3 stream");
    if (p !== bytes.length && !(bytes.length - p === 128 && bytes[p] === 84 && bytes[p + 1] === 65 && bytes[p + 2] === 71)) throw Error("Unrecognized MP3 trailing frames");
    let metadataFrames = 0, delay = 0, padding = 0;
    const f = offsets[0], h = view.getUint32(f), mono = (h >>> 6 & 3) === 3, version = h >>> 19 & 3;
    const x = f + 4 + (h >>> 16 & 1 ? 0 : 2) + (version === 3 ? mono ? 17 : 32 : mono ? 9 : 17);
    const text = (p, n) => String.fromCharCode(...bytes.subarray(p, p + n));
    if (x + 8 > f + sizes[0]) throw Error("Invalid MP3 header");
    if ([ "Xing", "Info" ].includes(text(x, 4))) {
      metadataFrames = 1;
      const flags = view.getUint32(x + 4);
      let q = x + 8;
      if (flags & 1) q += 4;
      if (flags & 2) q += 4;
      if (flags & 4) q += 100;
      if (flags & 8) q += 4;
      if (q + 24 <= f + sizes[0] && /^(LAME|Lavc|Lavf)/.test(text(q, 9))) {
        const v = bytes[q + 21] * 65536 + bytes[q + 22] * 256 + bytes[q + 23];
        delay = v >>> 12;
        padding = v & 4095;
      }
    }
    if (!metadataFrames) throw Error("MP3 timing metadata unavailable");
    const totalSamples = (offsets.length - metadataFrames) * samples - delay - padding;
    if (totalSamples <= 0) throw Error("Invalid MP3 duration");
    return {
      bytes: bytes,
      offsets: Uint32Array.from(offsets),
      sampleRate: sampleRate,
      samples: samples,
      metadataFrames: metadataFrames,
      delay: delay,
      padding: padding,
      totalSamples: totalSamples,
      duration: totalSamples / sampleRate,
      end: p
    };
  }
  function measureAlignment(reference, decoded, nominal, start, radius) {
    const size = 4096;
    function correlation(position, offset = 0) {
      if (position + offset < 0 || position + offset + size > reference.length || start + offset + size > decoded.length) return -1;
      let dot = 0, left = 0, right = 0;
      for (let k = 0; k < size; k++) {
        const a = decoded[start + offset + k], b = reference[position + offset + k];
        dot += a * b; left += a * a; right += b * b;
      }
      return dot / Math.sqrt(left * right + 1e-30);
    }
    let score = -1, decoderLag = 0;
    for (let lag = -radius; lag <= radius; lag++) {
      const value = correlation(nominal - lag);
      if (value > score) { score = value; decoderLag = lag; }
    }
    return { score, decoderLag, validationScore: correlation(nominal - decoderLag, size) };
  }
  class IndexedMp3 {
    constructor(index, context) {
      this.index = index;
      this.context = context;
      this.cache = new Map;
    }
    async raw(start, end) {
      const i = this.index, lo = i.offsets[start], hi = end < i.offsets.length ? i.offsets[end] : i.end;
      return this.context.decodeAudioData(i.bytes.slice(lo, hi).buffer);
    }
    async prepare() {
      const i = this.index, sr = this.context.sampleRate, ratio = sr / i.sampleRate;
      this.chunkSeconds = 20;
      const end = Math.min(i.offsets.length, Math.ceil((22 * i.sampleRate + i.delay) / i.samples) + i.metadataFrames);
      const reference = await this.raw(0, end), ref = reference.getChannelData(0);
      let peak = -1, at = 0;
      for (let p = sr; p + sr < Math.min(ref.length, 20 * sr); p += 2048) {
        let power = 0;
        for (let k = 0; k < 1024; k++) power += ref[p + k] ** 2;
        if (power > peak) {
          peak = power;
          at = p;
        }
      }
      if (peak < 1e-9) throw Error("MP3 calibration needs a non-silent window");
      const frame = Math.max(1, Math.floor(((at - sr) / ratio + i.metadataFrames * i.samples + i.delay) / i.samples));
      const raw = await this.raw(frame, Math.min(i.offsets.length, frame + Math.ceil(4 * i.sampleRate / i.samples))), a = raw.getChannelData(0), u = Math.round(sr);
      const nominal = Math.round((frame * i.samples - i.metadataFrames * i.samples - i.delay) * ratio) + u;
      // Header-bearing and raw-frame decoders can trim their leading samples
      // differently. Search both directions, then verify a separate window.
      // The range derives from MPEG frame/encoder padding, not browser identity.
      const searchRadius = Math.ceil((i.metadataFrames * i.samples + i.delay + 2 * i.samples) * ratio);
      const alignment = measureAlignment(ref, a, nominal, u, searchRadius);
      const diagnostics = {
        ...alignment, searchRadius, sampleRate: sr, sourceSampleRate: i.sampleRate,
        referenceFrames: reference.length, rawFrames: raw.length,
        referenceSampleRate: reference.sampleRate, rawSampleRate: raw.sampleRate,
        metadataFrames: i.metadataFrames, encoderDelay: i.delay, frame
      };
      if (alignment.score < .995 || alignment.validationScore < .995) {
        throw Error("MP3 decoder alignment could not be verified: " + JSON.stringify(diagnostics));
      }
      this.prefix = (i.metadataFrames * i.samples + i.delay) * ratio + alignment.decoderLag;
      this.calibration = diagnostics;
      this.first = reference;
      return this;
    }
    async chunk(number) {
      if (this.cache.has(number)) return this.cache.get(number);
      const promise = this.decodeChunk(number);
      this.cache.set(number, promise);
      while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
      try {
        return await promise;
      } catch (e) {
        this.cache.delete(number);
        throw e;
      }
    }
    async decodeChunk(number) {
      const i = this.index, sr = this.context.sampleRate, start = Math.round(number * this.chunkSeconds * sr), end = Math.min(Math.round(i.duration * sr), Math.round((number + 1) * this.chunkSeconds * sr));
      if (end <= start) throw Error("MP3 chunk out of range");
      let decoded, base;
      if (number === 0) {
        decoded = this.first;
        base = 0;
      } else {
        const first = Math.max(1, Math.floor((start + this.prefix) * i.sampleRate / sr / i.samples) - 8), last = Math.min(i.offsets.length, Math.ceil((end + this.prefix) * i.sampleRate / sr / i.samples) + 8);
        decoded = await this.raw(first, last);
        base = Math.round(first * i.samples * sr / i.sampleRate - this.prefix);
      }
      const offset = start - base;
      if (offset < 0 || offset + end - start > decoded.length) throw Error("MP3 decoded interval incomplete");
      const buffer = this.context.createBuffer(decoded.numberOfChannels, end - start, sr);
      for (let c = 0; c < buffer.numberOfChannels; c++) buffer.copyToChannel(decoded.getChannelData(c).subarray(offset, offset + end - start), c);
      return {
        buffer: buffer,
        start: start / sr,
        end: end / sr
      };
    }
  }
  globalThis.MindexMp3Index = {
    parse: parseMp3,
    measureAlignment,
    IndexedMp3: IndexedMp3
  };
})();

// Long VBR MP3 files can report a successful native seek while playing a
// different frame. Decode bounded windows; never rewrite the encoded asset.
(() => {
  "use strict";
  let context;
  function audioContext() {
    return context ||= new AudioContext({
      sampleRate: 48e3
    });
  }
  const abortError = () => new DOMException("Playback superseded", "AbortError");
  class Transport {
    constructor(decoder, audio) {
      this.decoder = decoder;
      this.audio = audio;
      this.context = decoder.context;
      this.output = this.context.createGain();
      this.output.connect(this.context.destination);
      this.position = 0;
      this.paused = true;
      this.seeking = false;
      this.ended = false;
      this.serial = 0;
      this.nodes = [];
      this.timer = null;
    }
    event(name) {
      this.audio.dispatchEvent(new Event(name));
    }
    get duration() {
      return this.decoder.index.duration;
    }
    get currentTime() {
      return this.paused || this.seeking ? this.position : Math.min(this.duration, this.position + Math.max(0, this.context.currentTime - this.started));
    }
    volume() {
      this.output.gain.value = this.audio.muted ? 0 : this.audio.volume;
    }
    cancel() {
      this.serial++;
      clearInterval(this.timer);
      this.timer = null;
      for (const node of this.nodes) {
        node.onended = null;
        try {
          node.stop();
        } catch {}
        node.disconnect();
      }
      this.nodes = [];
    }
    pause() {
      const active = !this.paused;
      this.position = this.currentTime;
      this.cancel();
      this.paused = true;
      this.seeking = false;
      if (active) this.event("pause");
    }
    async seek(value) {
      const running = !this.paused;
      this.cancel();
      this.position = Math.min(this.duration, Math.max(0, value));
      this.seeking = true;
      this.ended = false;
      this.event("seeking");
      if (running) return this.play();
      this.seeking = false;
      this.event("timeupdate");
      this.event("seeked");
    }
    async play() {
      if (!this.paused && !this.seeking && this.timer) return;
      if (this.position >= this.duration) this.position = 0;
      this.cancel();
      const token = this.serial;
      this.paused = false;
      const first = Math.floor(this.position / this.decoder.chunkSeconds);
      try {
        await this.decoder.chunk(first);
        if (token !== this.serial) throw abortError();
        this.volume();
        this.started = this.context.currentTime + .025;
        let next = first, scheduledUntil = this.position;
        const schedule = async () => {
          const number = next++;
          if (number * this.decoder.chunkSeconds >= this.duration) return;
          const part = await this.decoder.chunk(number);
          if (token !== this.serial) return;
          const from = Math.max(this.position, part.start), when = this.started + from - this.position;
          if (when < this.context.currentTime - .01) throw Error("Audio buffer was not ready in time");
          const node = this.context.createBufferSource();
          node.buffer = part.buffer;
          node.connect(this.output);
          this.nodes.push(node);
          node.onended = () => {
            node.disconnect();
            this.nodes = this.nodes.filter(n => n !== node);
          };
          node.start(Math.max(this.context.currentTime, when), from - part.start, part.end - from);
          scheduledUntil = part.end;
        };
        await schedule();
        if (token !== this.serial) throw abortError();
        this.seeking = false;
        this.event("seeked");
        this.event("playing");
        this.event("timeupdate");
        let loading = false;
        this.timer = setInterval(() => {
          this.volume();
          this.event("timeupdate");
          if (this.currentTime >= this.duration) {
            this.position = this.duration;
            this.cancel();
            this.paused = true;
            this.ended = true;
            if (this.audio.loop) {
              this.position = 0;
              this.ended = false;
              this.play().catch(e => this.fail(e));
            } else this.event("ended");
          } else if (!loading && scheduledUntil < this.duration && scheduledUntil - this.currentTime < 10) {
            loading = true;
            schedule().catch(e => { if (token === this.serial) this.fail(e); }).finally(() => {
              loading = false;
            });
          }
        }, 50);
        // Predecode the next bounded window while the current one plays.
                if ((first + 1) * this.decoder.chunkSeconds < this.duration) this.decoder.chunk(first + 1).catch(() => {});
      } catch (error) {
        if (token === this.serial) {
          this.paused = true;
          this.seeking = false;
        }
        throw error;
      }
    }
    fail(error) {
      this.pause();
      this.failure = error;
      this.event("error");
    }
    dispose() {
      this.pause();
      this.output.disconnect();
      this.decoder.cache.clear();
    }
  }
  function attach(audio) {
    if (!globalThis.AudioContext || !globalThis.fetch || audio.mindexPreciseAudio) return audio;
    const proto = HTMLMediaElement.prototype;
    const properties = Object.fromEntries([ "currentTime", "duration", "paused", "ended", "seeking", "error" ].map(k => [ k, Object.getOwnPropertyDescriptor(proto, k) ]));
    if (Object.values(properties).some(p => !p?.get)) return audio;
    const nativePlay = audio.play.bind(audio), nativePause = audio.pause.bind(audio);
    let backend = null, job = null, source = "", controller = null, generation = 0, playSerial = 0, enabled = false;
    const native = name => properties[name].get.call(audio);
    const active = () => backend && source === audio.getAttribute("src");
    function reset() {
      generation++;
      playSerial++;
      controller?.abort();
      controller = null;
      job = null;
      backend?.dispose();
      backend = null;
      source = "";
    }
    function prepare() {
      const src = audio.getAttribute("src") || "";
      if (source !== src && source) reset();
      // Short clips and other codecs retain their existing native transport.
            if (!/\.mp3(?:[?#]|$)/i.test(src) || !(native("duration") >= 600)) return null;
      if (job) return job;
      if (!native("paused")) return null;
      source = src;
      const token = generation;
      controller = new AbortController;
      job = (async () => {
        const response = await fetch(src, {
          signal: controller.signal
        });
        if (!response.ok) throw Error("Audio download failed");
        if (Number(response.headers.get("content-length")) > 128 * 1024 * 1024) throw Error("Audio exceeds accurate playback memory limit");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 128 * 1024 * 1024) throw Error("Audio exceeds accurate playback memory limit");
        const index = MindexMp3Index.parse(bytes);
        const decoder = await new MindexMp3Index.IndexedMp3(index, audioContext()).prepare();
        if (token !== generation || src !== audio.getAttribute("src")) throw abortError();
        const position = native("currentTime");
        nativePause();
        backend = new Transport(decoder, audio);
        backend.position = position;
        audio.dispatchEvent(new Event("durationchange"));
        return backend;
      })();
      job.catch(() => {
        if (token === generation && !backend) job = null;
      });
      return job;
    }
    for (const name of Object.keys(properties)) {
      Object.defineProperty(audio, name, {
        configurable: true,
        get() {
          return active() ? name === "error" ? backend.failure ? {
            code: 3,
            message: backend.failure.message
          } : null : backend[name] : native(name);
        },
        ...name === "currentTime" ? {
          set(value) {
            const time = Number(value);
            if (!Number.isFinite(time)) return;
            if (active()) backend.seek(time).catch(e => {
              if (e.name !== "AbortError") backend?.fail(e);
            }); else properties.currentTime.set.call(audio, time);
          }
        } : {}
      });
    }
    audio.play = async () => {
      const src = audio.getAttribute("src") || "";
      if (source && source !== src) reset();
      if (!/\.mp3(?:[?#]|$)/i.test(src) || Number.isFinite(native("duration")) && native("duration") < 600) return nativePlay();
      const token = ++playSerial;
      // Resume within the click activation, before waiting for download/decode.
            const resume = audioContext().resume();
      if (!Number.isFinite(native("duration"))) await new Promise((resolve, reject) => {
        const done = () => {
          clean();
          resolve();
        }, fail = () => {
          clean();
          reject(Error("Audio metadata unavailable"));
        };
        const clean = () => {
          clearTimeout(timer);
          audio.removeEventListener("loadedmetadata", done);
          audio.removeEventListener("error", fail);
        };
        const timer = setTimeout(fail, 3e4);
        audio.addEventListener("loadedmetadata", done);
        audio.addEventListener("error", fail);
      });
      await resume;
      const pending = prepare();
      if (pending) {
        try { await pending; }
        catch (error) {
          if (error.name === "AbortError" || token !== playSerial) throw abortError();
          // Unsupported metadata must not make previously playable media unusable.
          // Keep native behavior, but expose that accurate seeking is unavailable.
          audio.dispatchEvent(new CustomEvent("mindexprecisionunavailable"));
        }
      }
      if (token !== playSerial) throw abortError();
      return active() ? backend.play() : nativePlay();
    };
    audio.pause = () => {
      playSerial++;
      if (active()) backend.pause(); else nativePause();
    };
    audio.addEventListener("loadedmetadata", () => {
      if (enabled) prepare();
    });
    audio.addEventListener("emptied", () => {
      if (source !== audio.getAttribute("src")) reset();
    });
    audio.addEventListener("volumechange", () => backend?.volume());
    Object.defineProperty(audio, "mindexPreciseAudio", {
      value: {
        prepare: prepare,
        activate() {
          enabled = true;
          prepare();
        },
        get transport() {
          return backend;
        }
      }
    });
    return audio;
  }
  globalThis.MindexPreciseAudio = {
    attach: attach
  };
})();
