import { Loader as L, FileLoader as M, SRGBColorSpace as A, LinearSRGBColorSpace as v, BufferGeometry as _, BufferAttribute as R, Color as k, Object3D as E, VideoTexture as C, NearestFilter as x, LinearFilter as q, RGBAFormat as D, MeshBasicMaterial as H, Mesh as I } from "three";
const w = /* @__PURE__ */ new WeakMap();
class N extends L {
  constructor(e) {
    super(e), this.decoderPath = "", this.decoderConfig = {}, this.decoderBinary = null, this.decoderPending = null, this.workerLimit = 4, this.workerPool = [], this.workerNextTaskID = 1, this.workerSourceURL = "", this.defaultAttributeIDs = {
      position: "POSITION",
      normal: "NORMAL",
      color: "COLOR",
      uv: "TEX_COORD"
    }, this.defaultAttributeTypes = {
      position: "Float32Array",
      normal: "Float32Array",
      color: "Float32Array",
      uv: "Float32Array"
    };
  }
  setDecoderPath(e) {
    return this.decoderPath = e, this;
  }
  setDecoderConfig(e) {
    return this.decoderConfig = e, this;
  }
  setWorkerLimit(e) {
    return this.workerLimit = e, this;
  }
  load(e, s, t, i) {
    const o = new M(this.manager);
    o.setPath(this.path), o.setResponseType("arraybuffer"), o.setRequestHeader(this.requestHeader), o.setWithCredentials(this.withCredentials), o.load(e, (r) => {
      this.parse(r, s, i);
    }, t, i);
  }
  parse(e, s, t) {
    this.decodeDracoFile(e, s, null, null, A).catch(t);
  }
  decodeDracoFile(e, s, t, i, o = v) {
    const r = {
      attributeIDs: t || this.defaultAttributeIDs,
      attributeTypes: i || this.defaultAttributeTypes,
      useUniqueIDs: !!t,
      vertexColorSpace: o
    };
    return this.decodeGeometry(e, r).then(s);
  }
  decodeGeometry(e, s) {
    const t = JSON.stringify(s);
    if (w.has(e)) {
      const n = w.get(e);
      if (n.key === t)
        return n.promise;
      if (e.byteLength === 0)
        throw new Error(
          "THREE.DRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred."
        );
    }
    let i;
    const o = this.workerNextTaskID++, r = e.byteLength, a = this._getWorker(o, r).then((n) => (i = n, new Promise((l, d) => {
      i._callbacks[o] = { resolve: l, reject: d }, i.postMessage({ type: "decode", id: o, taskConfig: s, buffer: e }, [e]);
    }))).then((n) => this._createGeometry(n.geometry));
    return a.catch(() => !0).then(() => {
      i && o && this._releaseTask(i, o);
    }), w.set(e, {
      key: t,
      promise: a
    }), a;
  }
  _createGeometry(e) {
    const s = new _();
    e.index && s.setIndex(new R(e.index.array, 1));
    for (let t = 0; t < e.attributes.length; t++) {
      const i = e.attributes[t], o = i.name, r = i.array, a = i.itemSize, n = new R(r, a);
      o === "color" && (this._assignVertexColorSpace(n, i.vertexColorSpace), n.normalized = !(r instanceof Float32Array)), s.setAttribute(o, n);
    }
    return s;
  }
  _assignVertexColorSpace(e, s) {
    if (s !== A)
      return;
    const t = new k();
    for (let i = 0, o = e.count; i < o; i++)
      t.fromBufferAttribute(e, i).convertSRGBToLinear(), e.setXYZ(i, t.r, t.g, t.b);
  }
  _loadLibrary(e, s) {
    const t = new M(this.manager);
    return t.setPath(this.decoderPath), t.setResponseType(s), t.setWithCredentials(this.withCredentials), new Promise((i, o) => {
      t.load(e, i, void 0, o);
    });
  }
  preload() {
    return this._initDecoder(), this;
  }
  _initDecoder() {
    if (this.decoderPending)
      return this.decoderPending;
    const e = typeof WebAssembly != "object" || this.decoderConfig.type === "js", s = [];
    return e ? s.push(this._loadLibrary("draco_decoder.js", "text")) : (s.push(this._loadLibrary("draco_wasm_wrapper.js", "text")), s.push(this._loadLibrary("draco_decoder.wasm", "arraybuffer"))), this.decoderPending = Promise.all(s).then((t) => {
      const i = t[0];
      e || (this.decoderConfig.wasmBinary = t[1]);
      const o = U.toString(), r = [
        "/* draco decoder */",
        i,
        "",
        "/* worker */",
        o.substring(o.indexOf("{") + 1, o.lastIndexOf("}"))
      ].join(`
`);
      this.workerSourceURL = URL.createObjectURL(new Blob([r]));
    }), this.decoderPending;
  }
  _getWorker(e, s) {
    return this._initDecoder().then(() => {
      if (this.workerPool.length < this.workerLimit) {
        const i = new Worker(this.workerSourceURL);
        i._callbacks = {}, i._taskCosts = {}, i._taskLoad = 0, i.postMessage({ type: "init", decoderConfig: this.decoderConfig }), i.onmessage = function(o) {
          const r = o.data;
          switch (r.type) {
            case "decode":
              i._callbacks[r.id].resolve(r);
              break;
            case "error":
              i._callbacks[r.id].reject(r);
              break;
            default:
              console.error('THREE.DRACOLoader: Unexpected message, "' + r.type + '"');
          }
        }, this.workerPool.push(i);
      } else
        this.workerPool.sort(function(i, o) {
          return i._taskLoad > o._taskLoad ? -1 : 1;
        });
      const t = this.workerPool[this.workerPool.length - 1];
      return t._taskCosts[e] = s, t._taskLoad += s, t;
    });
  }
  _releaseTask(e, s) {
    e._taskLoad -= e._taskCosts[s], delete e._callbacks[s], delete e._taskCosts[s];
  }
  debug() {
    console.log("Task load: ", this.workerPool.map((e) => e._taskLoad));
  }
  dispose() {
    for (let e = 0; e < this.workerPool.length; ++e)
      this.workerPool[e].terminate();
    return this.workerPool.length = 0, this.workerSourceURL !== "" && URL.revokeObjectURL(this.workerSourceURL), this;
  }
}
function U() {
  let f, e;
  onmessage = function(r) {
    const a = r.data;
    switch (a.type) {
      case "init":
        f = a.decoderConfig, e = new Promise(function(d) {
          f.onModuleLoaded = function(u) {
            d({ draco: u });
          }, DracoDecoderModule(f);
        });
        break;
      case "decode":
        const n = a.buffer, l = a.taskConfig;
        e.then((d) => {
          const u = d.draco, h = new u.Decoder();
          try {
            const c = s(u, h, new Int8Array(n), l), m = c.attributes.map((y) => y.array.buffer);
            c.index && m.push(c.index.array.buffer), self.postMessage({ type: "decode", id: a.id, geometry: c }, m);
          } catch (c) {
            console.error(c), self.postMessage({ type: "error", id: a.id, error: c.message });
          } finally {
            u.destroy(h);
          }
        });
        break;
    }
  };
  function s(r, a, n, l) {
    const d = l.attributeIDs, u = l.attributeTypes;
    let h, c;
    const m = a.GetEncodedGeometryType(n);
    if (m === r.TRIANGULAR_MESH)
      h = new r.Mesh(), c = a.DecodeArrayToMesh(n, n.byteLength, h);
    else if (m === r.POINT_CLOUD)
      h = new r.PointCloud(), c = a.DecodeArrayToPointCloud(n, n.byteLength, h);
    else
      throw new Error("THREE.DRACOLoader: Unexpected geometry type.");
    if (!c.ok() || h.ptr === 0)
      throw new Error("THREE.DRACOLoader: Decoding failed: " + c.error_msg());
    const y = { index: null, attributes: [] };
    for (const S in d) {
      const b = self[u[S]];
      let T, p;
      if (l.useUniqueIDs)
        p = d[S], T = a.GetAttributeByUniqueId(h, p);
      else {
        if (p = a.GetAttributeId(h, r[d[S]]), p === -1)
          continue;
        T = a.GetAttribute(h, p);
      }
      const F = i(r, a, h, S, b, T);
      S === "color" && (F.vertexColorSpace = l.vertexColorSpace), y.attributes.push(F);
    }
    return m === r.TRIANGULAR_MESH && (y.index = t(r, a, h)), r.destroy(h), y;
  }
  function t(r, a, n) {
    const d = n.num_faces() * 3, u = d * 4, h = r._malloc(u);
    a.GetTrianglesUInt32Array(n, u, h);
    const c = new Uint32Array(r.HEAPF32.buffer, h, d).slice();
    return r._free(h), { array: c, itemSize: 1 };
  }
  function i(r, a, n, l, d, u) {
    const h = u.num_components(), m = n.num_points() * h, y = m * d.BYTES_PER_ELEMENT, S = o(r, d), b = r._malloc(y);
    a.GetAttributeDataArrayForAllPoints(n, u, S, y, b);
    const T = new d(r.HEAPF32.buffer, b, m).slice();
    return r._free(b), {
      name: l,
      array: T,
      itemSize: h
    };
  }
  function o(r, a) {
    switch (a) {
      case Float32Array:
        return r.DT_FLOAT32;
      case Int8Array:
        return r.DT_INT8;
      case Int16Array:
        return r.DT_INT16;
      case Int32Array:
        return r.DT_INT32;
      case Uint8Array:
        return r.DT_UINT8;
      case Uint16Array:
        return r.DT_UINT16;
      case Uint32Array:
        return r.DT_UINT32;
    }
  }
}
let P = {
  debug: !1
};
function G(f) {
  P = f;
}
function g(f) {
  P.debug && console.debug(f);
}
class V extends E {
  constructor(e) {
    if (super(), this.parameters = e, this.readyState = HTMLMediaElement.HAVE_NOTHING, this.meshReadyState = HTMLMediaElement.HAVE_NOTHING, this.bufferingMeshes = !1, this.wasPlaying = !1, e != null && e.dracoLoader)
      this.dracoLoader = e.dracoLoader;
    else {
      const t = new N();
      t.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/"), t.preload(), this.dracoLoader = t;
    }
    if (e != null && e.videoElement)
      this.video = e.videoElement;
    else {
      const t = document.createElement("video");
      t.crossOrigin = "anonymous", t.setAttribute("crossorigin", "anonymous"), t.setAttribute("visibility", "hidden"), t.setAttribute("webkit-playsinline", ""), t.setAttribute("playsInline", ""), t.loop = (e == null ? void 0 : e.loop) || !1, t.autoplay = (e == null ? void 0 : e.autoplay) || !1, t.muted = t.autoplay ? !0 : (e == null ? void 0 : e.muted) || !1, t.muted && t.setAttribute("muted", ""), t.autoplay && t.setAttribute("autoplay", ""), t.playsInline = !0, t.disablePictureInPicture = !0, this.video = t;
    }
    this.video.addEventListener("loadeddata", () => {
      this.updateReadyState();
    });
    const s = new C(this.video);
    if (s.minFilter = x, s.magFilter = q, s.format = D, s.colorSpace = A, s.generateMipmaps = !1, this.videoTex = s, this.material = new H({ color: 16777215, map: this.videoTex }), this.blankGeo = new _(), this.mesh = new I(this.blankGeo, this.material), this.add(this.mesh), this.transferSpeeds = [], this.transferSpeedWindowSize = 30, this.meshAvgTransferSpeed = 0, this.meshSizes = [], this.meshAvgSize = 0, this.avgMeshesPerSecond = 0, this.geometries = {}, this.currentFrame = 0, this.previousFrame = -1, this.lastRequestedFrame = -1, this.maxFrames = (e == null ? void 0 : e.maxFrames) || 999999, this.openMeshRequests = 0, this.framesToBuffer = (e == null ? void 0 : e.framesToBuffer) || 30, this.maxConcurrentMeshRequests = (e == null ? void 0 : e.maxConcurrentMeshRequests) || 15, this.readyStateChangeCallback = (e == null ? void 0 : e.readyStateChangeCallback) || null, "requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      const t = (i, o) => {
        const r = Math.round(o.mediaTime * 30);
        this.previousFrame = this.currentFrame, this.currentFrame = r, this.currentFrame === this.previousFrame ? g("duplicate video frame") : (this.geometries.hasOwnProperty(this.currentFrame) && this.updateMesh(this.currentFrame), this.updateReadyState(), !this.bufferingMeshes && this.meshReadyState < HTMLMediaElement.HAVE_FUTURE_DATA && (g("not enough meshes buffered, pausing the video while meshes load."), this.wasPlaying = !this.video.paused, this.wasPlaying && this.video.pause(), this.bufferingMeshes = !0), this.lastRequestedFrame < this.currentFrame && (g("regained focus"), this.lastRequestedFrame = this.currentFrame - 1), this.currentFrame < this.previousFrame && (this.lastRequestedFrame = -1), this.loadMoreMeshes()), this.video.requestVideoFrameCallback(t);
      };
      this.video.requestVideoFrameCallback(t);
    } else
      throw new Error("requestVideoFrameCallback is not supported on this browser. Consider using a polyfill");
    e != null && e.clip && this.loadClip(e.clip);
  }
  loadClip(e) {
    var t;
    this.video.paused || this.video.pause(), typeof e == "string" && (this.video.src = `${e}.mp4`, this.meshSequencePath = e, this.meshSequenceFilePrefix = "mesh-f", this.meshSequenceFileSuffix = ".drc", this.meshSequenceZeroPadding = 5, this.meshSequenceStartFrame = 1), e !== null && typeof e == "object" && (e.name ? (this.video.src = `${e.name}.mp4`, this.meshSequencePath = e.name) : (e.videoSrc && (this.video.src = e.videoSrc), this.meshSequencePath = e.meshSequencePath || ""), this.meshSequenceFilePrefix = e.meshSequenceFilePrefix || "mesh-f", this.meshSequenceFileSuffix = e.meshSequenceFileSuffix || ".drc", this.meshSequenceZeroPadding = e.meshSequenceZeroPadding || 5, this.meshSequenceStartFrame = e.meshSequenceStartFrame || 1), this.video.load(), this.bufferingMeshes = !0, this.wasPlaying = this.video.autoplay, this.readyState = HTMLMediaElement.HAVE_NOTHING, this.meshReadyState = HTMLMediaElement.HAVE_NOTHING, this.mesh.geometry = this.blankGeo, Object.keys(this.geometries).forEach((i) => {
      parseInt(i, 10) !== NaN && this.geometries[i] !== null && typeof this.geometries[i] == "object" && typeof this.geometries[i].dispose == "function" && (this.geometries[i].dispose(), delete this.geometries[i]);
    }), this.currentFrame = 0, this.previousFrame = -1, this.lastRequestedFrame = -1, this.maxFrames = ((t = this.parameters) == null ? void 0 : t.maxFrames) || 999999, this.openMeshRequests = 0, this.updateReadyState(), this.loadMoreMeshes();
  }
  loadMoreMeshes() {
    if (this.numBufferedGeometryFrames(this.currentFrame) < 3 || this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.lastRequestedFrame - this.currentFrame < this.framesToBuffer) {
      const e = this.lastRequestedFrame + 1;
      let s = Math.max(this.maxConcurrentMeshRequests - this.openMeshRequests, 0);
      g(`Requesting ${s} more meshes`);
      const t = e + s;
      for (let i = e; i < t; i++)
        this.loadMesh(i);
    }
  }
  updateMesh(e) {
    this.mesh.geometry = this.geometries[e], Object.keys(this.geometries).forEach((t) => {
      const i = parseInt(t, 10);
      i !== NaN && i < e && (this.geometries[t].dispose(), delete this.geometries[t]);
    });
  }
  numBufferedGeometryFrames(e) {
    let s = 0;
    for (; this.geometries.hasOwnProperty(e++); )
      s++;
    return s;
  }
  hasBufferedGeometry(e, s) {
    for (let t = e; t < e + s; t++)
      if (!(t >= this.maxFrames) && !this.geometries.hasOwnProperty(t))
        return !1;
    return !0;
  }
  loadMesh(e) {
    const s = (e + 1).toString().padStart(this.meshSequenceZeroPadding, "0"), t = `${this.meshSequencePath}/${this.meshSequenceFilePrefix}${s}${this.meshSequenceFileSuffix}`;
    if (this.lastRequestedFrame = e, e >= this.maxFrames)
      return;
    this.openMeshRequests++;
    const i = (/* @__PURE__ */ new Date()).getTime();
    let o = (/* @__PURE__ */ new Date()).getTime(), r = 0, a = this.meshSequencePath;
    this.dracoLoader.load(
      // resource URL
      t,
      // called when the resource is loaded
      (n) => {
        if (a !== this.meshSequencePath) {
          n.dispose();
          return;
        }
        this.geometries[e] = n, this.openMeshRequests--, o = (/* @__PURE__ */ new Date()).getTime();
        let l = r / ((o - i) / 1e3);
        this.transferSpeeds.push(l) > this.transferSpeedWindowSize && this.transferSpeeds.shift();
        let d = 0;
        this.transferSpeeds.forEach((h) => {
          d += h;
        }), this.meshAvgTransferSpeed = d / this.transferSpeeds.length, this.meshSizes.push(r) > this.transferSpeedWindowSize && this.meshSizes.shift();
        let u = 0;
        this.meshSizes.forEach((h) => {
          u += h;
        }), this.meshAvgSize = u / this.meshSizes.length, this.avgMeshesPerSecond = this.meshAvgTransferSpeed / this.meshAvgSize, g(`avg mesh transfer speed: ${this.meshAvgTransferSpeed}, avg mesh size: ${this.meshAvgSize}, avg meshes per second: ${this.avgMeshesPerSecond}`), this.updateReadyState(), this.bufferingMeshes && this.meshReadyState >= HTMLMediaElement.HAVE_FUTURE_DATA && (this.updateMesh(this.currentFrame), this.wasPlaying && this.video.paused && (g("buffering finished; unpausing video"), this.video.play()), this.bufferingMeshes = !1), this.loadMoreMeshes();
      },
      // called as loading progresses
      (n) => {
        r = n.total;
      },
      // called when loading has errors
      (n) => {
        this.openMeshRequests--, this.maxFrames = Math.min(this.maxFrames, e);
      }
    );
  }
  updateReadyState() {
    let e = HTMLMediaElement.HAVE_NOTHING;
    this.video && (e = this.video.readyState);
    let s = HTMLMediaElement.HAVE_NOTHING;
    const t = this.numBufferedGeometryFrames(this.currentFrame);
    t >= 1 && (s = HTMLMediaElement.HAVE_CURRENT_DATA), (t >= 3 || this.maxFrames - this.currentFrame <= t) && (s = HTMLMediaElement.HAVE_FUTURE_DATA), this.avgMeshesPerSecond > 1.25 && (t >= 30 || this.maxFrames - this.currentFrame <= t) && (s = HTMLMediaElement.HAVE_ENOUGH_DATA), g(`${t} buffered meshes`);
    const i = Math.min(s, e);
    (i !== this.readyState || this.meshReadyState !== s) && (this.meshReadyState = s, this.readyState = i, g(`new readyState: ${this.readyState} = min(meshReadyState=${s}, videoReadyState=${e})`), this.readyStateChangeCallback && this.readyStateChangeCallback());
  }
}
export {
  V as DracoMeshSequencePlayer,
  G as setModuleConfig
};
