/* app.js — 涉诈事件可视化(单场景单事件):场景一·任务1 提取APP后台凭证
   复用 core/prims/fraud-prims/stage 引擎,仅做单事件的播放控制与说明面板。 */
(function () {
'use strict';
const $ = id => document.getElementById(id), S = window.SEC;

/* ---------- 事件定义(纯概念示意,不含任何真实载荷/口令/命令) ---------- */
const EV = {
  id: 's1t1', name: '提取APP后台凭证', en: 'Scene 1 · Task 1 — Extract App Backend Credentials',
  stage: '场景一 暗链收网 · 任务1',
  src: { n: '涉诈APP · 营业厅助手', k: 'phone', c: 'warn', d: '查获的可疑手机应用(仿冒"营业厅助手"),本地留存有指向后台的登录线索' },
  dst: { n: '涉诈后台 · 渠道客服', k: 'server', c: 'atk', d: '应用在后端对接的涉诈管理后台,需据线索定位并固定证据' },
  principle: '取证人员对查获的涉诈 APP 做静态分析,从其本地配置中还原出指向远端后台的登录线索(地址与账号,画面均为示意)。顺着这条"暗链"溯源,把分散的 APP 与隐藏在后端的涉诈后台关联起来,完成取证闭环。',
  impact: '一旦暗链被还原,即可定位涉诈后台的真实位置、固定其运营证据,并沿后台继续扩线到关联渠道与号码。',
  defense: ['证据获取与分析应在授权、合规流程下进行,全程做哈希校验与链路留痕', '对还原出的后台线索做隔离取证,避免惊动对端', '以线索为锚点,串联 APP、后台、号码、资金等多源数据', '所有展示内容为概念示意,不含可直接利用的凭据、载荷或命令'],
  refs: ['仅用于反诈取证演示与教学', '对应 Excel:综合场景一·任务1｜提取APP后台凭证 · 靶标 涉诈APP-营业厅助手'],
  dur: 15,
  ph: [
    [0, '待机:锁定查获的涉诈 APP 与其疑似对接的后台', 'ok'],
    [2.5, '静态分析:从 APP 本地还原指向后台的登录线索(示意)', 'def'],
    [5, '线索浮现:后台地址与账号线索在 APP 顶端汇聚', 'warn'],
    [7.5, '沿暗链溯源:线索顺连线流向远端后台', 'def'],
    [10, '定位落位:线索落入涉诈后台节点', 'atk'],
    [12.5, '取证闭环:后台被标记固定,APP 与后台完成关联', 'def'],
  ],
  fx: [
    // 聚焦这对节点,让它们从场景中明显突出
    ['focus', 0, 14.6, { at: 'src', col: 'def', r: 3.1, h: 5.4 }],
    ['focus', 9.4, 14.6, { at: 'dst', col: 'atk', r: 3.1, h: 5.4 }],
    // 源:从 APP 向上升起(还原线索)
    ['riser', 2.2, 7.2, { at: 'src', col: 'warn', y0: 4.4, y1: 9.4 }],
    // 线索牌(示意文字)
    ['tag', 2.6, 7.0, { at: 'srcT', dy: 2.6, text: '后台线索(示意)', col: 'warn' }],
    ['glyph', 5.0, 9.4, { name: 'key', at: 'srcT', dy: 2.0, col: 'warn', size: 0.95, anim: 'rise' }],
    // 暗链:源顶 → 目标顶,线索随之流动
    ['link', 7.2, 14.4, { wp: ['srcT', 'dstT'], col: 'def', arc: 2.8 }],
    ['packet', 7.6, 10.2, { wp: ['srcT', 'dstT'], col: 'warn', shape: 'key', n: 3, gap: 0.45, size: 0.42, arc: 2.8 }],
    // 目标:线索从上方落入后台
    ['faller', 9.6, 14.2, { at: 'dst', col: 'atk', y0: 9.4, y1: 4.4, land: 11.2 }],
    ['tag', 11.6, 14.2, { at: 'dstT', dy: 2.4, text: '涉诈后台已定位(示意)', col: 'def' }],
    ['glyph', 11.4, 14.4, { name: 'flag', at: 'dst', dy: 6.2, col: 'def', size: 1.0, anim: 'rise' }],
  ],
};

const ST = { t: 0, playing: true, speed: 1 };
let stage = null;

function showStatus(k, msg) {
  const n = $('nodata'), b = $('stnote');
  if (k === 'fail' || k === 'lost') { n.style.display = 'flex'; n.innerHTML = ''; const d = document.createElement('div'); d.className = 'nd'; d.textContent = '⚠ ' + msg; n.appendChild(d); b.style.display = 'none'; }
  else if (k === 'safe') { n.style.display = 'none'; b.style.display = 'block'; b.textContent = 'ℹ ' + msg; }
  else { n.style.display = 'none'; if (k === 'ok' || k === 'restored') b.style.display = k === 'ok' ? 'none' : b.style.display; }
}

function init() {
  $('total').innerHTML = `场景一 暗链收网 · <b>任务1</b> 提取APP后台凭证`;
  $('scn').innerHTML = `<div class="scnbox">
    <h3>场景</h3><p>场景一 —— 暗链收网</p>
    <h3>当前任务</h3><p><b>任务1</b>｜提取APP后台凭证</p>
    <h3>靶标</h3><p>涉诈APP-营业厅助手</p>
    <h3>图例</h3>
    <ul class="lg"><li><i class="atk"></i>涉诈 / 恶意基础设施</li><li><i class="def"></i>取证 / 溯源动作</li><li><i class="ok"></i>正常流量</li><li><i class="warn"></i>线索 / 数据</li></ul>
    <div class="note">本页仅为反诈取证的概念化演示,所有画面文字均为示意,不含任何可直接利用的凭据、载荷或命令。</div>
  </div>`;
  try { stage = new S.Stage($('cv'), $('stage')); stage.onstatus = showStatus; } catch (e) { showStatus('fail', '无法初始化 WebGL:' + e.message + '。请开启浏览器硬件加速或换用最新版 Chrome / Edge。'); console.error(e); }
  $('bPlay').onclick = () => { if (!ST.playing && ST.t >= EV.dur - 0.01) ST.t = 0; ST.playing = !ST.playing; sync(); };
  $('bReplay').onclick = () => { ST.t = 0; ST.playing = true; sync(); };
  $('scrub').oninput = () => { ST.t = $('scrub').value / 100; ST.playing = false; sync(); };
  $('speed').onchange = () => { ST.speed = +$('speed').value; };
  $('bHome').onclick = () => stage && stage.resetView();
  const bl = $('bloom'); bl.value = 20; const setB = () => { stage && stage.setBloom(bl.value / 100); $('bloomV').textContent = bl.value + '%'; }; bl.oninput = setB; setB();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; const k = e.key;
    if (k === ' ') { e.preventDefault(); $('bPlay').click(); } else if (k === 'r' || k === 'R') $('bReplay').click();
    else if (k === 'ArrowRight') { ST.t = Math.min(EV.dur, ST.t + 0.5); ST.playing = false; sync(); }
    else if (k === 'ArrowLeft') { ST.t = Math.max(0, ST.t - 0.5); ST.playing = false; sync(); }
    else if (k === 'h' || k === 'H') $('bHome').click();
  });
  load();
  addEventListener('sec-theme', e => { if (stage && stage.applyTheme) stage.applyTheme(e.detail); });
  requestAnimationFrame(loop);
}

