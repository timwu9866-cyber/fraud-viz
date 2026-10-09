/* stage-world.js — 单一 3D 大场景:可运镜透视相机 + 中央攻击源核心 + 8 阵营全部节点 + 事件动效与运镜 */
(function () {
'use strict';
const S = window.SEC, T = S.T, V3 = S.V3, { COL, col, clamp, sm, eo, rng, U, Glow, Node, PR, Ctx, holoMat, addMat, lineMat, textSprite, AZ } = S;
const W = window.FRAUD_WORLD;
  // 大场景节点多,整体降一档辉光避免发白
  if (S.TUNE) { S.TUNE.glowA = 0.3; S.TUNE.glowS = 0.66; }
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function Stage(canvas, host) {
  const self = this; self.errors = []; self.status = 'ok'; self.onstatus = null;
  const notify = (k, m) => { self.status = k; if (self.onstatus) self.onstatus(k, m); };
  let renderer = null, lastErr = null;
  [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false }].some(o => {
    try { renderer = new T.WebGLRenderer(Object.assign({ canvas, preserveDrawingBuffer: true }, o)); return !!renderer.getContext(); } catch (e) { lastErr = e; return false; }
  });
  if (!renderer) throw lastErr || new Error('WebGL 不可用');
  self.safe = /[?&]safe=1/.test(location.search); self.lost = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x0b1020, 1);
  const scene = new T.Scene(); scene.background = new T.Color('#0b1020');
  const cam = new T.PerspectiveCamera(46, 16 / 9, 0.5, 4000);

  // ---- 球面轨道相机 ----
  const camS = { az: 0, el: 26 * Math.PI / 180, dist: 96, target: new V3(0, 2, 0) };
  const tw = { on: false, t0: 0, dur: 1, from: null, to: null };
  function place() {
    const { az, el, dist, target } = camS;
    cam.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    cam.lookAt(target); cam.updateMatrixWorld();
  }
  function tweenTo(to, dur) { tw.on = true; tw.t0 = performance.now(); tw.dur = dur * 1000; tw.from = { az: camS.az, el: camS.el, dist: camS.dist, target: camS.target.clone() }; tw.to = to; }
  function updateTween() {
    if (!tw.on) return; const k = clamp((performance.now() - tw.t0) / tw.dur), e = easeIO(k);
    // 角度走最短路
    let d = tw.to.az - tw.from.az; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    camS.az = tw.from.az + d * e; camS.el = lerp(tw.from.el, tw.to.el, e); camS.dist = lerp(tw.from.dist, tw.to.dist, e);
    camS.target.lerpVectors(tw.from.target, tw.to.target, e); if (k >= 1) tw.on = false; place();
  }

  // ---- 地面网格 ----
  const grid = new T.Mesh(new T.PlaneGeometry(180, 180), new T.ShaderMaterial({
    uniforms: { uDay: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'varying vec3 vW;uniform float uDay;void main(){vec2 p=vW.xz;vec2 g=abs(fract(p-.5)-.5)/fwidth(p);float l=1.-min(min(g.x,g.y),1.);vec2 g2=abs(fract(p/5.-.5)-.5)/fwidth(p/5.);float l2=1.-min(min(g2.x,g2.y),1.);float d=length(p)*0.016;float f=exp(-d*d*1.6);if(uDay>0.5){float a=clamp((l*.6+l2*.9)*f,0.,.8);gl_FragColor=vec4(vec3(.27,.32,.39),a);}else{gl_FragColor=vec4(vec3(.08,.26,.38)*(l*.13+l2*.3)*f+vec3(0.,.07,.1)*f*.03,1.);}}',
  }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = -0.02; scene.add(grid);

  const glow = new Glow(26000); scene.add(glow.points);
  const ambient = []; { const r = rng(7); for (let i = 0; i < 48; i++) ambient.push([(r() - .5) * 88, r() * 7, (r() - .5) * 88, r() * 6.28, 0.4 + r() * 0.8]); }

  // ---- 阵营地台 + 名称 ----
  const campLabels = [];
  W.CAMPS.forEach((camp, ci) => {
    const p = camp.pos; const g = new T.Group(); g.position.set(p.x, 0, p.z);
    const ring = new T.Mesh(new T.RingGeometry(10.5, 11.0, 64), addMat(COL.info, 0.06, T.DoubleSide)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring);
    const disk = new T.Mesh(new T.CircleGeometry(10.5, 48), addMat(COL.info, 0.008, T.DoubleSide)); disk.rotation.x = -Math.PI / 2; disk.position.y = 0.005; g.add(disk);
    scene.add(g);
    const lab = textSprite(camp.name, { h: 1.6, color: '#9fb6e6', bg: 'rgba(9,14,32,0.6)' }); lab.position.set(p.x, 0.2, p.z + 12.5); scene.add(lab); campLabels.push({ lab, baseC: '#9fb6e6' });
  });

  // ---- 中央攻击源核心(反诈特征:红核 + 骷髅/警示 + 雷达环 + 盾形外罩) ----
  const core = new T.Group(); scene.add(core);
  const coreMat = holoMat('#ff4d5e', { base: 0.2, rim: 0.6, pow: 1.5, scan: 0.05, glow: 0.9 });
  const coreMesh = new T.Mesh(new T.IcosahedronGeometry(2.4, 0), coreMat); coreMesh.position.y = 3.4; core.add(coreMesh);
  const coreEdge = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(2.4, 0)), lineMat(col('atk'), 0.8)); coreEdge.position.y = 3.4; core.add(coreEdge);
  const shellMat = holoMat('#ff4d5e', { base: 0.02, rim: 0.4, pow: 2.6, scan: 0.08, glow: 0.8 });
  const shell = new T.Mesh(new T.OctahedronGeometry(4.2, 0), shellMat); shell.position.y = 3.4; core.add(shell);
  const shellEdge = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(4.2, 0)), lineMat(col('atk'), 0.35)); shellEdge.position.y = 3.4; core.add(shellEdge);
  // 脚下雷达环(多层)
  const radar = []; for (let i = 0; i < 3; i++) { const m = new T.Mesh(new T.RingGeometry(3 + i * 1.6, 3.2 + i * 1.6, 72), addMat(col('atk'), 0.4, T.DoubleSide)); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; core.add(m); radar.push(m); }
  const sweepM = new T.Mesh(new T.RingGeometry(3, 8, 64, 1, 0, Math.PI * 0.5), addMat(col('atk'), 0.16, T.DoubleSide)); sweepM.rotation.x = -Math.PI / 2; sweepM.position.y = 0.06; core.add(sweepM);
  // 向 8 阵营放射的"攻击源"连线(常驻、低亮)
  const spokes = []; W.CAMPS.forEach(camp => {
    const q = camp.pos; const geo = new T.BufferGeometry().setFromPoints([new V3(0, 3.4, 0), new V3(q.x, 1.6, q.z)]);
    const l = new T.Line(geo, lineMat(col('atk'), 0.14)); scene.add(l); spokes.push(l);
  });
  const coreTag = textSprite('涉诈攻击源 · 研判核心', { h: 1.9, color: '#ff8a98', bg: 'rgba(9,14,32,0.72)', border: '#ff4d5e' }); coreTag.position.set(0, 8.6, 0); coreTag.visible = false; core.add(coreTag);
  const coreProxy = { center: () => new V3(0, 3.4, 0), topPt: () => new V3(0, 6.2, 0), isCore: true };

  // ---- 世界节点 ----
  const nodeMap = {}; const nodes = [];
  W.NODES.forEach(nd => { const n = new Node({ label: nd.label, kind: nd.kind, color: nd.c, x: nd.x, z: nd.z, scale: nd.scale, dir: 1 }); n.add(scene); nodeMap[nd.id] = n; n._def = nd; nodes.push(n); });
  function resolve(id) { if (id === 'core') return coreProxy; return nodeMap[id]; }

  // ---- 后处理 ----
  let composer = null, bloom = { strength: 0.2, threshold: 0.78 };
  try { composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); bloom = new T.UnrealBloomPass(new T.Vector2(960, 540), 0.10, 0.55, 0.9); composer.addPass(bloom); } catch (e) { console.error(e); composer = null; self.safe = true; }
  self.bloomUser = 0.10; self.bloomNight = 0.9;
  self.setBloom = v => { self.bloomUser = v; bloom.strength = (S.day ? 0.5 : 1) * v; };
  self.applyTheme = function (theme) {
    const day = theme === 'light'; S.day = day; const pal = S.paintPalette(day ? 'light' : 'dark');
    scene.background.set(pal.bg); renderer.setClearColor(pal.bg, 1);
    grid.material.uniforms.uDay.value = day ? 1 : 0; grid.material.blending = day ? T.NormalBlending : T.AdditiveBlending; grid.material.needsUpdate = true;
    glow.points.material.uniforms.uDay.value = day ? 1 : 0; glow.points.material.blending = day ? T.NormalBlending : T.AdditiveBlending; glow.points.material.needsUpdate = true;
    if (bloom.threshold != null) bloom.threshold = day ? 0.95 : self.bloomNight; bloom.strength = (day ? 0.5 : 1) * self.bloomUser;
    if (ev) { try { self.load(ev); } catch (e) {} }
    self.dirty = true;
  };

  function resize() { const w = host.clientWidth, h = host.clientHeight; if (w < 10 || h < 10) return; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); place(); }
  new ResizeObserver(resize).observe(host); window.addEventListener('resize', resize);

  // ---- 交互:拖拽旋转、滚轮缩放(事件播放时自动运镜会接管) ----
  let drag = null; self.idle = true; let lastNow = performance.now();
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; tw.on = false; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; camS.az -= (e.clientX - drag.x) * 0.006; camS.el = clamp(camS.el + (e.clientY - drag.y) * 0.005, 0.12, 1.45); drag.x = e.clientX; drag.y = e.clientY; place(); self.dirty = true; });
  const up = e => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); camS.dist = clamp(camS.dist * Math.exp(e.deltaY * 0.0012), 26, 160); tw.on = false; place(); self.dirty = true; }, { passive: false });
  self.resetView = () => { self.idle = true; tweenTo({ az: camS.az, el: 24 * Math.PI / 180, dist: 100, target: new V3(0, 3.0, 0) }, 1.1); };
  self.overview = self.resetView;

  // ---- 事件加载 ----
  let ctx = null, ups = [], ev = null;
  function framing(from, to) {
    // 中央核心始终居中:相机绕中心,朝向激活阵营,不聚焦/不拉近到节点对
    const a = resolve(from).center(), b = resolve(to).center();
    const pair = a.clone().add(b).multiplyScalar(0.5);
    const dirOut = new V3(pair.x, 0, pair.z); if (dirOut.length() < 1) dirOut.set(0, 0, 1); dirOut.normalize();
    const az = Math.atan2(dirOut.x, dirOut.z) + 14 * Math.PI / 180;
    return { az, el: 19 * Math.PI / 180, dist: 92, target: new V3(0, 3.2, 0) };
  }
  function buildFx(e) {
    const F = resolve(e.from), Tg = resolve(e.to);
    const fTop = F.topPt(), tTop = Tg.topPt();
    const fromCore = e.from === 'core', toCore = e.to === 'core';
    const srcCol = fromCore ? 'atk' : (F._def ? F._def.c : 'warn');
    const roleCol = e.role === 'extract' ? 'def' : e.role === 'control' ? 'atk' : 'warn';
    const shape = e.role === 'extract' ? 'key' : e.role === 'control' ? 'bolt' : 'user';
    const fx = [];
    // 聚焦这对节点/核心
    // 源:向上升起(还原/提取线索)
    fx.push(['riser', e.dur * 0.16, e.dur * 0.52, { at: fromCore ? 'coreR' : e.from, col: srcCol, y0: fTop.y, y1: fTop.y + 5 }]);
    // 暗链:源顶 → 目标顶
    fx.push(['link', e.dur * 0.5, e.dur - 0.2, { wp: [[fTop.x, fTop.y + 0.4, fTop.z], [tTop.x, tTop.y + 0.4, tTop.z]], col: roleCol, arc: 3.2 }]);
    fx.push(['packet', e.dur * 0.54, e.dur * 0.78, { wp: [[fTop.x, fTop.y + 0.4, fTop.z], [tTop.x, tTop.y + 0.4, tTop.z]], col: roleCol, shape, n: 3, gap: 0.45, size: 0.45, arc: 3.2 }]);
    // 目标:从上方落入
    fx.push(['faller', e.dur * 0.66, e.dur - 0.2, { at: toCore ? 'coreR' : e.to, col: toCore ? 'atk' : (Tg._def ? Tg._def.c : 'atk'), y0: tTop.y + 5, y1: tTop.y, land: e.dur * 0.78 }]);
    return fx;
  }
  self.load = function (event) {
    if (ctx) ctx.dispose(); ups = []; ev = event;
    const F = resolve(event.from), Tg = resolve(event.to);
    const A = F.isCore ? nodes[0] : F, B = Tg.isCore ? nodes[0] : Tg;
    ctx = new Ctx(scene, glow, A, B); ctx.dur = event.dur; ctx.nodes = [];
    // 注册所有节点 + 核心,供原语按 id 解析
    nodes.forEach(n => { ctx.ids[n._def.id] = n; }); ctx.ids.core = coreProxy; ctx.ids.coreR = coreProxy;
    ctx.ids.src = F.isCore ? coreProxy : F; ctx.ids.dst = Tg.isCore ? coreProxy : Tg;
    const fx = buildFx(event);
    fx.forEach(e => { const f = PR[e[0]]; if (!f) { self.errors.push(event.id + ': 未知原语 ' + e[0]); return; } try { ups.push(f(ctx, e[1], e[2], e[3] || {})); } catch (err) { self.errors.push(event.id + ':' + e[0] + ':' + err.message); console.error(err); } });
    self.idle = false; tweenTo(framing(event.from, event.to), 1.4);
    self.dirty = true; return ctx;
  };
  self.load0 = function () { self.resetView(); }; // 总览

  self.draw = function (t) {
    if (self.lost) return; const _n = performance.now(), _dt = Math.min(0.05, (_n - lastNow) / 1000); lastNow = _n; updateTween(); if (self.idle && !drag && !tw.on) { camS.az += _dt * 0.12; place(); } U.uTime.value = t; glow.clear();
    // 环境粒子
    ambient.forEach(a => glow.add(a[0] + Math.sin(t * .2 * a[4] + a[3]) * .8, a[1] + Math.sin(t * .15 * a[4]) * .4, a[2] + Math.cos(t * .18 * a[4] + a[3]) * .6, 0.045, COL.def, S.day ? 0.06 : 0.09));
    // 核心动效
    coreMesh.rotation.y = t * 0.5; coreMesh.rotation.x = t * 0.25; shell.rotation.y = -t * 0.3;
    const pulse = 1 + 0.08 * Math.sin(t * 3); coreMesh.scale.setScalar(pulse);
    coreMat.uniforms.uColor.value.copy(col('atk')); shellMat.uniforms.uColor.value.copy(col('atk'));
    radar.forEach((m, i) => { m.material.color.copy(col('atk')); m.material.opacity = (0.22 - i * 0.05) * (0.6 + 0.4 * Math.sin(t * 2 - i)); });
    sweepM.rotation.z = -t * 1.1; sweepM.material.color.copy(col('atk'));
    spokes.forEach(l => { l.material.color.copy(col('atk')); l.material.opacity = S.day ? 0.12 : 0.14 + 0.05 * Math.sin(t * 1.5); });
    for (const o of [coreEdge, shellEdge]) o.material.color.copy(col('atk'));
    glow.add(0, 3.4, 0, 1.4 * pulse, col('atk'), 0.5);
    // 节点 reset + 事件 + apply
    nodes.forEach(n => n.reset());
    for (let i = 0; i < ups.length; i++) { try { ups[i](t); } catch (err) { self.errors.push((ev ? ev.id : '') + '@' + t.toFixed(2) + ':' + err.message); ups[i] = () => {}; } }
    nodes.forEach(n => n.apply(t));
    glow.flush();
    try { if (self.safe || !composer) renderer.render(scene, cam); else composer.render(); }
    catch (err) { self.errors.push('render:' + err.message); if (!self.safe) { self.safe = true; try { renderer.render(scene, cam); } catch (e2) {} } }
  };
  self.renderer = renderer; self.scene = scene; self.cam = cam;
  resize(); place();
  self.applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
}
S.StageWorld = Stage;
})();
