/* fraud-prims.js — 本页新增动效原语(在 prims.js 基础上扩展)
   riser  : 源节点效果 —— 从节点顶部向上升起(粒子 + 上升环 + 引导虚线),顶端形成"汇聚点"
   faller : 目标节点效果 —— 从上方"汇聚点"落入节点(下落环收缩 + 下落粒子)
   focus  : 聚焦标记 —— 脚下旋转虚线大环 + 四角取景框,让聚焦的一对节点明显突出
   tag    : 场景内说明牌(文字均为示意)
   所有原语签名与 prims.js 一致:(ctx,t0,t1,P) => update(t) */
(function () {
'use strict';
const S = window.SEC, T = S.T, V3 = S.V3, { COL, col, clamp, seg, sm, eo, lerp, rng, AZ, glyphSprite, textSprite, addMat, lineMat, PR } = S;
const win = (t, a, b, fi = 0.3, fo = 0.3) => clamp((t - a) / fi) * (b == null ? 1 : clamp((b - t) / fo));

function guide(c, x, z, cc) {
  const g = new T.BufferGeometry().setFromPoints([new V3(x, 0, z), new V3(x, 1, z)]);
  const l = new T.LineSegments(g, new T.LineDashedMaterial({ color: cc.clone(), dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.8, blending: S.themeBlend(), depthWrite: false }));
  l.frustumCulled = false; c.group.add(l); return l;
}
function setGuide(l, x, ya, yb, z, a) {
  const p = l.geometry.attributes.position; p.setXYZ(0, x, ya, z); p.setXYZ(1, x, yb, z); p.needsUpdate = true; l.computeLineDistances(); l.material.opacity = a; l.visible = a > 0.01 && Math.abs(yb - ya) > 0.05;
}
function ringSet(c, n, cc) {
  const ms = []; for (let i = 0; i < n; i++) { const m = new T.Mesh(new T.RingGeometry(0.9, 1, 48), addMat(cc, 0.7, T.DoubleSide)); m.rotation.x = -Math.PI / 2; m.visible = false; c.group.add(m); ms.push(m); } return ms;
}

/* ---------- 源:向上升起 ---------- */
PR.riser = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'src', col: 'warn', y0: 4.4, y1: 9.4, grow: 1.4, rate: 34, rings: 5, period: 0.55, r: 1.1, seed: 7 }, P);
  const p = c.R(o.at), cc = col(o.col).clone(), r = rng(o.seed), gl = guide(c, p.x, p.z, cc), rs = ringSet(c, o.rings, cc);
  const N = Math.floor(o.rate * (t1 - t0)), off = []; for (let i = 0; i < N; i++) off.push([r() * 6.28, 0.25 + r() * 0.85, 0.6 + r() * 0.8]);
  return t => {
    const v = win(t, t0, t1, 0.3, 0.6); const h = lerp(o.y0, o.y1, eo(seg(t, t0, t0 + o.grow)));
    setGuide(gl, p.x, o.y0, h, p.z, 0.75 * v); if (v < 0.01) { rs.forEach(m => m.visible = false); return; }
    // 上升粒子(螺旋)
    const life = 1.3;
    for (let i = 0; i < N; i++) { const ts = t0 + i / o.rate, a = t - ts; if (a < 0 || a > life) continue; const k = a / life, f = off[i];
      const y = lerp(o.y0, o.y1, sm(k)); if (y > h + 0.05) continue; const rr = o.r * f[1] * (1 - 0.6 * k), an = f[0] + a * 3.2;
      c.glow.add(p.x + Math.cos(an) * rr, y, p.z + Math.sin(an) * rr, 0.16 * f[2], cc, v * Math.min(1, k * 6) * (1 - Math.pow(k, 4))); }
    // 上升环
    rs.forEach((m, i) => { const a = ((t - t0) / o.period - i * (1 / o.rings) * (o.rings * o.period / (o.rings * o.period))) ; const ph = ((t - t0) - i * o.period) / (o.rings * o.period); const k = ph - Math.floor(ph);
      if (t - t0 < i * o.period) { m.visible = false; return; }
      const y = lerp(o.y0, o.y1, k); m.visible = y <= h + 0.05; m.position.set(p.x, y, p.z); m.scale.setScalar(o.r * (1.25 - 0.55 * k)); m.material.opacity = 0.7 * v * Math.sin(Math.PI * k); });
    // 顶端汇聚点
    const top = new V3(p.x, h, p.z), pulse = 1 + 0.25 * Math.sin(t * 6);
    c.glow.addV(top, 0.9 * pulse, cc, 0.9 * v); c.glow.addV(top, 0.35, COL.wht, 0.6 * v);
  };
};

