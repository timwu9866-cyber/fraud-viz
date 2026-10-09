/* theme.js — 日间/夜间。默认夜间;未手动选过时跟随 prefers-color-scheme。选择记在 localStorage。
   html[data-theme] 在 <head> 里同步设置(避免闪屏),这里再同步到 body 并接上按钮。 */
(function () {
  'use strict';
  const KEY = 'sec-theme';
  function current() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function apply(theme, persist) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
    const b = document.getElementById('bTheme');
    if (b) {
      b.textContent = theme === 'light' ? '☀ 日间' : '☾ 夜间';
      b.classList.toggle('on', theme === 'light');
      b.title = theme === 'light' ? '当前日间,点击切换到夜间' : '当前夜间,点击切换到日间';
      b.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('sec-theme', { detail: theme }));
  }
  function init() {
    apply(current(), false);
    const b = document.getElementById('bTheme');
    if (b) b.addEventListener('click', () => apply(current() === 'light' ? 'dark' : 'light', true));
    try {
      matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
        let saved = null; try { saved = localStorage.getItem(KEY); } catch (err) {}
        if (saved !== 'light' && saved !== 'dark') apply(e.matches ? 'light' : 'dark', false);
      });
    } catch (e) {}
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
  window.SEC_THEME = { apply, current };
})();
