/* app-world.js — 8 阵营统一大场景的页面逻辑:阵营/事件列表、播放控制、运镜 */
(function () {
'use strict';
const $ = id => document.getElementById(id), S = window.SEC, W = window.FRAUD_WORLD;
const ST = { cur: -1, t: 0, playing: false, speed: 1 };
let stage = null;
const EVS = W.EVENTS;

function showStatus(k, msg) {
  const n = $('nodata'), b = $('stnote');
  if (k === 'fail' || k === 'lost') { n.style.display = 'flex'; n.innerHTML = ''; const d = document.createElement('div'); d.className = 'nd'; d.textContent = '⚠ ' + msg; n.appendChild(d); }
  else if (k === 'safe') { n.style.display = 'none'; b.style.display = 'block'; b.textContent = 'ℹ ' + msg; }
  else { n.style.display = 'none'; }
}
const cur = () => EVS[ST.cur];
const dur = () => cur() ? cur().dur : 1;

function init() {
  $('total').innerHTML = `8 阵营 · <b>${EVS.length}</b> 个事件`;
  try { stage = new S.StageWorld($('cv'), $('stage')); stage.onstatus = showStatus; } catch (e) { showStatus('fail', '无法初始化 WebGL:' + e.message); console.error(e); }
  $('bPlay').onclick = () => { if (ST.cur < 0) { select(0, true); return; } if (!ST.playing && ST.t >= dur() - 0.01) ST.t = 0; ST.playing = !ST.playing; sync(); };
  $('bReplay').onclick = () => { if (ST.cur < 0) return; ST.t = 0; ST.playing = true; sync(); };
  $('bPrev').onclick = () => step(-1); $('bNext').onclick = () => step(1);
  $('scrub').oninput = () => { ST.t = $('scrub').value / 100; ST.playing = false; sync(); };
  $('speed').onchange = () => { ST.speed = +$('speed').value; };
  $('bHome').onclick = () => { ST.playing = false; ST.cur = -1; $('title').innerHTML = `<b>总览</b><span>8 阵营全景</span>`; $('cap').textContent = ''; renderList(); if (stage) stage.overview(); };
  const bl = $('bloom'); bl.value = 28; const setB = () => { stage && stage.setBloom(bl.value / 100); $('bloomV').textContent = bl.value + '%'; }; bl.oninput = setB; setB();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; const k = e.key;
    if (k === ' ') { e.preventDefault(); $('bPlay').click(); } else if (k === 'r' || k === 'R') $('bReplay').click();
    else if (k === ']') step(1); else if (k === '[') step(-1); else if (k === 'h' || k === 'H') $('bHome').click();
  });
  renderList();
  addEventListener('sec-theme', e => { if (stage && stage.applyTheme) stage.applyTheme(e.detail); });
  // 开场给总览
  $('title').innerHTML = `<b>总览</b><span>8 阵营全景 · 中央为涉诈攻击源</span>`;
  requestAnimationFrame(loop);
}
function renderList() {
  const L = $('list'); L.innerHTML = '';
  W.CAMPS.forEach(camp => {
    const items = EVS.filter(e => e.camp === camp.id);
    const h = document.createElement('div'); h.className = 'cat' + (cur() && cur().camp === camp.id ? ' cur' : ''); h.innerHTML = `<span>${camp.name}</span><small>${items.length}</small>`;
    h.onclick = () => { const f = items[0]; if (f) select(EVS.indexOf(f), true); }; L.appendChild(h);
    items.forEach(e => {
      const i = EVS.indexOf(e); const d = document.createElement('div'); d.className = 'it' + (i === ST.cur ? ' on' : '');
      d.innerHTML = `<span class="sv ${e.role === 'extract' ? 'none' : e.role === 'control' ? 'critical' : 'medium'}"></span><span class="nm"><b>${e.name}</b><i>${nodeName(e.from)} → ${nodeName(e.to)}</i></span>`;
      d.onclick = () => select(i, true); L.appendChild(d);
    });
  });
}
function nodeName(id) { if (id === 'core') return '攻击源核心'; const n = W.NODES.find(x => x.id === id); return n ? n.label : id; }
function select(i, play) {
  const e = EVS[i]; if (!e) return; ST.cur = i; ST.t = 0; ST.playing = !!play;
  if (stage) { try { stage.load(e); } catch (err) { console.error(err); } }
  $('scrub').max = Math.round(e.dur * 100); renderTicks(); renderDetail(e);
  $('title').innerHTML = `<b>${e.name}</b><span>${W.CAMPS.find(c => c.id === e.camp).name}</span>`;
  renderList(); const on = document.querySelector('.it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  sync(); if (stage) { try { stage.draw(0); } catch (err) {} }
}
function step(d) { let k = ST.cur < 0 ? 0 : (ST.cur + d + EVS.length) % EVS.length; select(k, true); }
function phaseOf(e, t) { const seg = e.dur / 6; return clamp(Math.floor(t / seg), 0, 5); }
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function renderTicks() {
  const e = cur(), Tk = $('ticks'); Tk.innerHTML = ''; const seg = e.dur / 6;
  for (let i = 0; i < 6; i++) { const s = document.createElement('span'); s.textContent = i + 1; s.style.left = (i * seg / e.dur * 100) + '%'; s.title = e.cap[i]; s.onclick = () => { ST.t = i * seg + 0.05; ST.playing = false; sync(); }; Tk.appendChild(s); }
}
function renderDetail(e) {
  const camp = W.CAMPS.find(c => c.id === e.camp); const seg = e.dur / 6;
  const roleTxt = e.role === 'extract' ? '取证 / 溯源' : e.role === 'control' ? '操控 / 预警' : '扩线 / 圈定';
  $('detail').innerHTML = `<h2>${e.name}</h2><div class="en">${camp.name}</div>
  <div class="badges"><span class="badge">${roleTxt}</span><span class="badge">${nodeName(e.from)} → ${nodeName(e.to)}</span></div>
  <h3>节点</h3><div class="roles"><div class="role s"><b>源 · ${nodeName(e.from)}</b></div><div class="role d"><b>目标 · ${nodeName(e.to)}</b></div></div>
  <h3>动效时间线</h3><ul class="tl" id="tl">${e.cap.map((c, i) => `<li data-i="${i}"><time>${(i * seg).toFixed(1)}s</time><span>${c}</span></li>`).join('')}</ul>
  <div class="note">纯概念示意:中央为涉诈攻击源/研判核心,画面中的"线索/凭证/指令"均为占位表现,不含任何可直接利用的账号、口令或命令。仅用于反诈取证演示与教学。</div>`;
  [...$('tl').children].forEach(li => li.onclick = () => { ST.t = +li.dataset.i * seg + 0.05; ST.playing = false; sync(); });
  $('detail').scrollTop = 0;
}
function sync() {
  const e = cur(); if (!e) { $('bPlay').textContent = '▶ 播放'; return; } const k = phaseOf(e, ST.t);
  $('scrub').value = Math.round(ST.t * 100); $('scrub').style.setProperty('--p', (ST.t / e.dur * 100) + '%');
  $('tm').textContent = `${ST.t.toFixed(1)} / ${e.dur.toFixed(1)} 秒`; $('cap').textContent = e.cap[k]; $('cap').className = e.role === 'extract' ? 'def' : e.role === 'control' ? 'atk' : 'warn';
  [...$('ticks').children].forEach((s, i) => s.classList.toggle('act', i === k));
  const tl = $('tl'); if (tl) [...tl.children].forEach((li, i) => li.classList.toggle('act', i === k));
  $('bPlay').textContent = ST.playing ? '❚❚ 暂停' : '▶ 播放';
}
let last = performance.now(), loopErrs = 0;
function loop(now) {
  try {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (ST.playing && cur()) { ST.t += dt * ST.speed; if (ST.t >= dur()) { ST.t = dur(); ST.playing = false; } sync(); }
    if (stage) stage.draw(cur() ? ST.t : now / 1000);
  } catch (err) { loopErrs++; if (loopErrs < 20) console.error(err); }
  requestAnimationFrame(loop);
}
window.FW = { events: EVS, state: ST, select, seek(i, t) { if (i !== ST.cur) select(i, false); ST.t = t; ST.playing = false; sync(); stage && stage.draw(t); }, overview() { stage && stage.overview(); }, get stage() { return stage; } };
if (document.body) init(); else addEventListener('DOMContentLoaded', init);
})();
