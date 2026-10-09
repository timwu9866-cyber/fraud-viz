/* prims.js — 可复用动效原语(参数化)。每个原语 = 工厂 (ctx,t0,t1,P) => update(t) */
(function () {
'use strict';
const S = window.SEC, T = S.T, V3 = S.V3, { COL, col, clamp, seg, sm, eo, ei, lerp, bump, rng, kf, AZ, glyphSprite, textSprite, Node, GLYPH, addMat, lineMat, holoMat, U } = S;
const PR = {}, RC = {};
const ANCH = {
  src: [-7, 1.9, 0], dst: [7, 1.9, 0], srcT: [-7, 4.4, 0], dstT: [7, 4.4, 0], srcF: [-7, 0.05, 0], dstF: [7, 0.05, 0],
  srcP: [-5.4, 1.9, 0], dstP: [5.4, 1.9, 0], mid: [0, 5.2, 0], midF: [0, 0.05, 0], midM: [0, 2.2, 0], out: [14, 6.5, -7], outL: [-14, 6.5, -7], zero: [0, 0, 0],
};
const win = (t, a, b, fi = 0.3, fo = 0.3) => clamp((t - a) / fi) * (b == null ? 1 : clamp((b - t) / fo));

/* ---------- 上下文 ---------- */
class Ctx {
  constructor(scene, glow, A, B) { this.scene = scene; this.glow = glow; this.A = A; this.B = B; this.group = new T.Group(); scene.add(this.group); this.nodes = []; this.ids = { src: A, dst: B }; this.pc = {}; this.dur = 12; }
  R(w) {
    if (w && w.isVector3) return w.clone();
    if (Array.isArray(w)) return new V3(w[0], w[1], w[2] || 0);
    if (w && typeof w === 'object' && w.a !== undefined) { const p = this.R(w.a), d = w.d || [0, 0, 0]; return p.add(new V3(d[0], d[1], d[2] || 0)); }
    if (this.ids[w] && !ANCH[w]) { const n = this.ids[w]; return n.center(); }
    const a = ANCH[w]; if (!a) throw new Error('unknown anchor ' + w); return new V3(a[0], a[1], a[2]);
  }
  path(wp, arc = 2.2) {
    const key = JSON.stringify([wp, arc]); if (this.pc[key]) return this.pc[key];
    const pts = wp.map(w => this.R(w)), out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], h = arc * Math.min(1, p.distanceTo(q) / 14);
      for (let k = i ? 1 : 0; k <= 10; k++) { const u = k / 10, v = p.clone().lerp(q, u); v.y += h * Math.sin(Math.PI * u); out.push(v); }
    }
    const cv = new T.CatmullRomCurve3(out, false, 'centripetal'); cv.arcLengthDivisions = 300; this.pc[key] = cv; return cv;
  }
  node(w) { if (w === 'both') return [this.A, this.B]; if (Array.isArray(w)) return w.map(x => this.ids[x]).filter(Boolean); return [this.ids[w]].filter(Boolean); }
  dispose() { this.scene.remove(this.group); this.nodes.forEach(n => n.remove(this.scene)); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); }); }
}

/* ---------- 形状 ---------- */
function mkShape(shape, colr, size) {
  const g = new T.Group(); const c0 = col(colr).clone();
  if (GLYPH[shape]) { const s = glyphSprite(shape, c0, size * 2.4); g.add(s); return { g, orient: false, setCol: c => s.material.color.copy(c), setA: a => { s.material.opacity = a; s.visible = a > 0.01; } }; }
  const parts = [];
  if (shape === 'orb') { const s = glyphSprite('dot', c0, size * 2.2); g.add(s); return { g, orient: false, setCol: c => s.material.color.copy(c), setA: a => { s.material.opacity = a; s.visible = a > 0.01; } }; }
  let geo, wire = false;
  if (shape === 'dart') geo = new T.ConeGeometry(size * 0.55, size * 1.8, 6).rotateX(Math.PI / 2);
  else if (shape === 'capsule') geo = new T.CapsuleGeometry(size * 0.45, size * 1.0, 3, 8).rotateZ(Math.PI / 2);
  else if (shape === 'hex') geo = new T.CylinderGeometry(size * 0.8, size * 0.8, size * 0.6, 6);
  else if (shape === 'shard') geo = new T.TetrahedronGeometry(size * 0.9);
  else geo = new T.BoxGeometry(size, size, size);
  const solid = new T.Mesh(geo, addMat(c0, 0.55)); const wf = new T.LineSegments(new T.EdgesGeometry(geo), lineMat(c0, 0.95));
  const big = new T.Mesh(geo, holoMat(c0, { base: 0.1, rim: 0.9, pow: 1.8, scan: 0, glow: 0.8 })); big.scale.setScalar(1.5);
  g.add(solid, wf, big);
  return { g, orient: shape === 'dart' || shape === 'capsule', spin: shape !== 'dart' && shape !== 'capsule', setCol: c => { solid.material.color.copy(c); wf.material.color.copy(c); big.material.uniforms.uColor.value.copy(c); }, setA: a => { solid.material.opacity = 0.55 * a; wf.material.opacity = 0.95 * a; big.material.uniforms.uAlpha.value = a; g.visible = a > 0.01; } };
}

/* ---------- 网格单元(records/bar/meter/buffer 共用) ---------- */
function cells(c, cols, rows, sz, gap, op = 0.9) {
  const g = new T.Group(); g.rotation.y = AZ; c.group.add(g); const geo = new T.PlaneGeometry(sz, sz), arr = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const m = new T.Mesh(geo, addMat(COL.ok, op, T.DoubleSide)); m.userData.bx = (k - (cols - 1) / 2) * (sz + gap); m.userData.by = ((rows - 1) / 2 - r) * (sz + gap);
    m.position.set(m.userData.bx, m.userData.by, 0); g.add(m); arr.push(m);
  }
  return { g, arr, set(i, cc, a = 1, dx = 0, dy = 0, sc = 1) { const m = arr[i]; m.visible = a > 0.01; if (!m.visible) return; m.material.color.copy(col(cc)); m.material.opacity = 0.85 * a; m.position.set(m.userData.bx + dx, m.userData.by + dy, 0); m.scale.setScalar(sc); }, hideAll() { arr.forEach(m => m.visible = false); } };
}
function frame(c, w, h, color, op = 0.5) { const g = new T.Group(); g.rotation.y = AZ; const l = new T.LineLoop(new T.BufferGeometry().setFromPoints([new V3(-w / 2, -h / 2, 0), new V3(w / 2, -h / 2, 0), new V3(w / 2, h / 2, 0), new V3(-w / 2, h / 2, 0)]), lineMat(col(color), op)); g.add(l); c.group.add(g); return { g, mat: l.material }; }

