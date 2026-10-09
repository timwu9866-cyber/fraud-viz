/* core.js — 基础工具:调色板、数学、辉光点池、全息材质、符号(glyph)库、节点 */
(function () {
'use strict';
const T = window.THREE, V3 = T.Vector3;
const SEC0 = window.SEC = window.SEC || {};
SEC0.day = false;
function themeBlend(){ return SEC0.day ? T.NormalBlending : T.AdditiveBlending; }
const COL = {
  atk: new T.Color('#ff4d5e'), def: new T.Color('#2ee6d6'), ok: new T.Color('#7dffb0'),
  warn: new T.Color('#ffb04d'), vio: new T.Color('#b48cff'), info: new T.Color('#7fb2ff'),
  wht: new T.Color('#ffffff'), dim: new T.Color('#5a6a90'),
};
/* 夜间为现有亮色;日间在浅底上用更深一档,保证对比。COL 对象原地 set,已克隆的颜色要重建场景才更新。 */
const PALETTE = {
  dark: { atk:'#ff4d5e', def:'#2ee6d6', ok:'#7dffb0', warn:'#ffb04d', vio:'#b48cff', info:'#7fb2ff', wht:'#ffffff', dim:'#5a6a90', bg:'#0b1020' },
  light:{ atk:'#b01030', def:'#0b6e6a', ok:'#146b38', warn:'#a35d0c', vio:'#5b2fa0', info:'#1e4e9e', wht:'#ffffff', dim:'#4a5870', bg:'#d5dee9' },
};
function paintPalette(theme){
  const pal = PALETTE[theme==='light'?'light':'dark'];
  Object.keys(pal).forEach(k=>{ if(COL[k]) COL[k].set(pal[k]); });
  return pal;
}
const col = n => (n && n.isColor) ? n : (COL[n] || new T.Color(n || '#ffffff'));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a));
const sm = x => x * x * (3 - 2 * x);
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const lerp = (a, b, k) => a + (b - a) * k;
const bump = (t, a, d) => { const x = (t - a) / d; return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x); };
function rng(seed) { let s = seed >>> 0; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 分段线性关键帧 [[t,v],...];首帧之前返回 null(表示“尚未生效”),末帧之后保持
function kf(a, t) {
  if (!a || !a.length || t < a[0][0]) return null;
  for (let i = 0; i < a.length - 1; i++) if (t < a[i + 1][0]) { const k = (t - a[i][0]) / Math.max(1e-6, a[i + 1][0] - a[i][0]); return a[i][1] + (a[i + 1][1] - a[i][1]) * sm(k); }
  return a[a.length - 1][1];
}
const FONT = '"Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei","PingFang SC","Hiragino Sans GB","WenQuanYi Micro Hei","DejaVu Sans",sans-serif';
const AZ = 24 * Math.PI / 180, EL = 32 * Math.PI / 180; // 固定等距 2.5D 视角(不可旋转)
const U = { uTime: { value: 0 }, uPPU: { value: 50 } };
const TUNE = { glowA: 0.55, glowS: 0.8 };

/* ---------- 辉光点池 ---------- */
class Glow {
  constructor(n = 12000) {
    this.n = n; this.k = 0; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    const g = new T.BufferGeometry();
    this.aP = new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage);
    this.aC = new T.BufferAttribute(this.col, 4).setUsage(T.DynamicDrawUsage);
    this.aS = new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('aColor', this.aC); g.setAttribute('aSize', this.aS);
    const m = new T.ShaderMaterial({
      uniforms: { uPPU: U.uPPU, uDay: { value: 0 } },
      vertexShader: 'attribute vec4 aColor;attribute float aSize;uniform float uPPU;varying vec4 vC;void main(){vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uPPU,1.,128.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec4 vC;uniform float uDay;void main(){float d=length(gl_PointCoord-.5)*2.;float g=exp(-d*d*3.5)*(1.-smoothstep(.85,1.,d));if(uDay>0.5){gl_FragColor=vec4(vC.rgb,clamp(vC.a*g*1.7,0.,.9));}else{gl_FragColor=vec4(vC.rgb*vC.a*g*.9,1.);}}',
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    this.points = new T.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  clear() { this.k = 0; }
  add(x, y, z, s, c, a = 1) {
    if (this.k >= this.n) return; const i = this.k++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = a * TUNE.glowA; this.size[i] = s * TUNE.glowS;
  }
  addV(p, s, c, a = 1) { this.add(p.x, p.y, p.z, s, c, a); }
  flush() { this.points.geometry.setDrawRange(0, this.k); this.aP.needsUpdate = this.aC.needsUpdate = this.aS.needsUpdate = true; }
}

/* ---------- 全息(菲涅尔)材质,适配正交相机 ---------- */
function holoMat(color, o = {}) {
  const { base = 0.04, rim = 0.6, pow = 2.4, glow = 0.8, scan = 0.06, side = T.DoubleSide } = o;
  return new T.ShaderMaterial({
    uniforms: { uColor: { value: new T.Color(color) }, uBase: { value: base }, uRim: { value: rim }, uPow: { value: pow }, uGlow: { value: glow }, uFlash: { value: 0 }, uScan: { value: scan }, uAlpha: { value: 1 }, uTime: U.uTime, uDay: { value: SEC0.day ? 1 : 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vW;void main(){vN=normalize(normalMatrix*normal);vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 uColor;uniform float uBase,uRim,uPow,uGlow,uFlash,uScan,uAlpha,uTime,uDay;varying vec3 vN;varying vec3 vW;void main(){vec3 N=normalize(vN);float f=pow(1.-abs(dot(N,vec3(0.,0.,1.))),uPow);float sc=.5+.5*sin(vW.y*24.-uTime*3.);float a=uBase+f*uRim+sc*uScan*.5;vec3 c=uColor*(a+uFlash*.35)*uGlow+vec3(1.)*f*uFlash*.12;if(uDay>0.5){float aa=clamp((a*2.4+uFlash*.45)*uAlpha,0.,.95);gl_FragColor=vec4(uColor,aa);}else{gl_FragColor=vec4(c*uAlpha,1.);}}',
    transparent: true, depthWrite: false, blending: themeBlend(), side,
  });
}
const addMat = (c, op = 1, side = T.FrontSide) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: themeBlend(), depthWrite: false, side });
const lineMat = (c, op = 1) => new T.LineBasicMaterial({ color: c, transparent: true, opacity: SEC0.day ? Math.min(1, op * 1.25) : op, blending: themeBlend(), depthWrite: false });

/* ---------- 符号库:Canvas 绘制的粗线条图标(Sprite,始终朝向镜头) ---------- */
const GLYPH = {
  mail: x => { x.strokeRect(-1, -.65, 2, 1.3); x.beginPath(); x.moveTo(-1, .65); x.lineTo(0, -.05); x.lineTo(1, .65); x.stroke(); },
  doc: x => { x.beginPath(); x.moveTo(-.65, -1); x.lineTo(-.65, 1); x.lineTo(.3, 1); x.lineTo(.65, .6); x.lineTo(.65, -1); x.closePath(); x.stroke(); for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-.35, .3 - i * .45); x.lineTo(.35, .3 - i * .45); x.stroke(); } },
  lock: x => { x.strokeRect(-.7, -.95, 1.4, 1.05); x.beginPath(); x.arc(0, .1, .45, Math.PI, 0); x.moveTo(-.45, .1); x.lineTo(-.45, .1); x.stroke(); x.beginPath(); x.arc(0, -.4, .12, 0, 7); x.fill(); },
  unlock: x => { x.strokeRect(-.7, -.95, 1.4, 1.05); x.beginPath(); x.arc(.45, .35, .45, Math.PI, Math.PI * 1.9); x.moveTo(0, .35); x.lineTo(0, .1); x.stroke(); x.beginPath(); x.arc(0, -.4, .12, 0, 7); x.fill(); },
  key: x => { x.beginPath(); x.arc(-.55, 0, .42, 0, 7); x.moveTo(-.13, 0); x.lineTo(1, 0); x.moveTo(.55, 0); x.lineTo(.55, -.45); x.moveTo(.9, 0); x.lineTo(.9, -.38); x.stroke(); },
  eye: x => { x.beginPath(); x.moveTo(-1, 0); x.quadraticCurveTo(0, 1, 1, 0); x.quadraticCurveTo(0, -1, -1, 0); x.stroke(); x.beginPath(); x.arc(0, 0, .3, 0, 7); x.fill(); },
  warn: x => { x.beginPath(); x.moveTo(0, 1); x.lineTo(-.95, -.72); x.lineTo(.95, -.72); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(0, .4); x.lineTo(0, -.15); x.stroke(); x.beginPath(); x.arc(0, -.45, .07, 0, 7); x.fill(); },
  check: x => { x.beginPath(); x.moveTo(-.75, 0); x.lineTo(-.25, -.55); x.lineTo(.8, .65); x.stroke(); },
  cross: x => { x.beginPath(); x.moveTo(-.7, -.7); x.lineTo(.7, .7); x.moveTo(.7, -.7); x.lineTo(-.7, .7); x.stroke(); },
  gear: x => { x.beginPath(); x.arc(0, 0, .5, 0, 7); x.stroke(); x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.moveTo(Math.cos(a) * .5, Math.sin(a) * .5); x.lineTo(Math.cos(a) * .85, Math.sin(a) * .85); } x.stroke(); },
  wifi: x => { for (let i = 1; i <= 3; i++) { x.beginPath(); x.arc(0, -.7, i * .55, Math.PI * .25, Math.PI * .75); x.stroke(); } x.beginPath(); x.arc(0, -.7, .08, 0, 7); x.fill(); },
  bug: x => { x.beginPath(); x.ellipse(0, -.1, .45, .6, 0, 0, 7); x.stroke(); x.beginPath(); x.arc(0, .6, .22, 0, 7); x.stroke(); for (const s of [-1, 1]) for (const y of [.25, -.1, -.45]) { x.beginPath(); x.moveTo(s * .45, y); x.lineTo(s * .9, y + .2); x.stroke(); } },
  flag: x => { x.beginPath(); x.moveTo(-.5, -1); x.lineTo(-.5, 1); x.moveTo(-.5, 1); x.lineTo(.8, .55); x.lineTo(-.5, .1); x.stroke(); },
  hook: x => { x.beginPath(); x.moveTo(0, 1); x.lineTo(0, -.2); x.arc(-.4, -.2, .4, 0, Math.PI); x.stroke(); },
  coin: x => { x.beginPath(); x.arc(0, 0, .85, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, .5); x.lineTo(0, -.5); x.moveTo(-.3, .25); x.lineTo(.3, .25); x.moveTo(-.3, -.25); x.lineTo(.3, -.25); x.stroke(); },
  shield: x => { x.beginPath(); x.moveTo(0, 1); x.lineTo(.8, .7); x.lineTo(.8, -.1); x.quadraticCurveTo(.7, -.7, 0, -1); x.quadraticCurveTo(-.7, -.7, -.8, -.1); x.lineTo(-.8, .7); x.closePath(); x.stroke(); },
  bell: x => { x.beginPath(); x.moveTo(-.7, -.4); x.quadraticCurveTo(-.6, .9, 0, .9); x.quadraticCurveTo(.6, .9, .7, -.4); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(-.9, -.4); x.lineTo(.9, -.4); x.stroke(); x.beginPath(); x.arc(0, -.7, .15, 0, 7); x.fill(); },
  usb: x => { x.strokeRect(-.45, -1, .9, 1.2); x.strokeRect(-.3, .2, .6, .75); x.fillRect(-.18, .4, .12, .2); x.fillRect(.06, .4, .12, .2); },
  skull: x => { x.beginPath(); x.arc(0, .2, .7, Math.PI * .85, Math.PI * .15 + Math.PI * 2); x.lineTo(.4, -.5); x.lineTo(-.4, -.5); x.closePath(); x.stroke(); x.beginPath(); x.arc(-.28, .15, .17, 0, 7); x.arc(.28, .15, .17, 0, 7); x.fill(); x.beginPath(); x.moveTo(-.2, -.5); x.lineTo(-.2, -.9); x.moveTo(.2, -.5); x.lineTo(.2, -.9); x.stroke(); },
  user: x => { x.beginPath(); x.arc(0, .45, .38, 0, 7); x.stroke(); x.beginPath(); x.arc(0, -.9, .85, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); },
  db: x => { for (const y of [.55, 0, -.55]) { x.beginPath(); x.ellipse(0, y, .8, .25, 0, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(-.8, .55); x.lineTo(-.8, -.55); x.moveTo(.8, .55); x.lineTo(.8, -.55); x.stroke(); },
  cloud: x => { x.beginPath(); x.arc(-.4, -.1, .4, Math.PI * .5, Math.PI * 1.5); x.arc(-.05, .25, .45, Math.PI, 0); x.arc(.45, -.05, .35, -Math.PI * .5, Math.PI * .5); x.closePath(); x.stroke(); },
  globe: x => { x.beginPath(); x.arc(0, 0, .9, 0, 7); x.stroke(); x.beginPath(); x.ellipse(0, 0, .4, .9, 0, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-.9, 0); x.lineTo(.9, 0); x.stroke(); },
  bolt: x => { x.beginPath(); x.moveTo(.2, 1); x.lineTo(-.5, -.1); x.lineTo(0, -.1); x.lineTo(-.2, -1); x.lineTo(.5, .15); x.lineTo(0, .15); x.closePath(); x.stroke(); },
  chevron: x => { x.beginPath(); x.moveTo(-.7, -.35); x.lineTo(0, .35); x.lineTo(.7, -.35); x.stroke(); },
  ticket: x => { x.beginPath(); x.moveTo(-1, .55); x.lineTo(1, .55); x.lineTo(1, .15); x.arc(1, 0, .15, -Math.PI / 2, Math.PI / 2, true); x.lineTo(1, -.55); x.lineTo(-1, -.55); x.lineTo(-1, -.15); x.arc(-1, 0, .15, Math.PI / 2, -Math.PI / 2, true); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(-.5, .2); x.lineTo(.5, .2); x.moveTo(-.5, -.2); x.lineTo(.2, -.2); x.stroke(); },
  hash: x => { x.beginPath(); x.moveTo(-.3, .8); x.lineTo(-.5, -.8); x.moveTo(.5, .8); x.lineTo(.3, -.8); x.moveTo(-.85, .3); x.lineTo(.85, .3); x.moveTo(-.85, -.3); x.lineTo(.85, -.3); x.stroke(); },
  reticle: x => { for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { x.beginPath(); x.moveTo(sx * .95, sy * .45); x.lineTo(sx * .95, sy * .95); x.lineTo(sx * .45, sy * .95); x.stroke(); } x.beginPath(); x.arc(0, 0, .1, 0, 7); x.fill(); },
  phone: x => { x.strokeRect(-.45, -.9, .9, 1.8); x.beginPath(); x.moveTo(-.2, -.7); x.lineTo(.2, -.7); x.stroke(); },
  chip: x => { x.strokeRect(-.5, -.5, 1, 1); for (let i = -1; i <= 1; i += 1) for (const s of [-1, 1]) { x.beginPath(); x.moveTo(i * .3, s * .5); x.lineTo(i * .3, s * .85); x.moveTo(s * .5, i * .3); x.lineTo(s * .85, i * .3); x.stroke(); } },
  bars: x => { x.strokeRect(-.9, -.8, .35, .6); x.strokeRect(-.2, -.8, .35, 1.2); x.strokeRect(.5, -.8, .35, 1.7); },
  mask: x => { x.beginPath(); x.moveTo(-.9, .5); x.quadraticCurveTo(0, .9, .9, .5); x.quadraticCurveTo(.8, -.8, 0, -.9); x.quadraticCurveTo(-.8, -.8, -.9, .5); x.stroke(); x.beginPath(); x.ellipse(-.35, .1, .2, .1, 0, 0, 7); x.ellipse(.35, .1, .2, .1, 0, 0, 7); x.fill(); },
  net: x => { x.beginPath(); x.arc(0, .6, .22, 0, 7); x.arc(-.7, -.6, .22, 0, 7); x.arc(.7, -.6, .22, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, .38); x.lineTo(-.6, -.42); x.moveTo(0, .38); x.lineTo(.6, -.42); x.moveTo(-.48, -.6); x.lineTo(.48, -.6); x.stroke(); },
  question: x => { x.beginPath(); x.arc(0, .3, .45, Math.PI, Math.PI * 2.3); x.lineTo(0, -.35); x.stroke(); x.beginPath(); x.arc(0, -.75, .08, 0, 7); x.fill(); },
  dollar: x => { x.beginPath(); x.moveTo(.5, .5); x.quadraticCurveTo(0, .9, -.5, .4); x.quadraticCurveTo(-.4, 0, 0, 0); x.quadraticCurveTo(.5, -.05, .5, -.45); x.quadraticCurveTo(0, -.95, -.55, -.5); x.moveTo(0, 1); x.lineTo(0, -1); x.stroke(); },
  dot: x => { x.beginPath(); x.arc(0, 0, .55, 0, 7); x.fill(); },
};
const _gt = {};
function glyphTex(name) {
  if (_gt[name]) return _gt[name];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.translate(64, 64); x.scale(52, -52); x.lineWidth = 0.13; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 0.25 * 52 / 52 * 8;
  (GLYPH[name] || GLYPH.dot)(x);
  const t = new T.CanvasTexture(c); t.anisotropy = 4; _gt[name] = t; return t;
}
function glyphSprite(name, color, size = 1) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: glyphTex(name), color: col(color).clone(), transparent: true, blending: themeBlend(), depthWrite: false, depthTest: false }));
  s.scale.set(size, size, 1); s.renderOrder = 20; s.userData.size = size; return s;
}
function textSprite(text, o = {}) {
  const { color = '#cfe8ff', h = 0.5, px = 56, bg = null, border = null } = o;
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `600 ${px}px ${FONT}`; const w = x.measureText(text).width; const pad = px * (bg ? .5 : .25);
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(px * 1.5);
  x.font = `600 ${px}px ${FONT}`; x.textBaseline = 'middle'; x.textAlign = 'center';
  if (bg) { x.fillStyle = bg; x.beginPath(); const r = px * .3; x.roundRect ? x.roundRect(2, 2, c.width - 4, c.height - 4, r) : x.rect(2, 2, c.width - 4, c.height - 4); x.fill(); if (border) { x.strokeStyle = border; x.lineWidth = 2; x.stroke(); } }
  x.shadowColor = color; x.shadowBlur = px * .3; x.fillStyle = color; x.fillText(text, c.width / 2, c.height / 2 + px * .04); x.shadowBlur = 0; x.fillText(text, c.width / 2, c.height / 2 + px * .04);
  const t = new T.CanvasTexture(c); t.anisotropy = 4;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(h * c.width / c.height, h, 1); s.renderOrder = 30; s.userData.h = h; s.userData.asp = c.width / c.height; return s;
}

