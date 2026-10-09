/* stage.js — 场景、正交等距相机(平移/缩放)、辉光后处理、事件加载与时间线 */
(function () {
'use strict';
const S = window.SEC, T = S.T, V3 = S.V3, { COL, col, clamp, sm, rng, AZ, EL, U, Glow, Node, PR, RC, Ctx } = S;

function Stage(canvas, host) {
  const self = this;
  let renderer = null, lastErr = null;
  [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false }, { antialias: false, powerPreference: 'low-power' }].some(o => {
    try { renderer = new T.WebGLRenderer(Object.assign({ canvas, preserveDrawingBuffer: true }, o)); return !!renderer.getContext(); } catch (e) { lastErr = e; renderer = null; return false; }
  });
  if (!renderer) throw lastErr || new Error('WebGL 不可用');
  self.safe = /[?&]safe=1/.test(location.search); self.lost = false; self.onstatus = null;
  const notify = (k, m) => { self.status = k; if (self.onstatus) self.onstatus(k, m); };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x0b1020, 1);
  const scene = new T.Scene(); scene.background = new T.Color('#0b1020');
  const cam = new T.OrthographicCamera(-10, 10, 10, -10, -100, 200); const target = new V3(0, 1.5, 0); let zoom = 1, baseH = 17;
  function placeCam() {
    const d = 60; cam.position.set(target.x + Math.sin(AZ) * Math.cos(EL) * d, target.y + Math.sin(EL) * d, target.z + Math.cos(AZ) * Math.cos(EL) * d); cam.lookAt(target);
    cam.zoom = zoom; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); U.uPPU.value = (renderer.domElement.height) / ((cam.top - cam.bottom) / zoom);
  }
  // 地面网格
  const grid = new T.Mesh(new T.PlaneGeometry(90, 60), new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uDay: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'varying vec3 vW;uniform float uTime,uDay;void main(){vec2 p=vW.xz;vec2 g=abs(fract(p-.5)-.5)/fwidth(p);float l=1.-min(min(g.x,g.y),1.);vec2 g2=abs(fract(p/5.-.5)-.5)/fwidth(p/5.);float l2=1.-min(min(g2.x,g2.y),1.);float d=length(p*vec2(.05,.08));float f=exp(-d*d*2.2);if(uDay>0.5){float a=clamp((l*.7+l2*.95)*f,0.,.82);gl_FragColor=vec4(vec3(.27,.32,.39),a);}else{gl_FragColor=vec4(vec3(.12,.36,.5)*(l*.22+l2*.45)*f+vec3(0.,.1,.14)*f*.04,1.);}}',
  }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = -0.01; scene.add(grid);
  const glow = new Glow(14000); scene.add(glow.points);
  const ambient = []; { const r = rng(99); for (let i = 0; i < 90; i++) ambient.push([(r() - .5) * 38, r() * 8, (r() - .5) * 18, r() * 6.28, 0.4 + r() * 0.8]); }
  // 常驻两个节点(源 / 目标)
  let A = null, B = null;
  function makeNodes(ev) {
    if (A) { A.remove(scene); B.remove(scene); }
    A = new Node({ label: ev.src.n, kind: ev.src.k, color: ev.src.c, x: -7, dir: 1 }); B = new Node({ label: ev.dst.n, kind: ev.dst.k, color: ev.dst.c, x: 7, dir: -1 });
    A.add(scene); B.add(scene);
  }
  // 后处理
  let composer = null, bloom = { strength: 0.2, resolution: new T.Vector2(960, 540) };
  try { composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); bloom = new T.UnrealBloomPass(new T.Vector2(960, 540), 0.2, 0.4, 0.78); composer.addPass(bloom); } catch (e) { console.error(e); composer = null; self.safe = true; }
  let fin = null; try { fin = new T.ShaderPass({ uniforms: { tDiffuse: { value: null }, uDay: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform sampler2D tDiffuse;uniform float uDay;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float vg=smoothstep(1.1,.4,length((vUv-.5)*vec2(1.2,1.)));c*=uDay>0.5?mix(.96,1.,vg):mix(.7,1.,vg);gl_FragColor=vec4(c,1.);}' }); if (composer) composer.addPass(fin); } catch (e) { console.error(e); composer = null; self.safe = true; }
  self.bloomUser = 0.2; self.bloomNight = 0.78;
  self.setBloom = v => { self.bloomUser = v; bloom.strength = (S.day ? 0.5 : 1) * v; };
  self.applyTheme = function (theme) {
    const day = theme === 'light'; S.day = day; const pal = S.paintPalette(day ? 'light' : 'dark');
    scene.background.set(pal.bg); renderer.setClearColor(pal.bg, 1);
    grid.material.uniforms.uDay.value = day ? 1 : 0;
    grid.material.blending = day ? T.NormalBlending : T.AdditiveBlending; grid.material.needsUpdate = true;
    glow.points.material.uniforms.uDay.value = day ? 1 : 0;
    glow.points.material.blending = day ? T.NormalBlending : T.AdditiveBlending; glow.points.material.needsUpdate = true;
    if (fin && fin.uniforms && fin.uniforms.uDay) fin.uniforms.uDay.value = day ? 1 : 0;
    if (bloom.threshold != null) bloom.threshold = day ? 0.95 : self.bloomNight;
    bloom.strength = (day ? 0.5 : 1) * self.bloomUser;
    if (ev) { try { self.load(ev); } catch (e) { self.errors.push('theme: ' + e.message); } }
    self.dirty = true;
  };
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (w < 10 || h < 10) return;
    renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); bloom.resolution.set(w, h); const asp = w / h;
    baseH = Math.max(17, 31 / asp); cam.left = -baseH * asp / 2; cam.right = baseH * asp / 2; cam.top = baseH / 2; cam.bottom = -baseH / 2; placeCam();
  }
  new ResizeObserver(resize).observe(host); window.addEventListener('resize', resize);
  // WebGL 上下文丢失 / 恢复:明确提示,不静默黑屏
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); self.lost = true; notify('lost', 'WebGL 上下文丢失(显卡驱动重置或资源不足),正在等待恢复…'); });
  canvas.addEventListener('webglcontextrestored', () => { self.lost = false; self.dirty = true; self.frames = 0; resize(); notify('restored', ''); });
  // 画布尺寸与容器不一致时(首次进入为 0、布局延迟等)自动重新适配
  let sizeTick = 0;
  function checkSize() {
    if ((sizeTick++ & 15) && canvas.width > 16) return; const w = host.clientWidth, h = host.clientHeight; if (w < 10 || h < 10) return;
    const pr = renderer.getPixelRatio(); if (Math.abs(canvas.width - Math.floor(w * pr)) > 2 || Math.abs(canvas.height - Math.floor(h * pr)) > 2) resize();
  }
  // 画面探测:场景背景不是纯黑,若读回几乎全黑说明渲染链路异常
  const pc = document.createElement('canvas'); pc.width = 64; pc.height = 36; const px = pc.getContext('2d', { willReadFrequently: true });
  self.probe = function () {
    try { px.clearRect(0, 0, 64, 36); px.drawImage(canvas, 0, 0, 64, 36); const d = px.getImageData(0, 0, 64, 36).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && Math.max(d[i], d[i + 1], d[i + 2]) > 8) n++; return n / (d.length / 4); } catch (e) { return 1; }
  };
  self.frames = 0;
  function healthCheck() {
    self.frames++; if (self.lost) return;
    if (self.frames === 4 || self.frames === 40 || self.frames % 240 === 0) {
      if (self.probe() < 0.02) {
        if (!self.safe) { self.safe = true; self.frames = 0; notify('safe', '检测到画面全黑,已自动切换为兼容渲染(无辉光后处理)'); }
        else if (self.frames >= 40) notify('fail', '中间画面仍为全黑:WebGL 可能被禁用或显卡驱动异常。请开启浏览器硬件加速、更新显卡驱动,或换用 Chrome/Edge 最新版。');
      } else if (self.status === 'fail') notify('ok', '');
    }
  }
  function render() {
    try { if (self.safe || !composer) renderer.render(scene, cam); else composer.render(); }
    catch (err) {
      self.errors.push('render: ' + err.message); console.error(err);
      if (!self.safe) { self.safe = true; notify('safe', '后处理渲染出错,已自动切换为兼容渲染(无辉光):' + err.message); try { renderer.render(scene, cam); } catch (e2) { notify('fail', '渲染失败:' + e2.message); } }
      else notify('fail', '渲染失败:' + err.message);
    }
  }
  // 平移 / 缩放(不可旋转)
  const gf = new V3(-Math.sin(AZ), 0, -Math.cos(AZ)), gr = new V3(Math.cos(AZ), 0, -Math.sin(AZ)); const ptrs = new Map(); let pinch0 = 0, z0 = 1;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = zoom; } });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { const u = (baseH / zoom) / canvas.clientHeight, dx = e.clientX - p.x, dy = e.clientY - p.y; target.addScaledVector(gr, -dx * u).addScaledVector(gf, dy * u / Math.sin(EL)); target.x = clamp(target.x, -30, 30); target.z = clamp(target.z, -20, 20); }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; zoom = clamp(z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch0), 0.5, 3.5); }
    placeCam(); self.dirty = true;
  });
  const up = e => { ptrs.delete(e.pointerId); }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0012), 0.5, 3.5); placeCam(); self.dirty = true; }, { passive: false });
  self.resetView = () => { target.set(0, 1.5, 0); zoom = 1; placeCam(); self.dirty = true; };

  // ---- 事件加载 ----
  let ctx = null, ups = [], ev = null, errCount = 0;
  self.errors = []; self.status = 'ok';
  function expand(list, out) {
    list.forEach(e => {
      if (typeof e[0] === 'string' && e[0][0] === '@') { const f = RC[e[0]]; if (!f) throw new Error('未知配方 ' + e[0]); expand(f(e[1], e[2], e[3] || {}), out); } else out.push(e);
    }); return out;
  }
  self.load = function (event) {
    if (ctx) ctx.dispose(); ctx = null; ups = []; ev = event; makeNodes(event);
    ctx = new Ctx(scene, glow, A, B); ctx.dur = event.dur; ctx.nodes.push(A, B);
    const flat = expand(event.fx, []);
    flat.forEach(e => {
      const f = PR[e[0]]; if (!f) { self.errors.push(event.id + ': 未知原语 ' + e[0]); return; }
      try { ups.push(f(ctx, e[1] == null ? 0 : e[1], e[2] == null ? event.dur : e[2], e[3] || {})); } catch (err) { self.errors.push(event.id + ':' + e[0] + ': ' + err.message); console.error(err); }
    });
    self.dirty = true; return ctx;
  };
  self.draw = function (t) {
    if (!ctx || self.lost) return; checkSize(); U.uTime.value = t; glow.clear();
    ctx.nodes.forEach(n => { if (n !== A && n !== B) n.reset(); }); A.reset(); B.reset();
    ambient.forEach(a => glow.add(a[0] + Math.sin(t * .3 * a[4] + a[3]) * .8, a[1] + Math.sin(t * .2 * a[4] + a[3] * 2) * .5, a[2] + Math.cos(t * .25 * a[4] + a[3]) * .6, 0.05, COL.def, S.day ? 0.16 : 0.28));
    for (let i = 0; i < ups.length; i++) { try { ups[i](t); } catch (err) { self.errors.push(ev.id + ' @' + t.toFixed(2) + ': ' + err.message); if (self.errors.length < 50) console.error(err); ups[i] = () => { }; } }
    ctx.nodes.forEach(n => n.apply(t)); glow.flush(); render(); healthCheck();
  };
  self.renderer = renderer; self.scene = scene; self.cam = cam; self.glow = glow; self.resize = resize; self.getCtx = () => ctx;
  resize();
  self.applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
}
S.Stage = Stage;
})();