/* ---------- 连线(曲线,生长 + 流动) ---------- */
PR.link = (c, t0, t1, P) => {
  const o = Object.assign({ wp: ['srcT', 'dstT'], arc: 2.2, col: 'atk', r: 0.05, grow: 0.9, out: 0.5, dash: 0, speed: 1.0, alpha: 1, ticks: 0, cut: null, tail: null }, P);
  const path = c.path(o.wp, o.arc), geo = new T.TubeGeometry(path, 72, o.r, 5, false);
  const mat = new T.ShaderMaterial({
    uniforms: { uColor: { value: col(o.col).clone() }, uGrow: { value: 0 }, uTail: { value: 0 }, uAlpha: { value: 1 }, uDash: { value: o.dash }, uGapC: { value: -1 }, uGapW: { value: 0 }, uTime: U.uTime, uDay: { value: S.day ? 1 : 0 }, uLen: { value: path.getLength() } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 uColor;uniform float uGrow,uTail,uAlpha,uDash,uGapC,uGapW,uTime,uLen,uDay;varying vec2 vUv;void main(){if(vUv.x>uGrow||vUv.x<uTail)discard;if(abs(vUv.x-uGapC)<uGapW)discard;float hd=exp(-(uGrow-vUv.x)*uLen*.35);float d=mix(1.,.25+.75*step(.5,fract(vUv.x*uLen*.55-uTime*.8)),uDash);vec3 e=uColor*(.55+.6*hd)*d*uAlpha;if(uDay>0.5){gl_FragColor=vec4(uColor,clamp(max(e.r,max(e.g,e.b))*1.2,0.,.92));}else{gl_FragColor=vec4(e,1.);}}',
    transparent: true, depthWrite: false, blending: S.themeBlend(),
  });
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; c.group.add(mesh); const cc = col(o.col);
  return t => {
    mesh.visible = t >= t0 && t <= t1 + 0.01; if (!mesh.visible) return;
    const gr = eo(seg(t, t0, t0 + o.grow)), tl = o.tail ? sm(seg(t, o.tail[0], o.tail[1])) : 0; const u = mat.uniforms;
    u.uGrow.value = gr; u.uTail.value = tl; u.uAlpha.value = o.alpha * (1 - seg(t, t1 - o.out, t1));
    if (o.cut) { u.uGapC.value = o.cut.u; u.uGapW.value = sm(seg(t, o.cut.t, o.cut.t + 0.3)) * (o.cut.w || 0.06); if (t > o.cut.t && t < o.cut.t + 1.5) c.glow.addV(path.getPointAt(o.cut.u).add(new V3((Math.sin(t * 40) * 0.3), Math.cos(t * 33) * 0.3, 0)), 0.3, COL.warn, 0.9); }
    if (gr < 0.995 && gr > 0.01) c.glow.addV(path.getPointAt(gr), 0.4, cc, 0.9);
    for (let i = 0; i < o.ticks; i++) { const uu = (i + 1) / (o.ticks + 1); if (gr > uu && uu > tl) c.glow.addV(path.getPointAt(uu), 0.26 + 0.08 * Math.sin(t * 4 + i), cc, 0.85); }
  };
};

/* ---------- 数据包(沿曲线飞行) ---------- */
PR.packet = (c, t0, t1, P) => {
  const o = Object.assign({ wp: ['srcT', 'dstT'], arc: 2.2, shape: 'cube', col: 'ok', n: 1, gap: 0.35, size: 0.42, dir: 1, trail: 1, end: 1, hold: null, bounce: 0, colTo: null, tAt: 0.5, ease: 1, fade: 0.1, d: null, off: null }, P);
  const path = c.path(o.wp, o.arc), D = o.d || Math.max(0.3, (t1 - t0) - (o.n - 1) * o.gap), cA = col(o.col), cB = o.colTo ? col(o.colTo) : null;
  const shapes = []; for (let i = 0; i < o.n; i++) { const s = mkShape(o.shape, o.col, o.size); c.group.add(s.g); shapes.push(s); }
  const st = (i, tt) => {
    const s = tt - t0 - i * o.gap; if (s < 0) return null; let m = s;
    if (o.hold) { const th = o.hold[0] * D; if (s > th && s < th + o.hold[1]) m = th; else if (s >= th + o.hold[1]) m = s - o.hold[1]; }
    const k = m / D; if (k > 1 + o.bounce) return null; let u;
    if (k <= 1) u = (o.ease && !o.hold) ? sm(k) : k; else u = 1 - (k - 1) / o.bounce * 0.9;
    u *= o.end; const al = k <= 1 ? Math.min(1, k / 0.06) * (o.bounce ? 1 : 1 - clamp((k - (1 - o.fade)) / o.fade) * (o.end < 1 ? 0 : 0.9)) : 1 - (k - 1) / o.bounce;
    return { u: o.dir > 0 ? u : 1 - u, al, k };
  };
  const p = new V3(), q = new V3();
  return t => {
    for (let i = 0; i < o.n; i++) {
      const sp = shapes[i], r = st(i, t); if (!r) { sp.g.visible = false; continue; }
      sp.g.visible = true; path.getPointAt(clamp(r.u), p); if (o.off) p.add(new V3(o.off[0] * i, o.off[1] * i, o.off[2] * i));
      sp.g.position.copy(p);
      if (sp.orient) { path.getPointAt(clamp(r.u + 0.01 * o.dir), q); sp.g.lookAt(q.x, q.y, q.z); if (o.shape === 'capsule') sp.g.rotation.set(0, 0, 0), sp.g.lookAt(q); } else if (sp.spin) sp.g.rotation.set(t * 1.3 + i, t * 1.7, 0);
      const cc = cB && r.u * o.dir > -9 && ((o.dir > 0 ? r.u : 1 - r.u) > o.tAt) ? cB : cA; sp.setCol(cc); sp.setA(r.al);
      for (let k = 1; o.trail && k <= 7; k++) { const rr = st(i, t - k * 0.045); if (!rr) break; path.getPointAt(clamp(rr.u), q); const f = 1 - k / 8; c.glow.addV(q, o.size * 0.9 * (0.3 + 0.7 * f), cc, 0.8 * f * r.al); }
    }
  };
};

/* ---------- 粒子流(洪水/外泄/扫描) ---------- */
PR.stream = (c, t0, t1, P) => {
  const o = Object.assign({ wp: ['srcT', 'dstT'], arc: 2.2, col: 'atk', rate: 20, life: 1.4, spread: [0, 0, 0], size: 0.2, seed: 1, jit: 0.25, a: 0.8, max: 800, ease: 0, e0: 0 }, P);
  const path = c.path(o.wp, o.arc), r = rng(o.seed), N = Math.min(o.max, Math.floor(o.rate * (t1 - t0))), cc = col(o.col), off = [];
  for (let i = 0; i < N; i++) off.push([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r() * 6.28, 0.7 + r() * 0.6]);
  const p = new V3();
  return t => {
    const i0 = Math.max(0, Math.floor((t - o.life - t0) * o.rate)), i1 = Math.min(N - 1, Math.floor((t - t0) * o.rate));
    for (let i = i0; i <= i1; i++) {
      const age = t - (t0 + i / o.rate); if (age < 0 || age > o.life) continue; const k = age / o.life, u = o.ease ? sm(k) : k, f = off[i];
      path.getPointAt(clamp(u), p); const w = Math.pow(1 - u, 1.4);
      p.x += f[0] * o.spread[0] * w + Math.cos(f[3] + t * 3) * o.jit; p.y += f[1] * o.spread[1] * w + Math.sin(f[3] + t * 2) * o.jit; p.z += f[2] * o.spread[2] * w;
      c.glow.addV(p, o.size * f[4], cc, o.a * Math.min(1, k * 8) * (1 - Math.pow(k, 6)));
    }
  };
};

/* ---------- 爆发(冲击:火花 + 碎片 + 环) ---------- */
PR.burst = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', col: 'atk', col2: null, n: 40, r: 3, life: 1.2, shards: 0, ring: true, size: 0.22, up: 0.5, seed: 5 }, P);
  const pos = c.R(o.at), r = rng(o.seed), cc = col(o.col), c2 = o.col2 ? col(o.col2) : cc, dirs = [];
  for (let i = 0; i < o.n; i++) { const a = r() * 6.28, e = (r() * 1.4 - 0.2 + o.up), v = new V3(Math.cos(a), e, Math.sin(a) * 0.8).normalize(); dirs.push([v, 0.4 + r() * 0.6, r() < 0.3]); }
  const sh = []; for (let i = 0; i < o.shards; i++) { const m = new T.Mesh(new T.TetrahedronGeometry(0.18 + r() * 0.15), addMat(i % 2 ? cc : c2, 0.9)); m.visible = false; m.userData.v = dirs[i % Math.max(1, dirs.length)] ? dirs[i % dirs.length][0].clone().multiplyScalar(0.7 + r() * 0.7) : new V3(0, 1, 0); m.userData.rt = [r() * 4, r() * 4]; c.group.add(m); sh.push(m); }
  let rm = null; if (o.ring) { rm = new T.Mesh(new T.RingGeometry(0.93, 1, 64), addMat(cc, 0.6, T.DoubleSide)); rm.rotation.x = -Math.PI / 2; c.group.add(rm); }
  return t => {
    const a = t - t0; const on = a >= 0 && a <= o.life; if (rm) rm.visible = on; sh.forEach(m => m.visible = on); if (!on) return; const k = a / o.life, e = eo(k);
    dirs.forEach(([d, s, hot]) => { c.glow.add(pos.x + d.x * o.r * e * s, pos.y + d.y * o.r * e * s - 0.9 * k * k, pos.z + d.z * o.r * e * s, o.size * (1 - k * 0.8), hot ? c2 : cc, Math.pow(1 - k, 1.2)); });
    sh.forEach(m => { const v = m.userData.v; m.position.set(pos.x + v.x * o.r * e, pos.y + v.y * o.r * e - 1.3 * k * k, pos.z + v.z * o.r * e); m.rotation.set(a * m.userData.rt[0] * 3, a * m.userData.rt[1] * 3, 0); m.material.opacity = 0.9 * (1 - k); });
    if (rm) { rm.position.set(pos.x, 0.06, pos.z); rm.scale.setScalar(Math.max(0.01, o.r * 0.9 * e)); rm.material.opacity = 0.6 * (1 - k); }
  };
};