/* ---------- 节点:三层线框方块 + 发光核心 + 脚下双环(不画光柱) ---------- */
const KIND = {
  server: { geo: () => new T.BoxGeometry(2.2, 1.05, 2.2), sc: [1, 1], shell: [2.7, 3.95, 2.7], glyph: null },
  db: { geo: () => new T.CylinderGeometry(1.1, 1.1, 1.05, 12), sc: [1, 1], shell: [2.7, 3.95, 2.7] },
  client: { geo: () => new T.BoxGeometry(1.9, 0.9, 1.5), sc: [1, 1], shell: [2.4, 3.6, 2.2], flat: true },
  net: { geo: () => new T.CylinderGeometry(1.35, 1.35, 0.85, 8), sc: [1, 1], shell: [3.0, 3.6, 3.0] },
  cloud: { geo: () => new T.CylinderGeometry(1.3, 1.3, 0.95, 18), sc: [1, 1], shell: [3.0, 3.8, 3.0], stagger: true },
  iot: { geo: () => new T.BoxGeometry(1.4, 0.8, 1.4), sc: [1, 1], shell: [1.9, 3.2, 1.9] },
  phone: { geo: () => new T.BoxGeometry(1.1, 1.05, 1.9), sc: [1, 1], shell: [1.6, 3.9, 2.4] },
};
class Node {
  constructor(o) {
    const { label = '', kind = 'server', color = 'ok', x = 0, z = 0, scale = 1, dir = 1, labelOn = true } = o;
    this.kindName = kind; const K = KIND[kind] || KIND.server;
    this.x = x; this.z = z; this.scale = scale; this.dir = dir; this.baseC = col(color).clone();
    const base = this.baseC; this.tintC = base.clone(); this.tintK = 0; this.flashK = 0; this.shellA = 1; this.jit = 0; this.lift = 0; this.dim = 1; this.coreS = 1; this.cageA = 0; this.vis = 1;
    this.g = new T.Group(); this.g.position.set(x, 0, z); this.g.scale.setScalar(scale);
    this.inner = new T.Group(); this.g.add(this.inner);
    this.slabs = []; this.slabMats = []; this.edgeMats = []; this.basics = [];
    const bx = K.geo(), eg = new T.EdgesGeometry(bx);
    for (let i = 0; i < 3; i++) {
      const sg = new T.Group(); const m = holoMat(base, { base: 0.035, rim: 0.5, pow: 2.4, scan: 0.06, glow: 0.85 });
      sg.add(new T.Mesh(bx, m)); this.slabMats.push(m);
      const el = new T.LineSegments(eg, lineMat(base, 0.7)); sg.add(el); this.edgeMats.push(el.material);
      const pts = []; for (let k = 0; k < 4; k++) { const y = -0.32 + k * 0.1; pts.push(-0.8, y, 1.1, 0.25, y, 1.1); }
      const vg = new T.BufferGeometry(); vg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      const vl = new T.LineSegments(vg, lineMat(base, 0.4)); sg.add(vl); this.edgeMats.push(vl.material);
      if (K.stagger) sg.userData.sx = [0, 0.18, -0.12][i];
      this.inner.add(sg); this.slabs.push(sg);
    }
    const sh = K.shell;
    this.shellMat = holoMat(base, { base: 0.01, rim: 0.35, pow: 2.8, scan: 0.08, glow: 0.8 });
    const sgeo = new T.BoxGeometry(sh[0], sh[1], sh[2]);
    this.shellMesh = new T.Mesh(sgeo, this.shellMat); this.shellMesh.position.y = 1.9;
    this.shellEdge = new T.LineSegments(new T.EdgesGeometry(sgeo), lineMat(base, 0.4)); this.shellEdge.position.y = 1.9;
    this.inner.add(this.shellMesh, this.shellEdge);
    this.coreMat = holoMat(base, { base: 0.16, rim: 0.5, pow: 1.6, scan: 0, glow: 0.8 });
    this.core = new T.Mesh(new T.OctahedronGeometry(0.42), this.coreMat); this.core.position.y = 1.9; this.inner.add(this.core);
    this.ringMat = addMat(base, 0.55, T.DoubleSide); this.ringMat2 = this.ringMat;
    const r1 = new T.Mesh(new T.RingGeometry(1.85, 1.98, 64), this.ringMat); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.03;
    const r2 = new T.Mesh(new T.RingGeometry(2.3, 2.34, 64, 1, 0, Math.PI * 1.5), this.ringMat); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.03; this.r2 = r2;
    this.diskMat = addMat(base, 0.05, T.DoubleSide); const disk = new T.Mesh(new T.CircleGeometry(1.85, 48), this.diskMat); disk.rotation.x = -Math.PI / 2; disk.position.y = 0.02;
    this.g.add(r1, r2, disk);
    // 隔离笼
    const cg = new T.BoxGeometry(3.4, 4.6, 3.4); this.cage = new T.Group(); this.cageMat = lineMat(COL.def, 0); const cl = new T.LineSegments(new T.EdgesGeometry(cg), this.cageMat); cl.position.y = 2.3; this.cage.add(cl);
    const bp = []; for (let i = -4; i <= 4; i++) { const v = i * 0.425; bp.push(v, 0, 1.7, v, 4.6, 1.7, v, 0, -1.7, v, 4.6, -1.7, 1.7, 0, v, 1.7, 4.6, v, -1.7, 0, v, -1.7, 4.6, v); }
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); this.cage.add(new T.LineSegments(bg, this.cageMat)); this.cage.visible = false; this.g.add(this.cage);
    this.labelText = label; this.tag = null;
    if (label && labelOn) { this.tag = textSprite(label, { h: 0.5 / Math.sqrt(scale) * (scale < 1 ? 1.1 : 1), color: '#' + base.getHexString() }); this.tag.position.set(x, -0.35, z + 3.0 * scale); this.tagMat = this.tag.material; }
    this.port = new V3(x + dir * 1.5, 1.9, z);
    this.layout();
  }
  add(scene) { scene.add(this.g); if (this.tag) scene.add(this.tag); }
  remove(scene) { scene.remove(this.g); if (this.tag) scene.remove(this.tag); }
  layout() {
    const l = this.lift;
    this.slabs.forEach((s, i) => { s.position.set((s.userData.sx || 0), 0.7 + i * (1.2 + l * 0.35) + l * 0.5, 0); });
    this.core.position.y = 0.7 + (1.2 + l * 0.35) + l * 0.5; this.shellMesh.position.y = this.shellEdge.position.y = 1.9;
  }
  reset() { this.tintK = 0; this.flashK = 0; this.shellA = 1; this.jit = 0; this.lift = 0; this.dim = 1; this.coreS = 1; this.cageA = 0; this.vis = 1; this.tintC.copy(this.baseC); }
  tint(c, k) { if (k > this.tintK) { this.tintK = k; this.tintC.copy(col(c)); } }
  apply(t) {
    this.layout(); const d = this.dim * this.vis;
    const c = this.baseC.clone().lerp(this.tintC, clamp(this.tintK));
    this.slabMats.forEach((m, i) => { m.uniforms.uColor.value.copy(c); m.uniforms.uFlash.value = 0.55 * this.flashK; m.uniforms.uAlpha.value = d; });
    this.shellMat.uniforms.uColor.value.copy(c); this.shellMat.uniforms.uAlpha.value = this.shellA * d; this.shellMat.uniforms.uFlash.value = 0.5 * this.flashK;
    this.shellMesh.visible = this.shellEdge.visible = this.shellA * d > 0.01; this.shellEdge.material.opacity = 0.4 * this.shellA * d; this.shellEdge.material.color.copy(c);
    this.coreMat.uniforms.uColor.value.copy(c); this.coreMat.uniforms.uFlash.value = 0.5 * this.flashK; this.coreMat.uniforms.uAlpha.value = d;
    this.core.scale.setScalar(this.coreS * (1 + 0.12 * Math.sin(t * 3)));
    this.edgeMats.forEach(m => { m.color.copy(c); m.opacity = (m === this.edgeMats[0] ? 0.7 : 0.5) * d; });
    this.ringMat.color.copy(c); this.ringMat.opacity = 0.55 * d; this.diskMat.color.copy(c); this.diskMat.opacity = 0.05 * d;
    this.core.rotation.y = t * 1.2; this.core.rotation.x = t * 0.6; this.r2.rotation.z = -t * 0.5 * this.dir;
    this.g.position.x = this.x + this.jit; this.g.visible = this.vis > 0.01;
    if (this.tag) { this.tagMat.color.copy(SEC0.day ? new T.Color('#ffffff') : c.clone().lerp(COL.wht, 0.35)); this.tagMat.opacity = d; this.tag.visible = this.vis > 0.01; }
    this.cage.visible = this.cageA > 0.01; this.cageMat.opacity = this.cageA * 0.8;
  }
  center() { return new V3(this.x, 1.9, this.z); }
  topPt() { return new V3(this.x, 4.4 * this.scale + (this.scale < 1 ? 0.2 : 0), this.z); }
}

window.SEC = window.SEC || {};
Object.assign(window.SEC, { T, V3, COL, col, clamp, seg, sm, eo, ei, lerp, bump, rng, kf, FONT, AZ, EL, U, TUNE, Glow, holoMat, addMat, lineMat, GLYPH, glyphSprite, textSprite, Node, KIND, PALETTE, paintPalette, themeBlend });
})();