/* ---------- 目标:从上方落入 ---------- */
PR.faller = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'dst', col: 'atk', y0: 9.4, y1: 4.4, rate: 36, rings: 5, period: 0.5, r: 1.15, land: null, seed: 9 }, P);
  const p = c.R(o.at), cc = col(o.col).clone(), r = rng(o.seed), gl = guide(c, p.x, p.z, cc), rs = ringSet(c, o.rings, cc);
  const N = Math.floor(o.rate * (t1 - t0)), off = []; for (let i = 0; i < N; i++) off.push([r() * 6.28, 0.2 + r() * 0.9, 0.6 + r() * 0.8]);
  const land = o.land == null ? t0 + 1.2 : o.land;
  return t => {
    const v = win(t, t0, t1, 0.3, 0.6); const reach = lerp(o.y0, o.y1, eo(seg(t, t0, land)));
    setGuide(gl, p.x, reach, o.y0, p.z, 0.75 * v); if (v < 0.01) { rs.forEach(m => m.visible = false); return; }
    const life = 1.1;
    for (let i = 0; i < N; i++) { const ts = t0 + i / o.rate, a = t - ts; if (a < 0 || a > life) continue; const k = a / life, f = off[i];
      const y = lerp(o.y0, o.y1, k * k); if (y < reach - 0.05) continue; const rr = o.r * f[1] * (0.4 + 0.6 * (1 - k)), an = f[0] - a * 3;
      c.glow.add(p.x + Math.cos(an) * rr, y, p.z + Math.sin(an) * rr, 0.16 * f[2], cc, v * Math.min(1, k * 6) * (1 - Math.pow(k, 5))); }
    rs.forEach((m, i) => { if (t - t0 < i * o.period) { m.visible = false; return; } const ph = ((t - t0) - i * o.period) / (o.rings * o.period), k = ph - Math.floor(ph);
      const y = lerp(o.y0, o.y1, k * k); m.visible = y >= reach - 0.05; m.position.set(p.x, y, p.z); m.scale.setScalar(o.r * (1.5 - 0.9 * k)); m.material.opacity = 0.75 * v * Math.sin(Math.PI * k); });
    const top = new V3(p.x, o.y0, p.z), pulse = 1 + 0.25 * Math.sin(t * 6);
    c.glow.addV(top, 0.9 * pulse, cc, 0.9 * v * (1 - 0.5 * seg(t, land, land + 1))); c.glow.addV(top, 0.35, COL.wht, 0.5 * v);
    const land1 = t - land; if (land1 > 0 && land1 < 0.8) c.glow.add(p.x, o.y1, p.z, 1.6 * (1 - land1 / 0.8) + 0.4, cc, 1 - land1 / 0.8);
  };
};

/* ---------- 聚焦标记 ---------- */
PR.focus = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'src', col: 'def', r: 3.0, h: 5.2, a: 0.85, spin: 0.35, intro: 0.9 }, P);
  const p = c.R(o.at), cc = col(o.col).clone(), g = new T.Group(); g.position.set(p.x, 0.04, p.z); c.group.add(g);
  const segs = 24, rings = []; for (let i = 0; i < segs; i++) { const m = new T.Mesh(new T.RingGeometry(o.r, o.r + 0.09, 8, 1, i / segs * Math.PI * 2, Math.PI * 2 / segs * 0.55), addMat(cc, 0.8, T.DoubleSide)); m.rotation.x = -Math.PI / 2; g.add(m); rings.push(m); }
  // 四角取景框(竖直面,朝向镜头)
  const fr = new T.Group(); fr.rotation.y = AZ; fr.position.set(p.x, o.h / 2 + 0.1, p.z); c.group.add(fr);
  const W = o.r * 1.15, H = o.h / 2, L = 0.7, pts = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { pts.push(sx * W, sy * H, 0, sx * W - sx * L, sy * H, 0, sx * W, sy * H, 0, sx * W, sy * H - sy * L, 0); }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); const bl = new T.LineSegments(bg, lineMat(cc, 0.9)); fr.add(bl);
  return t => {
    const v = win(t, t0, t1, 0.5, 0.6) * o.a; g.visible = fr.visible = v > 0.01; if (!g.visible) return;
    const k = eo(seg(t, t0, t0 + o.intro)); g.scale.setScalar(lerp(1.6, 1, k)); g.rotation.y = t * o.spin; rings.forEach(m => m.material.opacity = 0.8 * v);
    fr.scale.setScalar(lerp(1.35, 1, k)); bl.material.opacity = v * (0.65 + 0.35 * Math.sin(t * 3));
  };
};

/* ---------- 说明牌 ---------- */
PR.tag = (c, t0, t1, P) => {
  const o = Object.assign({ at: 'src', dx: 0, dy: 0, dz: 0, text: '', col: 'warn', h: 0.62, anim: 'pop', abs: false }, P);
  const day = !!S.day, cc = col(o.col), hex = '#' + cc.getHexString();
  const s = textSprite(o.text, { h: o.h, px: 56, color: day ? hex : '#' + cc.clone().lerp(COL.wht, 0.45).getHexString(), bg: day ? 'rgba(255,255,255,0.92)' : 'rgba(9,14,32,0.78)', border: hex });
  c.group.add(s); const p = c.R(o.at); if (!o.abs && (o.at === 'src' || o.at === 'dst' || c.ids[o.at])) p.y = 0; p.x += o.dx; p.y += o.dy; p.z += o.dz;
  return t => { const v = win(t, t0, t1, 0.35, 0.4); s.visible = v > 0.01; if (!s.visible) return; s.material.opacity = v; const k = o.anim === 'pop' ? 0.85 + 0.15 * eo(seg(t, t0, t0 + 0.35)) : 1; s.scale.set(o.h * s.userData.asp * k, o.h * k, 1); s.position.set(p.x, p.y + (o.anim === 'rise' ? 0.4 * eo(seg(t, t0, t0 + 0.6)) : 0), p.z); };
};
})();