/* ---------- 冲击环(可多环、可成弧) ---------- */
PR.ring = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', axis: 'y', col: 'def', r: [0.4, 3.4], n: 1, gap: 0.5, life: 1.2, a: 0.6, arc: 6.2832, dy: 0 }, P);
  const pos = c.R(o.at); if (o.axis === 'y') pos.y = 0.06; pos.y += o.dy; const cc = col(o.col), ms = [];
  for (let i = 0; i < o.n; i++) {
    const m = new T.Mesh(new T.RingGeometry(0.93, 1, 64, 1, 0, o.arc), addMat(cc, o.a, T.DoubleSide));
    if (o.axis === 'y') { m.rotation.x = -Math.PI / 2; }
    else if (o.axis === 'v') m.rotation.y = Math.PI / 2; else { m.rotation.y = AZ; m.rotation.z = Math.PI / 2 - o.arc / 2; }
    m.visible = false; c.group.add(m); ms.push(m);
  }
  return t => { ms.forEach((m, i) => { const a = t - t0 - i * o.gap; const on = a >= 0 && a <= o.life && t <= t1 + o.life; m.visible = on; if (!on) return; const k = a / o.life; m.position.copy(pos); m.scale.setScalar(lerp(o.r[0], o.r[1], eo(k))); m.material.opacity = o.a * (1 - k); }); };
};

/* ---------- 节点状态(关键帧,绝对时间) ---------- */
PR.nodefx = (c, t0, t1, P) => t => {
  const ns = c.node(P.who || 'dst'); let k, v;
  ns.forEach(n => {
    if (P.tint && (k = kf(P.k, t)) !== null) n.tint(P.tint, k);
    if (P.flash && (v = kf(P.flash, t)) !== null) n.flashK = Math.max(n.flashK, v);
    if (P.shake) P.shake.forEach(s => { if (t > s[0] && t < s[1]) n.jit += Math.sin(t * 75) * s[2] * Math.sin(Math.PI * (t - s[0]) / (s[1] - s[0])); });
    if (P.lift && (v = kf(P.lift, t)) !== null) n.lift = v;
    if (P.dim && (v = kf(P.dim, t)) !== null) n.dim = Math.min(n.dim, v);
    if (P.shell && (v = kf(P.shell, t)) !== null) n.shellA = v;
    if (P.core && (v = kf(P.core, t)) !== null) n.coreS = v;
    if (P.cage && (v = kf(P.cage, t)) !== null) n.cageA = v;
    if (P.vis && (v = kf(P.vis, t)) !== null) n.vis = v;
  });
};

