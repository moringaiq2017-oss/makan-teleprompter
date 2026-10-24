'use strict';

const LS_KEY = 'mp.scripts';
const PREFS_KEY = 'mp.prefs';
const $ = (id) => document.getElementById(id);

const prefs = Object.assign({ speed: 40, fs: 30 }, load(PREFS_KEY, {}));
let builtin = [];
let current = null;
let playing = false;
let offset = 0;
let lastTs = 0;

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// ---------- screens & history (Back button on glasses calls history.back) ----------
function show(name) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${name}`;
  if (name !== 'play') pause();
  const first = {
    list: '#list .item, #btn-new',
    new: '#new-title',
    play: '#btn-toggle',
  }[name];
  document.querySelector(first)?.focus();
}
function go(name, state = {}) {
  history.pushState({ screen: name, ...state }, '');
  render({ screen: name, ...state });
}
function render(state) {
  if (state.screen === 'play') {
    const s = allScripts().find((x) => x.id === state.id);
    if (!s) return render({ screen: 'list' });
    openScript(s);
  }
  if (state.screen === 'list') renderList();
  show(state.screen);
}
window.addEventListener('popstate', (e) => render(e.state ?? { screen: 'list' }));

// ---------- library ----------
function allScripts() { return [...load(LS_KEY, []), ...builtin]; }

function renderList() {
  const list = $('list');
  list.textContent = '';
  for (const s of allScripts()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'item';
    b.dir = 'auto';
    b.textContent = s.title;
    const small = document.createElement('small');
    small.textContent = `${s.body.trim().split(/\s+/).length} كلمة`;
    b.append(small);
    b.addEventListener('click', () => go('play', { id: s.id }));
    list.append(b);
  }
}

$('btn-new').addEventListener('click', () => go('new'));
$('btn-save').addEventListener('click', () => {
  const body = $('new-body').value.trim();
  if (!body) return $('new-body').focus();
  const title = $('new-title').value.trim() || body.slice(0, 30);
  const mine = load(LS_KEY, []);
  mine.unshift({ id: `u${Date.now()}`, title, body });
  save(LS_KEY, mine);
  $('new-title').value = '';
  $('new-body').value = '';
  history.back();
});

// ---------- prompter ----------
const textEl = $('text');
const viewport = $('viewport');

function openScript(s) {
  current = s;
  textEl.textContent = s.body;
  offset = 0;
  applyFs();
  paint();
}
function applyFs() { textEl.style.setProperty('--fs', `${prefs.fs}px`); }
function paint() { textEl.style.transform = `translateY(${-offset}px)`; }
function maxOffset() { return Math.max(0, textEl.scrollHeight - viewport.clientHeight); }

function tick(ts) {
  if (!playing) return;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;
  offset = Math.min(maxOffset(), offset + prefs.speed * dt);
  paint();
  if (offset >= maxOffset()) return pause();
  requestAnimationFrame(tick);
}
function play() {
  if (offset >= maxOffset()) offset = 0;
  playing = true;
  lastTs = 0;
  $('btn-toggle').textContent = '❚❚';
  $('btn-toggle').setAttribute('aria-label', 'إيقاف');
  requestAnimationFrame(tick);
}
function pause() {
  playing = false;
  $('btn-toggle').textContent = '▶';
  $('btn-toggle').setAttribute('aria-label', 'تشغيل');
}

let hudTimer;
function hud(msg) {
  const h = $('hud');
  h.textContent = msg;
  h.classList.add('show');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => h.classList.remove('show'), 900);
}
function setSpeed(d) {
  prefs.speed = Math.min(200, Math.max(10, prefs.speed + d));
  save(PREFS_KEY, prefs);
  hud(`السرعة ${prefs.speed}`);
}
function setFs(d) {
  prefs.fs = Math.min(64, Math.max(18, prefs.fs + d));
  save(PREFS_KEY, prefs);
  applyFs();
  hud(`الخط ${prefs.fs}`);
}

$('btn-toggle').addEventListener('click', () => (playing ? pause() : play()));
$('btn-slower').addEventListener('click', () => setSpeed(-10));
$('btn-faster').addEventListener('click', () => setSpeed(10));
$('btn-smaller').addEventListener('click', () => setFs(-4));
$('btn-bigger').addEventListener('click', () => setFs(4));
$('btn-restart').addEventListener('click', () => { offset = 0; paint(); });

// ---------- boot ----------
fetch('scripts.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((data) => { builtin = data; })
  .catch(() => { builtin = []; })
  .finally(() => {
    history.replaceState({ screen: 'list' }, '');
    render({ screen: 'list' });
  });