function load() {
  $('scrub').max = Math.round(EV.dur * 100);
  $('title').innerHTML = `<b>${EV.name}</b><span>${EV.en}</span>`;
  if (stage) { try { stage.load(EV); } catch (err) { console.error(err); stage.errors.push('load: ' + err.message); } }
  renderTicks(); renderDetail();
  sync();
  if (stage) { try { stage.draw(0); } catch (err) { console.error(err); } }
}

function phaseOf(t) { let k = 0; EV.ph.forEach((p, i) => { if (t >= p[0]) k = i; }); return k; }
function renderTicks() {
  const T = $('ticks'); T.innerHTML = '';
  EV.ph.forEach((p, i) => { const s = document.createElement('span'); s.textContent = i + 1; s.style.left = (p[0] / EV.dur * 100) + '%'; s.title = p[1]; s.onclick = () => { ST.t = p[0] + 0.02; ST.playing = false; sync(); }; T.appendChild(s); });
}
function renderDetail() {
  $('detail').innerHTML = `<h2>${EV.name}</h2><div class="en">${EV.en}</div>
  <div class="badges"><span class="badge">${EV.stage}</span><span class="badge sev-high">取证 / 溯源</span></div>
  <h3>源 / 目标含义</h3><div class="roles"><div class="role s"><b>源节点 · ${EV.src.n}</b>${EV.src.d}</div><div class="role d"><b>目标节点 · ${EV.dst.n}</b>${EV.dst.d}</div></div>
  <h3>原理简述</h3><p>${EV.principle}</p>
  <h3>典型表现 / 意义</h3><p>${EV.impact}</p>
  <h3>合规与要点</h3><ul>${EV.defense.map(x => `<li>${x}</li>`).join('')}</ul>
  <h3>说明</h3><ul>${EV.refs.map(x => `<li>${x}</li>`).join('')}</ul>
  <h3>动效时间线</h3><ul class="tl" id="tl">${EV.ph.map((p, i) => `<li data-i="${i}" class="${p[2] === 'atk' ? 'atk' : p[2] === 'def' ? 'def' : ''}"><time>${p[0].toFixed(1)}s</time><span>${p[1]}</span></li>`).join('')}</ul>
  <div class="note">纯概念示意:画面中的"线索/凭证"均为占位表现,不含任何可直接利用的账号、口令或命令。仅用于反诈取证演示与教学。</div>`;
  [...$('tl').children].forEach(li => li.onclick = () => { ST.t = EV.ph[+li.dataset.i][0] + 0.02; ST.playing = false; sync(); });
  $('detail').scrollTop = 0;
}
function sync() {
  const k = phaseOf(ST.t), p = EV.ph[k];
  $('scrub').value = Math.round(ST.t * 100); $('scrub').style.setProperty('--p', (ST.t / EV.dur * 100) + '%');
  $('tm').textContent = `${ST.t.toFixed(1)} / ${EV.dur.toFixed(1)} 秒`; $('cap').textContent = p[1]; $('cap').className = p[2] || '';
  [...$('ticks').children].forEach((s, i) => s.classList.toggle('act', i === k));
  const tl = $('tl'); if (tl) [...tl.children].forEach((li, i) => li.classList.toggle('act', i === k));
  $('bPlay').textContent = ST.playing ? '❚❚ 暂停' : '▶ 播放';
}
let last = performance.now(), loopErrs = 0;
function loop(now) {
  try {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (ST.playing) { ST.t += dt * ST.speed; if (ST.t >= EV.dur) { ST.t = EV.dur; ST.playing = false; } sync(); }
    if (stage) stage.draw(ST.t);
  } catch (err) { loopErrs++; if (loopErrs < 20) console.error(err); if (stage) stage.errors.push('loop: ' + err.message); }
  requestAnimationFrame(loop);
}
window.FRAUD = { ev: EV, state: ST, seek(t) { ST.t = t; ST.playing = false; sync(); stage && stage.draw(t); }, get stage() { return stage; } };
if (document.body) init(); else addEventListener('DOMContentLoaded', init);
})();