/* ---------- 迷你节点(中继/代理/蜜罐/C2/外部) ---------- */
PR.relay = (c, t0, t1, P) => {
  const o = Object.assign({ id: null, at: [0, 0, 0], kind: 'server', col: 'warn', label: '', scale: 0.42 }, P);
  const p = c.R(o.at), n = new Node({ label: o.label, kind: o.kind, color: o.col, x: p.x, z: p.z, scale: o.scale }); n.g.position.y = p.y; if (n.tag) n.tag.position.y = p.y - 0.35;
  n.add(c.scene); c.nodes.push(n); if (o.id) c.ids[o.id] = n; n.home = p;
  return t => {
    const v = win(t, t0, t1, 0.5, 0.5); n.vis = v; n.g.scale.setScalar(o.scale * (0.7 + 0.3 * v));
    if (o.tint) { const k = kf(o.k, t); if (k !== null) n.tint(o.tint, k); }
  };
};
PR.hosts = (c, t0, t1, P) => {
  const o = Object.assign({ n: 5, layout: 'row', z: 4.8, col: 'atk', kind: 'server', inf: [], lab: [], scale: 0.4, from: 'dst', links: true, seed: 3, id: 'h', x: [-4, 4], first: 'dst' }, P);
  const r = rng(o.seed), hs = [], pos = [];
  for (let i = 0; i < o.n; i++) {
    let x, z; const u = o.n === 1 ? 0.5 : i / (o.n - 1);
    if (o.layout === 'row') { x = lerp(o.x[0], o.x[1], u); z = o.z; }
    else if (o.layout === 'ring') { const a = Math.PI * 0.55 + u * Math.PI * 1.1; x = c.B.x + Math.cos(a) * 6; z = Math.sin(a) * 5; }
    else if (o.layout === 'fan') { x = lerp(o.x[0], o.x[1], u); z = -4.5 - (i % 2) * 2.2; }
    else { x = lerp(-5, 5, r()); z = lerp(-5.5, 5.5, r()); if (Math.abs(z) < 1.5) z += 3.2; }
    const nd = new Node({ label: o.lab[i] || '', kind: o.kind, color: o.base || 'ok', x, z, scale: o.scale }); nd.add(c.scene); c.nodes.push(nd); hs.push(nd); pos.push(new V3(x, 1.0, z)); c.ids[o.id + i] = nd;
  }
  const lines = hs.map((h, i) => { const a = i === 0 ? c.R(o.first) : pos[i - 1], b = pos[i]; const g = new T.BufferGeometry().setFromPoints([a.clone(), b.clone()]); const l = new T.Line(g, lineMat(col(o.col), 0.8)); c.group.add(l); return { l, a: a.clone(), b: b.clone() }; });
  return t => {
    const v = win(t, t0, t1, 0.6, 0.5);
    hs.forEach((h, i) => {
      h.vis = v; const ti = o.inf[i]; const k = ti === undefined ? 0 : seg(t, ti, ti + 0.5); h.tint(o.col, k * 0.95); h.flashK = Math.max(h.flashK, ti !== undefined ? Math.exp(-Math.max(0, t - ti) * 3) * (t >= ti ? 1 : 0) : 0);
      const L = lines[i]; const ta = ti === undefined ? 1e9 : ti - 0.5; const g = o.links ? seg(t, ta, ti) : 0; L.l.visible = g > 0.01 && v > 0.01;
      if (L.l.visible) { const e = L.a.clone().lerp(L.b, g); const pa = L.l.geometry.attributes.position; pa.setXYZ(1, e.x, e.y + 0.0, e.z); pa.needsUpdate = true; L.l.material.opacity = 0.8 * v; if (g < 1) c.glow.addV(e, 0.35, col(o.col), 0.9); }
    });
  };
};

/* ---------- 符号图标 ---------- */
PR.glyph = (c, t0, t1, P) => {
  const o = Object.assign({ name: 'warn', at: 'dst', dy: 3.2, size: 1.0, col: 'atk', anim: 'pop', colTo: null, tC: 0, dx: 0, dz: 0, fade: 0.3 }, P);
  const s = glyphSprite(o.name, o.col, o.size); c.group.add(s); const base = c.R(o.at); base.x += o.dx; base.z += o.dz; base.y = (o.at === 'dst' || o.at === 'src' ? 0 : base.y) + o.dy; const cA = col(o.col), cB = o.colTo ? col(o.colTo) : null;
  return t => {
    const vis = t >= t0 && t <= t1 + 0.01; s.visible = vis; if (!vis) return; const a = t - t0; let k = 1, y = 0, al = win(t, t0, t1, o.fade, o.fade);
    if (o.anim === 'pop') k = 0.5 + 0.5 * Math.min(1, 1 - Math.pow(1 - clamp(a / 0.35), 3)) + 0.12 * Math.sin(a * 6) * Math.exp(-a * 2);
    if (o.anim === 'float') y = 0.15 * Math.sin(a * 2.5); if (o.anim === 'rise') { y = a * 0.7; al *= 1 - seg(t, t1 - 0.4, t1); }
    if (o.anim === 'blink') al *= 0.55 + 0.45 * Math.sin(a * 9); if (o.anim === 'throb') k = 1 + 0.18 * Math.sin(a * 7);
    s.position.set(base.x, base.y + y, base.z); s.scale.setScalar(o.size * k); s.material.opacity = al; s.material.color.copy(cB && t > o.tC ? cA.clone().lerp(cB, seg(t, o.tC, o.tC + 0.4)) : cA);
  };
};
PR.orbit = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', n: 8, shape: 'bug', col: 'atk', rad: 2.7, h: 2.2, speed: 1.1, size: 0.55, grow: 1.5, conv: null, phase: 0, flat: 0.8 }, P);
  const base = c.R(o.at); const ss = []; for (let i = 0; i < o.n; i++) { const s = glyphSprite(o.shape, o.col, o.size); c.group.add(s); ss.push(s); }
  return t => {
    ss.forEach((s, i) => {
      const ti = t0 + i * o.grow / o.n; let al = clamp((t - ti) / 0.35) * clamp((t1 - t) / 0.4); let rad = o.rad; if (o.conv) { const k = seg(t, o.conv, o.conv + 0.9); rad *= 1 - k; al *= 1 - k * 0.7; }
      s.visible = al > 0.01; if (!s.visible) return; const a = o.phase + t * o.speed + i * 6.2832 / o.n;
      s.position.set(base.x + Math.cos(a) * rad, (o.at === 'dst' || o.at === 'src' ? 0 : base.y) + o.h + Math.sin(t * 2 + i) * 0.25, base.z + Math.sin(a) * rad * o.flat); s.material.opacity = al;
    });
  };
};

/* ---------- 扫描 ---------- */
PR.sweep = (c, t0, t1, P) => {
  const o = Object.assign({ mode: 'radar', at: 'dst', col: 'def', r: 3.6, from: -6, to: 6, spd: 1.4, a: 0.8 }, P);
  const pos = c.R(o.at), cc = col(o.col);
  if (o.mode === 'radar') {
    const mat = new T.ShaderMaterial({ uniforms: { uC: { value: cc.clone() }, uAng: { value: 0 }, uA: { value: 1 }, uDay: { value: S.day ? 1 : 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 uC;uniform float uAng,uA,uDay;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.;if(r>1.)discard;float a=atan(p.y,p.x);float d=mod(uAng-a,6.2832);float s=exp(-d*1.6)*step(d,4.5);float ring=smoothstep(.02,0.,abs(fract(r*3.)-.0)-.0)*0.0+exp(-abs(r-.33)*70.)*.3+exp(-abs(r-.66)*70.)*.3+exp(-abs(r-.99)*50.)*.7;vec3 e=uC*(s*.9+ring*.5)*uA;if(uDay>0.5){gl_FragColor=vec4(uC,clamp(max(e.r,max(e.g,e.b))*1.25,0.,.9));}else{gl_FragColor=vec4(e,1.);}}', transparent: true, depthWrite: false, blending: S.themeBlend(), side: T.DoubleSide });
    const m = new T.Mesh(new T.PlaneGeometry(o.r * 2, o.r * 2), mat); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.05, pos.z); c.group.add(m);
    return t => { m.visible = t >= t0 && t <= t1; mat.uniforms.uAng.value = -(t - t0) * o.spd * 3; mat.uniforms.uA.value = o.a * win(t, t0, t1, 0.4, 0.5); };
  }
  // 'bar':纵向扫描面,沿 x 方向移动
  const mat = new T.ShaderMaterial({ uniforms: { uC: { value: cc.clone() }, uA: { value: 1 }, uDay: { value: S.day ? 1 : 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 uC;uniform float uA,uDay;varying vec2 vUv;void main(){float e=smoothstep(0.,.25,vUv.y)*smoothstep(1.,.75,vUv.y)*smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x);float g=.35+.65*step(.5,fract(vUv.y*14.));vec3 ee=uC*e*g*.5*uA;if(uDay>0.5){gl_FragColor=vec4(uC,clamp(max(ee.r,max(ee.g,ee.b))*1.3,0.,.88));}else{gl_FragColor=vec4(ee,1.);}}', transparent: true, depthWrite: false, blending: S.themeBlend(), side: T.DoubleSide });
  const m = new T.Mesh(new T.PlaneGeometry(9, 5.5), mat); m.rotation.y = Math.PI / 2; m.position.y = 2.8; c.group.add(m);
  const e1 = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(9, 5.5)), lineMat(cc, 0.9)); e1.rotation.y = Math.PI / 2; e1.position.y = 2.8; c.group.add(e1);
  return t => { const v = t >= t0 && t <= t1; m.visible = e1.visible = v; if (!v) return; const k = sm(seg(t, t0, t1)); m.position.x = e1.position.x = lerp(o.from, o.to, k); mat.uniforms.uA.value = o.a * win(t, t0, t1, 0.3, 0.3); e1.material.opacity = 0.9 * win(t, t0, t1, 0.3, 0.3); };
};

/* ---------- 护盾 / 拦截墙 / 校验门 ---------- */
PR.shield = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', style: 'dome', col: 'def', r: 3.7, hits: [], brk: null, a: 1, x: 0 }, P);
  const p = c.R(o.at), cc = col(o.col), g = new T.Group(); c.group.add(g); let fill, wire;
  if (o.style === 'dome') { const geo = new T.SphereGeometry(o.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); fill = new T.Mesh(geo, holoMat(cc, { base: 0.015, rim: 0.9, pow: 2.0, glow: 0.8, scan: 0.04 })); wire = new T.LineSegments(new T.WireframeGeometry(geo), lineMat(cc, 0.3)); g.position.set(p.x, 0, p.z); }
  else if (o.style === 'wall') { const geo = new T.PlaneGeometry(9, 6, 14, 8); fill = new T.Mesh(geo, holoMat(cc, { base: 0.03, rim: 0.3, pow: 1.0, glow: 0.8, scan: 0.1 })); wire = new T.LineSegments(new T.WireframeGeometry(geo), lineMat(cc, 0.35)); g.rotation.y = Math.PI / 2; g.position.set(o.at === 'mid' ? 0 : p.x, 3, p.z); if (o.x) g.position.x = o.x; }
  else { const geo = new T.TorusGeometry(2.4, 0.09, 8, 48); fill = new T.Mesh(geo, holoMat(cc, { base: 0.3, rim: 0.8, pow: 1.2, glow: 0.9, scan: 0 })); wire = new T.Mesh(new T.TorusGeometry(1.6, 0.04, 6, 36), addMat(cc, 0.5)); g.rotation.y = Math.PI / 2; g.position.set(o.at === 'mid' ? 0 : p.x, 2.7, p.z); if (o.x) g.position.x = o.x; }
  g.add(fill, wire); const r = rng(11);
  return t => {
    let v = win(t, t0, t1, 0.6, 0.6); let sc = 0.8 + 0.2 * eo(clamp((t - t0) / 0.7)); let hit = 0;
    o.hits.forEach(h => { const a = t - h; if (a >= 0 && a < 1.2) { hit = Math.max(hit, Math.exp(-a * 4.5)); if (a < 0.4) { const rr = r; for (let i = 0; i < 6; i++) { const px = o.style === 'dome' ? g.position.x - o.r * 0.75 * Math.cos(i) : g.position.x - 0.1; c.glow.add(px + Math.sin(i * 9 + h) * 0.4, 0.8 + (i % 4) * 0.9, g.position.z + Math.cos(i * 5 + h) * 1.0, 0.3, cc, 0.9 * (1 - a / 0.4)); } } } });
    if (o.brk !== null && t > o.brk) { const k = seg(t, o.brk, o.brk + 0.9); sc *= 1 + k * 0.25; v *= 1 - k; if (k < 1) for (let i = 0; i < 14; i++) c.glow.add(g.position.x + Math.cos(i * 1.7) * o.r * (1 + k), 0.5 + (i % 5) * 0.6, g.position.z + Math.sin(i * 1.7) * o.r * (1 + k), 0.28, cc, 1 - k); }
    g.visible = v > 0.01; fill.material.uniforms.uAlpha.value = v * o.a; fill.material.uniforms.uFlash.value = hit * 2.2 + (o.style === 'gate' ? 0 : 0); wire.material.opacity = (0.3 + 0.5 * hit) * v; g.scale.setScalar(sc);
  };
};

/* ---------- 校验门(垂直于路径的圆环) ---------- */
PR.gate = (c, t0, t1, P) => {
  const o = Object.assign({ wp: ['srcT', 'dstT'], arc: 2.2, u: 0.5, col: 'def', pulses: [], bad: [], r: 1.5, no: false }, P);
  const path = c.path(o.wp, o.arc), p = path.getPointAt(o.u), tg = path.getTangentAt(o.u); const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(new V3(0, 0, 1), tg); c.group.add(g);
  const tor = new T.Mesh(new T.TorusGeometry(o.r, 0.06, 6, 40), addMat(col(o.col), 0.9)); const tor2 = new T.Mesh(new T.TorusGeometry(o.r * 0.7, 0.03, 6, 30), addMat(col(o.col), 0.5)); g.add(tor, tor2);
  return t => {
    const v = win(t, t0, t1, 0.4, 0.4); g.visible = v > 0.01; if (!g.visible) return; let f = 0, bad = 0; o.pulses.forEach((h, i) => { const a = t - h; if (a >= 0 && a < 0.9) { const e = Math.exp(-a * 4); f = Math.max(f, e); if (o.bad.includes(i)) bad = Math.max(bad, e); } });
    const cc = col(o.col).clone().lerp(COL.atk, bad); tor.material.color.copy(cc); tor2.material.color.copy(cc); tor.material.opacity = v * (0.45 + 0.55 * f); tor2.material.opacity = v * 0.5 * (0.3 + f); g.scale.setScalar(1 + 0.2 * f); tor2.rotation.z = t * 1.5;
  };
};

/* ---------- 记录/文件网格 ---------- */
PR.records = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', dy: 6.4, dx: 0, cols: 6, rows: 4, sz: 0.4, gap: 0.08, mode: 'hop', col: 'ok', col2: 'atk', seq: [], to: 'srcT', bd: 2, seed: 4 }, P);
  const base = c.R(o.at); base.y = o.dy; base.x += o.dx; const gr = cells(c, o.cols, o.rows, o.sz, o.gap), W = o.cols * (o.sz + o.gap), H = o.rows * (o.sz + o.gap), fr = frame(c, W + 0.2, H + 0.2, o.col, 0.45);
  gr.g.position.copy(base); fr.g.position.copy(base); const rh = o.sz + o.gap, fr2 = frame(c, W + 0.1, (o.rows - o.bd) * rh + 0.06, 'def', 0.8); fr2.g.visible = false; fr2.g.position.set(base.x, base.y - (o.bd * rh) / 2, base.z); const cur = glyphSprite('reticle', o.col2, o.sz * 2.4); c.group.add(cur); const N = o.cols * o.rows, to = c.R(o.to), r = rng(o.seed), cA = col(o.col), cB = col(o.col2);
  const tm = (i, n) => t0 + 0.7 + (t1 - t0 - 1.4) * (i / Math.max(1, n));
  const cellW = i => { const m = gr.arr[i]; return new V3(base.x + m.userData.bx * Math.cos(AZ), base.y + m.userData.by, base.z - m.userData.bx * Math.sin(AZ)); };
  const fly = (i, t, ts) => { const a = (t - ts) / 0.9; if (a < 0 || a > 1) return; const s = cellW(i), p = s.lerp(to, sm(a)); p.y += 2 * Math.sin(Math.PI * a); c.glow.addV(p, 0.34, cB, 0.9); };
  return t => {
    const v = win(t, t0, t1, 0.5, 0.5); gr.g.visible = fr.g.visible = v > 0.01; cur.visible = false; fr2.g.visible = false; if (!gr.g.visible) return; fr.mat.opacity = 0.45 * v;
    for (let i = 0; i < N; i++) {
      let cc = cA, a = v, dy = 0, sc = 1, dx = 0; const row = Math.floor(i / o.cols), cl = i % o.cols;
      if (o.mode === 'hop') { const j = o.seq.indexOf(i); if (j >= 0) { const ts = tm(j, o.seq.length); if (t >= ts) { cc = cB; sc = 1 + 0.5 * Math.exp(-(t - ts) * 4); fly(i, t, ts); } } }
      else if (o.mode === 'drain') { const ts = t0 + 0.8 + row * 0.5 + cl * 0.05; if (t >= ts) { cc = cB; const k = seg(t, ts + 0.15, ts + 1.0); dy = k * 1.2; a *= 1 - k; fly(i, t, ts + 0.15); } }
      else if (o.mode === 'flip') { const ts = t0 + 0.8 + ((i * 7 + 3) % N) / N * (t1 - t0 - 1.8); if ((i * 5) % 3 !== 0 && t >= ts) { cc = cB; sc = 1 + 0.5 * Math.exp(-(t - ts) * 4); } }
      else if (o.mode === 'fill') { const ts = tm(i, N); if (t >= ts) { cc = cB; sc = 1 + 0.4 * Math.exp(-(t - ts) * 5); } }
      else if (o.mode === 'blink') { cc = (Math.sin(t * 8 + i * 1.3) > 0.4) ? cB : cA; }
      gr.set(i, cc, a, dx, dy, sc);
    }
    if (o.mode === 'hop' && o.seq.length) { const k = clamp(Math.floor((t - t0 - 0.5) / Math.max(0.1, (t1 - t0 - 1.4) / o.seq.length)), 0, o.seq.length - 1); if (t > t0 + 0.5) { cur.visible = true; const m = gr.arr[o.seq[k]]; const p = cellW(o.seq[k]); cur.position.copy(p); cur.material.opacity = v; } }
    if (o.mode === 'climb') { // 光标逐级向上越过边界
      const path = []; let cl = Math.floor(o.cols / 2) + 1; for (let rr = o.rows - 1; rr >= 0; rr--) { path.push(rr * o.cols + cl); if (rr > 0 && rr % 2 === 1) cl = Math.max(0, cl - 1); }
      const idx = clamp(Math.floor((t - t0 - 0.6) / ((t1 - t0 - 1.6) / path.length)), 0, path.length - 1); cur.visible = t > t0 + 0.5; const pi = path[idx]; cur.position.copy(cellW(pi)); cur.material.opacity = v;
      for (let k = 0; k <= idx && t > t0 + 0.5; k++) { const rowk = Math.floor(path[k] / o.cols); gr.set(path[k], rowk < o.bd ? cB : COL.def, v, 0, 0, 1 + (k === idx ? 0.3 : 0)); }
      const last = path[path.length - 1]; if (idx === path.length - 1) fly(last, t, t1 - 1.2);
      fr2.g.visible = true; fr2.mat.opacity = 0.8 * v;
    }
  };
};
/* ---------- 缓冲区(溢出) ---------- */
PR.buffer = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', dy: 6.4, cap: 6, n: 11, col: 'ok', col2: 'atk', fill: [1, 3.5], jump: null, sz: 0.46 }, P);
  const base = c.R(o.at); base.y = o.dy; const gr = cells(c, o.n, 1, o.sz, 0.1); gr.g.position.copy(base); const w = o.cap * (o.sz + 0.1) + 0.1, fr = frame(c, w, o.sz + 0.3, o.col, 0.8);
  const x0 = -(o.n - 1) / 2 * (o.sz + 0.1); fr.g.position.copy(base); fr.g.position.x += (x0 + (o.cap - 1) / 2 * (o.sz + 0.1) - 0) * Math.cos(AZ); fr.g.position.z -= (x0 + (o.cap - 1) / 2 * (o.sz + 0.1)) * Math.sin(AZ);
  const ptr = glyphSprite('chevron', o.col2, 0.8); c.group.add(ptr);
  return t => {
    const v = win(t, t0, t1, 0.5, 0.5); gr.g.visible = fr.g.visible = v > 0.01; ptr.visible = false; if (!gr.g.visible) return; const k = seg(t, o.fill[0], o.fill[1]); const cnt = Math.floor(k * o.n + 0.001);
    for (let i = 0; i < o.n; i++) { const over = i >= o.cap; let cc = over ? o.col2 : o.col; const a = i < cnt ? v : (i === o.cap ? v * 0.45 : v * 0.18); let dy = over && i < cnt ? 0.25 : 0; let sc = 1; if (i < cnt && i === cnt - 1) sc = 1.3; gr.set(i, i === o.cap && i >= cnt ? COL.warn : cc, a, 0, dy, sc); }
    fr.mat.color.copy(col(o.col).clone().lerp(COL.atk, cnt > o.cap ? 1 : 0)); fr.mat.opacity = 0.8 * v * (cnt > o.cap ? 0.6 + 0.4 * Math.sin(t * 12) : 1);
    if (o.jump !== null && t > o.jump) { ptr.visible = true; const a = seg(t, o.jump, o.jump + 1.0); const p = new V3(base.x + (x0 + o.cap * (o.sz + 0.1)) * Math.cos(AZ), base.y, base.z - (x0 + o.cap * (o.sz + 0.1)) * Math.sin(AZ)); p.x += a * 3.2; p.y += 1.0 * Math.sin(Math.PI * a) + a * 0.6; ptr.position.copy(p); ptr.material.opacity = v * (1 - 0.5 * a); }
  };
};
/* ---------- 请求条(注入/过滤/篡改/撕裂) ---------- */
PR.bar = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'mid', dy: 0, dx: 0, cells: 9, col: 'ok', bad: 'atk', mode: 'inject', tIn: 2, tEx: 4, sz: 0.5, ins: 3, idx: [], seed: 2 }, P);
  const base = c.R(o.at); base.y += o.dy; base.x += o.dx; const NB = o.cells + (o.mode === 'filter' ? o.ins : o.mode === 'inject' ? o.ins : 0), gr = cells(c, NB, 1, o.sz, 0.06), pitch = o.sz + 0.06, r = rng(o.seed);
  gr.g.position.copy(base); const rv = []; for (let i = 0; i < NB; i++) rv.push([(r() - .5) * 4, (r() - .2) * 2.6, (r() - .5) * 3]);
  const half = Math.floor(o.cells / 2);
  return t => {
    const v = win(t, t0, t1, 0.4, 0.5); gr.g.visible = v > 0.01; if (!gr.g.visible) return;
    for (let i = 0; i < NB; i++) {
      let cc = o.col, a = v, dx = 0, dy = 0, sc = 1; const ap = seg(t, t0 + i * 0.05, t0 + i * 0.05 + 0.3); a *= ap;
      let slot;
      if (o.mode === 'inject') {
        const isIns = i >= half && i < half + o.ins; const norm = isIns ? -1 : (i < half ? i : i - o.ins); const shift = sm(seg(t, o.tIn + 0.5, o.tIn + 1.2));
        if (isIns) { cc = o.bad; const k = sm(seg(t, o.tIn, o.tIn + 0.9)); dy = (1 - k) * 2.2; a *= k; dx = 0; } else { dx = (i >= half + o.ins ? 1 : 0) * 0; }
        slot = i; // 预留插入位,未插入前左右半区向中间收拢
        const gap = (1 - shift) * o.ins * pitch / 2; if (!isIns) { dx = i < half ? gap : -gap; }
        if (t > o.tEx) { const k = sm(seg(t, o.tEx, o.tEx + 0.8)); cc = i >= half && i < half + o.ins ? o.bad : (r() >= 0 ? o.col : o.col); const mix = col(o.col).clone().lerp(col(o.bad), k * 0.85); cc = mix; sc = 1 + 0.15 * Math.sin(t * 25 + i) * k; dy += Math.sin(t * 30 + i * 2) * 0.05 * k; }
      } else if (o.mode === 'filter') {
        const isIns = i >= half && i < half + o.ins; const k = sm(seg(t, o.tIn, o.tIn + 1.0)); if (isIns) { cc = o.bad; dy = k * 2.5; a *= 1 - k; sc = 1 - 0.5 * k; if (k > 0 && k < 1) c.glow.add(base.x + (i - (NB - 1) / 2) * pitch * Math.cos(AZ), base.y + dy, base.z, 0.3, col(o.bad), 0.8); }
        else dx = (i < half ? 1 : -1) * 0 + (i >= half + o.ins ? -o.ins * pitch * k * 0.5 : i < half ? o.ins * pitch * k * 0.5 : 0);
        if (!isIns && t > o.tIn + 0.8) cc = o.col;
      } else if (o.mode === 'swap') {
        if (o.idx.includes(i) && t > o.tIn) { const k = seg(t, o.tIn, o.tIn + 0.5); cc = col(o.col).clone().lerp(col(o.bad), k); sc = 1 + 0.5 * Math.exp(-(t - o.tIn) * 4); dy = 0.25 * k; }
      } else if (o.mode === 'tear') {
        const k = t < o.tEx ? 0 : sm(seg(t, o.tEx, o.tEx + 1.4)); if (t > o.tEx - 0.3 && t < o.tEx) dy = Math.sin(t * 90 + i * 3) * 0.05; dx = rv[i][0] * k; dy += rv[i][1] * k - 1.2 * k * k; cc = col(o.col).clone().lerp(col(o.bad), k); a *= 1 - 0.4 * k;
      }
      gr.set(i, cc, a, dx, dy, sc);
    }
  };
};
PR.panel = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'midM', dx: 0, dy: 0, dz: 0, size: [3.4, 2.4], style: 'page', col: 'info', colTo: null, tC: 0, mark: null, a: 0.8, rows: 5 }, P);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * o.size[1] / o.size[0]); const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4; x.strokeRect(3, 3, W - 6, H - 6); x.globalAlpha = 0.9; x.fillRect(3, 3, W - 6, 18);
  x.globalAlpha = 0.65; const rr = rng(8);
  if (o.style === 'login') { x.strokeRect(W * .2, H * .3, W * .6, H * .13); x.strokeRect(W * .2, H * .52, W * .6, H * .13); x.fillRect(W * .3, H * .75, W * .4, H * .12); }
  else if (o.style === 'btn') { x.fillRect(W * .25, H * .4, W * .5, H * .25); }
  else if (o.style === 'overlay') { x.setLineDash([10, 8]); x.strokeRect(10, 24, W - 20, H - 34); }
  else for (let i = 0; i < o.rows; i++) { x.fillRect(W * .1, 34 + i * ((H - 60) / o.rows), W * (.35 + rr() * .5), 8); }
  const tex = new T.CanvasTexture(cv); const mat = new T.MeshBasicMaterial({ map: tex, color: col(o.col).clone(), transparent: true, blending: S.themeBlend(), depthWrite: false, side: T.DoubleSide });
  const m = new T.Mesh(new T.PlaneGeometry(o.size[0], o.size[1]), mat); m.rotation.y = AZ; const p = c.R(o.at); m.position.set(p.x + o.dx, p.y + o.dy, p.z + o.dz); c.group.add(m);
  let mk = null; if (o.mark) { mk = new T.Mesh(new T.PlaneGeometry(o.mark.w, o.mark.h), addMat(col(o.mark.col || 'atk'), 0.8, T.DoubleSide)); mk.rotation.y = AZ; mk.position.set(p.x + o.dx + Math.cos(AZ) * o.mark.x, p.y + o.dy + o.mark.y, p.z + o.dz - Math.sin(AZ) * o.mark.x + 0.02); c.group.add(mk); }
  const cA = col(o.col), cB = o.colTo ? col(o.colTo) : cA;
  return t => {
    const v = win(t, t0, t1, 0.4, 0.4); m.visible = v > 0.01; mat.opacity = o.a * v; mat.color.copy(cA.clone().lerp(cB, o.colTo ? seg(t, o.tC, o.tC + 0.4) : 0));
    if (mk) { mk.visible = t > o.mark.t && v > 0.01; mk.material.opacity = 0.8 * v * (0.7 + 0.3 * Math.sin(t * 8)); }
  };
};
PR.meter = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', dx: 3.0, dy: 2.4, rows: 10, lv: [[0, 0.1], [4, 1]], sz: 0.3 }, P);
  const gr = cells(c, 1, o.rows, o.sz, 0.07); const p = c.R(o.at); gr.g.position.set(p.x + o.dx, o.dy, p.z + 0.5); const fr = frame(c, o.sz + 0.15, o.rows * (o.sz + 0.07) + 0.1, 'dim', 0.4); fr.g.position.copy(gr.g.position);
  return t => {
    const v = win(t, t0, t1, 0.4, 0.4); gr.g.visible = fr.g.visible = v > 0.01; const L = kf(o.lv, t) ?? 0;
    for (let i = 0; i < o.rows; i++) { const lev = (o.rows - 1 - i) / o.rows; const on = lev < L; const cc = lev < 0.5 ? COL.ok : lev < 0.75 ? COL.warn : COL.atk; gr.set(i, cc, v * (on ? 1 : 0.12)); }
  };
};
PR.queue = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', n: 14, r: 3.0, col: 'warn', col2: 'atk', fill: [1, 4], shape: 'orb' }, P);
  const p = c.R(o.at), ss = []; for (let i = 0; i < o.n; i++) { const m = new T.Mesh(new T.PlaneGeometry(0.34, 0.34), addMat(col(o.col), 0.8, T.DoubleSide)); const a = i / o.n * 6.2832; m.rotation.x = -Math.PI / 2; m.position.set(p.x + Math.cos(a) * o.r, 0.07, p.z + Math.sin(a) * o.r); c.group.add(m); ss.push(m); }
  return t => {
    const v = win(t, t0, t1, 0.4, 0.5), k = seg(t, o.fill[0], o.fill[1]), cnt = Math.floor(k * o.n + 0.001), full = cnt >= o.n; const fl = full ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    ss.forEach((m, i) => { m.visible = v > 0.01; const on = i < cnt; m.material.color.copy(on ? col(o.col).clone().lerp(col(o.col2), fl) : COL.dim); m.material.opacity = v * (on ? 0.95 : 0.25); m.scale.setScalar(on && i === cnt - 1 ? 1.5 : 1); if (on) c.glow.add(m.position.x, 0.4, m.position.z, 0.28, m.material.color, 0.7 * v); });
  };
};
PR.privesc = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'src', col: 'atk', lvl: [0.5, 2.3, 4.1], dx: 0 }, P);
  const p = c.R(o.at), pl = o.lvl.map(y => { const g = new T.Group(); const m = new T.Mesh(new T.RingGeometry(2.55, 2.7, 4, 1, Math.PI / 4), addMat(COL.dim, 0.5, T.DoubleSide)); m.rotation.x = -Math.PI / 2; g.add(m); g.position.set(p.x, y, p.z); c.group.add(g); return m; });
  const chev = []; for (let i = 0; i < 4; i++) { const s = glyphSprite('chevron', o.col, 0.9); c.group.add(s); chev.push(s); } const cc = col(o.col);
  return t => {
    const v = win(t, t0, t1, 0.4, 0.5), k = sm(seg(t, t0 + 0.4, t1 - 0.6)), y = lerp(0.3, o.lvl[o.lvl.length - 1], k);
    pl.forEach((m, i) => { m.parent.visible = v > 0.01; const lit = y >= o.lvl[i] - 0.05 && t > t0 + 0.4; m.material.color.copy(lit ? cc : COL.dim); m.material.opacity = v * (lit ? 0.9 : 0.35); m.parent.scale.setScalar(lit ? 1 + 0.08 * Math.sin(t * 6 + i) : 1); });
    chev.forEach((s, i) => { const ph = (t * 0.9 + i / 4) % 1; s.visible = v > 0.01 && t > t0 + 0.4 && t < t1 - 0.5; s.position.set(p.x + 3.0, lerp(0.4, 4.5, ph), p.z + 0.2); s.material.opacity = v * Math.sin(Math.PI * ph); });
    if (t > t0 + 0.4 && t < t1) c.glow.add(p.x, y, p.z + 2.5, 0.55, cc, v); for (let j = 1; j < 6 && t > t0 + 0.4; j++) c.glow.add(p.x, Math.max(0.2, y - j * 0.25), p.z + 2.5, 0.4 * (1 - j / 6), cc, 0.7 * v * (1 - j / 6));
  };
};
PR.timer = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', dy: 6.2, col: 'warn', n: 40, r: 0.85, done: null }, P); const p = c.R(o.at); p.y = o.dy; const cc = col(o.col); const s = glyphSprite('lock', o.col, 0.8); c.group.add(s); s.position.copy(p);
  return t => {
    const v = win(t, t0, t1, 0.4, 0.5); s.visible = v > 0.01; s.material.opacity = v; const f = 1 - seg(t, t0 + 0.5, o.done || t1 - 0.3); const cnt = Math.floor(o.n * f);
    for (let i = 0; i < cnt && v > 0.01; i++) { const a = Math.PI / 2 - i / o.n * 6.2832; c.glow.add(p.x + Math.cos(a) * o.r * Math.cos(AZ), p.y + Math.sin(a) * o.r, p.z - Math.cos(a) * o.r * Math.sin(AZ), 0.2, f < 0.3 ? COL.atk : cc, 0.9 * v); }
  };
};
/* ---------- 回响(重放残影):沿路径画“幽灵包”循环弧 ---------- */
PR.loopArc = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'mid', col: 'warn', r: 1.6, spd: 1.6 }, P); const p = c.R(o.at); const cc = col(o.col);
  return t => { const v = win(t, t0, t1, 0.4, 0.4); if (v < 0.01) return; for (let i = 0; i < 26; i++) { const a = t * o.spd - i * 0.12; const f = 1 - i / 26; c.glow.add(p.x + Math.cos(a) * o.r * Math.cos(AZ), p.y + 0.9 + Math.sin(a) * o.r * 0.9, p.z - Math.cos(a) * o.r * Math.sin(AZ), 0.28 * f + 0.05, cc, 0.9 * f * v); } };
};

/* ---------- 配方(宏):展开为多条原语 ---------- */
RC['@hit'] = (t0, t1, P) => { const o = Object.assign({ who: 'dst', col: 'atk', n: 36, r: 2.8, shards: 0, sh: 0.1, ring: true }, P); const fl = o.who === 'dst' ? 'dstF' : o.who === 'src' ? 'srcF' : o.who;
  return [['burst', t0, t0 + 1.4, { at: o.who, col: o.col, n: o.n, r: o.r, shards: o.shards, ring: o.ring, col2: o.col2 }], ['nodefx', 0, 0, { who: o.who, flash: [[t0 - 0.01, 0], [t0 + 0.08, 1], [t0 + 0.9, 0]], shake: [[t0, t0 + 0.5, o.sh]] }]]; };
RC['@tint'] = (t0, t1, P) => { const o = Object.assign({ who: 'dst', col: 'atk', k: 0.9, back: null }, P); const ks = [[t0, 0], [t1, o.k]]; if (o.back) ks.push([o.back, o.k], [o.back + 1, 0]); return [['nodefx', 0, 0, { who: o.who, tint: o.col, k: ks }]]; };
RC['@strike'] = (t0, t1, P) => { const o = Object.assign({ hit: 'dst', hitCol: null, n2: 36, r2: 2.8 }, P); const pk = Object.assign({}, P); ['hit', 'hitCol', 'n2', 'r2'].forEach(k => delete pk[k]); const r = [['packet', t0, t1, pk]]; if (o.hit) r.push(...RC['@hit'](t1, t1 + 1, { who: o.hit, col: o.hitCol || P.col || 'atk', n: o.n2, r: o.r2 })); return r; };
RC['@pulse'] = (t0, t1, P) => { const o = Object.assign({ at: 'dstF', col: 'atk', n: 2, gap: 0.45, r: [0.5, 3.4] }, P); return [['ring', t0, t1, o]]; };

S.PR = PR; S.RC = RC; S.Ctx = Ctx; S.mkShape = mkShape;
})();
