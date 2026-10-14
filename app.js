'use strict';
/* Kibarkan Bendera · Kata Arah — Tahun 1 Bahasa Melayu (DSKP 5.1.4 iii)
 * 纯静态：Kenali（认识）／Jawab（回答）／Susun（小班长排周会）。界面、朗读全部马来文。
 * 2.5D：近大远小（hOf）、按脚点 y 排序遮挡（z-index=y）、脚下影子、舞台台面高度（stageLift）。
 * 位置判定在 scenes.js（classify），这里只负责画面与互动。 */
const D = window.KATAARAH_DATA;
const { W, H, SC, hOf, R, classify, CHARS, IDS, nameOf, TRAY, trayFoot, trayXY, SENT, cap } = D;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const WORDS = ['atas', 'hadapan', 'belakang', 'bawah'];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = (x, y) => ({ x: +(x / W).toFixed(4), y: +(y / H).toFixed(4) });   // 像素 → 归一化脚点
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

/* ───────────────────────── 音效（WebAudio，无外部文件）───────────────────────── */
const Sfx = {
  ctx: null,
  get c() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return this.ctx; },
  tone(f, dur, { type = 'triangle', vol = .12, delay = 0, slide = 1 } = {}) {
    const c = this.c; if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) { /* 没有音频也不影响玩 */ }
  },
  pick() { this.tone(660, .09, { slide: 1.3 }); },
  good() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .22, { vol: .13, delay: i * .08 })); },
  bad() { this.tone(330, .2, { type: 'sine', vol: .12 }); this.tone(262, .3, { type: 'sine', vol: .12, delay: .15 }); },
  pop() { this.tone(400, .14, { type: 'sine', vol: .16, slide: 2 }); }
};

/* ───────────────────────── 朗读：预录 mp3 优先，没有才用浏览器备案 ───────────────────────── */
const VOICE_NAME = D.VOICE_NAME;
const NOVELTY = /Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox/i;
function clipKey(voice, text) {   // FNV-1a 32 位（UTF-8），gen-voice.py 用同一个算法
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(voice + '|' + text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const Voice = {
  on: true, audio: null, token: 0, tv: null,
  pick() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => /^(ms|id)[-_]/i.test(v.lang) && !NOVELTY.test(v.name));
    this.tv = vs.find(v => /^ms/i.test(v.lang)) || vs[0] || null;
  },
  stop() {
    this.token++;
    if (this.audio) { try { this.audio.pause(); } catch (e) { } this.audio = null; }
    if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) { }
  },
  // 依序朗读一串句子；全部读完后调用 done
  say(lines, done) {
    this.stop();
    const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    const my = this.token;
    const next = i => {
      if (my !== this.token) return;
      if (i >= list.length) { if (done) done(); return; }
      this.one(list[i].replace(/<[^>]+>/g, ''), my, () => next(i + 1));
    };
    if (!this.on) { if (done) setTimeout(done, 0); return; }
    next(0);
  },
  one(text, my, cb) {
    const key = clipKey(VOICE_NAME, text);
    const fallback = () => this.tts(text, my, cb);
    if (window.VOICE_CLIPS && window.VOICE_CLIPS[key]) {
      try {
        const au = new Audio(`audio/${key}.mp3`);
        this.audio = au;
        au.onended = () => { if (my === this.token) cb(); };
        au.onerror = () => { if (my === this.token) fallback(); };
        const p = au.play();
        if (p && p.catch) p.catch(() => { if (my === this.token && this.audio === au) fallback(); });
      } catch (e) { fallback(); }
      return;
    }
    fallback();
  },
  tts(text, my, cb) {
    if (!('speechSynthesis' in window)) { setTimeout(() => { if (my === this.token) cb(); }, 600); return; }
    try {
      speechSynthesis.cancel();
      if (!this.tv) this.pick();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ms-MY'; u.rate = .9;
      if (this.tv) u.voice = this.tv;
      u.onend = () => { if (my === this.token) cb(); };
      u.onerror = () => { if (my === this.token) cb(); };
      speechSynthesis.speak(u);
    } catch (e) { setTimeout(() => { if (my === this.token) cb(); }, 600); }
  }
};
if ('speechSynthesis' in window) { Voice.pick(); speechSynthesis.onvoiceschanged = () => Voice.pick(); }
function allVoiceLines() {
  return D.allSentences().map(t => ({ text: t, voice: VOICE_NAME, key: clipKey(VOICE_NAME, t) }));
}

/* ───────────────────────── 状态与版面 ───────────────────────── */
const S = { mode: null, portrait: false, U: 1, boost: 1, minHit: 64, sel: null };
let timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
function clearAll() { timers.forEach(clearTimeout); timers = []; Voice.stop(); cancelAnimationFrame(fxRaf); }

const stage = $('#stage'), panel = $('#panel'), playEl = $('#play');
let layer, glowSvg, fxCanvas, dbgSvg, flagEl, tagBox;
const A = {};          // 角色 id → actor；群众／老师放在 STATIC 里
let STATIC = [];

function layout() {
  const vw = innerWidth, vh = innerHeight;
  const portrait = !(vw >= 760 && vw / vh >= 1.15);
  S.portrait = portrait; playEl.classList.toggle('portrait', portrait);
  let sw;
  if (portrait) sw = Math.min(vw - 16, 560);
  else { const pw = vw >= 1100 ? 290 : 236; sw = Math.min(vw - pw - 36, (vh - 54 - 20) * 1.5); }
  sw = Math.max(280, Math.floor(sw));
  stage.style.width = sw + 'px'; stage.style.height = Math.round(sw / 1.5) + 'px';
  S.U = stage.clientWidth / W;
  S.boost = 1;   // 竖屏不放大人物；可点区域靠透明热区撑到 minHit
  S.minHit = portrait ? 44 : 64;
  if (S.mode === 'kenali' && K.portrait !== undefined && K.portrait !== portrait) { K.portrait = portrait; setTimeout(kenali, 0); }
  Object.values(A).forEach(a => { if (a.tray && a.slot != null) { const [tx, ty] = trayXY(a.slot, portrait); a.x = tx; a.y = ty; } position(a); }); STATIC.forEach(position);
  placeTags(); placeFlag(); drawDebug();
}

/* ───────────────────────── 2.5D 角色 ───────────────────────── */
function mkActor(o) {   // o: {id, spr, aspect, x, y, k, flip, cls, name, tray}
  const el = document.createElement('div');
  el.className = 'actor ' + (o.cls || '');
  el.innerHTML = '<div class="shadow"></div><div class="sp"><img alt="" draggable="false"></div>' + (o.name ? `<span class="nm">${esc(o.name)}</span>` : '');
  const img = $('img', el); img.src = o.spr;
  if (o.flip) el.classList.add('flip');
  if (o.id) el.dataset.id = o.id;
  const a = { el, img, id: o.id, x: o.x, y: o.y, aspect: o.aspect, k: o.k || 1, tray: !!o.tray, mm: o.minHit !== false };
  layer.appendChild(el);
  position(a);
  return a;
}
function sizeOf(a) {      // 角色高度（场景像素）：近大远小＋台面高度
  const st = D.onStage(N(a.x, a.y));
  const base = hOf(a.y + (st ? SC.stageLift : 0)) * (st ? SC.stageK : 1);
  return base * a.k * (a.tray ? TRAY.scale : 1);
}
function position(a) {
  const U = S.U, hp = sizeOf(a) * U * S.boost, wp = hp * a.aspect;
  const bw = a.mm ? Math.max(wp, S.minHit) : wp, bh = a.mm ? Math.max(hp, S.minHit) : hp;
  const s = a.el.style;
  s.left = (a.x * U - bw / 2) + 'px'; s.top = (a.y * U - bh) + 'px'; s.width = bw + 'px'; s.height = bh + 'px';
  if (!a.dragging) s.zIndex = Math.round(a.y);
  const sp = $('.sp', a.el); sp.style.width = wp + 'px'; sp.style.height = hp + 'px';
  $('.shadow', a.el).style.width = Math.max(wp * .78, 10) + 'px';
}
const footOf = a => N(a.x, a.y);
function setPos(a, x, y, glide) {
  if (glide) { a.el.classList.add('glide'); later(() => a.el.classList.remove('glide'), 450); }
  a.x = x; a.y = y; position(a);
}

function buildStage() {
  stage.innerHTML = '';
  const bg = document.createElement('img'); bg.className = 'bg'; bg.src = 'assets/bg45.webp'; bg.alt = ''; bg.draggable = false; stage.appendChild(bg);
  glowSvg = document.createElementNS(NS, 'svg'); glowSvg.setAttribute('class', 'glowshape'); glowSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); glowSvg.setAttribute('preserveAspectRatio', 'none');
  const poly = (id, pts) => { const p = document.createElementNS(NS, 'polygon'); p.setAttribute('class', 'gs'); p.id = id; p.setAttribute('points', pts.map(q => (q[0] * W) + ',' + (q[1] * H)).join(' ')); glowSvg.appendChild(p); };
  poly('g-pentas', R.platform); poly('g-pokok', R.bawah);
  stage.appendChild(glowSvg);
  layer = document.createElement('div'); layer.className = 'layer'; stage.appendChild(layer);
  tagBox = document.createElement('div'); tagBox.className = 'tags'; stage.appendChild(tagBox);
  fxCanvas = document.createElement('canvas'); fxCanvas.className = 'fx'; stage.appendChild(fxCanvas);
  flagEl = document.createElement('img'); flagEl.className = 'flagimg'; flagEl.src = 'assets/flag.webp'; flagEl.alt = ''; flagEl.hidden = true; flagEl.style.zIndex = 300; stage.appendChild(flagEl);
  dbgSvg = document.createElementNS(NS, 'svg'); dbgSvg.setAttribute('class', 'debug'); dbgSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); dbgSvg.setAttribute('preserveAspectRatio', 'none'); dbgSvg.style.zIndex = 4000; stage.appendChild(dbgSvg);
  // 群众与老师：固定背景人物，不可拖
  STATIC = [];
  D.crowd.forEach((c, i) => STATIC.push(Object.assign(mkActor({ spr: c.spr, aspect: 0.5, x: c.x, y: c.y, k: c.k, flip: c.flip, cls: 'static crowd', minHit: false }), { kind: 'crowd' })));
  D.teachers.seated.forEach(t => STATIC.push(Object.assign(mkActor({ spr: t.spr, aspect: 0.46, x: t.x, y: t.y, k: 1.05, cls: 'static teacher', minHit: false }), { kind: 'teacher' })));
  D.teachers.standing.forEach(t => STATIC.push(Object.assign(mkActor({ spr: t.spr, aspect: 0.9 * 0.85, x: t.x, y: t.y, k: 1.0, cls: 'static teacher', minHit: false }), { kind: 'teacher' })));
  // 图片加载后用真实长宽比
  STATIC.forEach(a => { a.img.onload = () => { a.aspect = a.img.naturalWidth / a.img.naturalHeight; position(a); }; });
}
function clearChars() { $$('.gs').forEach(g => g.classList.remove('on')); STATIC.forEach(s => s.el.classList.remove('hop', 'glow', 'pulse')); Object.keys(A).forEach(id => { A[id].el.remove(); delete A[id]; }); S.sel = null; $$('.hint', layer).forEach(h => h.remove()); }
function addChar(id, x, y, pose, opts = {}) {
  const c = CHARS[id], useFront = pose === 'front' || !c.back;
  const a = mkActor({ id, spr: useFront ? c.front : c.back, aspect: useFront ? c.af : c.ab, x, y, name: c.name, cls: opts.cls || '', tray: opts.tray });
  a.pose = pose; A[id] = a; return a;
}
function setStaticDim(crowd, teachers) { STATIC.forEach(a => a.el.classList.toggle('dim', a.kind === 'crowd' ? crowd : teachers)); }
function hop(a) { if (!a) return; a.el.classList.remove('hop'); void a.el.offsetWidth; a.el.classList.add('hop'); later(() => a.el.classList.remove('hop'), 700); }
function crowdHop() { STATIC.filter(a => a.kind === 'crowd').forEach((a, i) => later(() => hop(a), i * 18)); }
function flashRef(ref) {
  if (ref === 'pentas' || ref === 'pokok') { const g = $('#g-' + ref); g.classList.remove('on'); void g.getBoundingClientRect(); g.classList.add('on'); later(() => g.classList.remove('on'), 1500); }
  else if (A[ref]) { const e = A[ref].el; e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); later(() => e.classList.remove('pulse'), 1200); }
}

/* ───────────────────────── ?debug=1：描出判定区域 ───────────────────────── */
function drawDebug() {
  if (!dbgSvg) return; dbgSvg.innerHTML = '';
  if (!DEBUG) return;
  const add = (pts, color, label) => {
    const p = document.createElementNS(NS, 'polygon'); p.setAttribute('points', pts.map(q => (q[0] * W) + ',' + (q[1] * H)).join(' '));
    p.setAttribute('fill', color); p.setAttribute('stroke', color); dbgSvg.appendChild(p);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', pts[0][0] * W + 6); t.setAttribute('y', pts[0][1] * H + 22); t.setAttribute('fill', '#000'); t.setAttribute('font-size', 22); t.setAttribute('font-weight', 700); t.textContent = label; dbgSvg.appendChild(t);
  };
  add(R.atas, '#00a000', 'atas (pentas)'); add(R.hadapan, '#0060ff', 'hadapan (pentas)'); add(R.bawah, '#ff7a00', 'bawah (pokok)');
  add(R.crowd, '#e00000', 'murid (tidak boleh)'); add(R.tray, '#888', 'menunggu');
  Object.values(A).filter(a => a.locked || a.fixed || a.dbg).forEach(a => {   // 已站定的同学：画出前后纵列
    const h = hOf(a.y), x0 = a.x - .5 * h, x1 = a.x + .5 * h;
    const rect = (y0, y1, c, l) => add([[x0 / W, y0 / H], [x1 / W, y0 / H], [x1 / W, y1 / H], [x0 / W, y1 / H]], c, l);
    rect(a.y - 2.5 * h, a.y - .5 * h, '#8a2be2', 'hadapan ' + CHARS[a.id].name); rect(a.y + .5 * h, a.y + 2.5 * h, '#d02090', 'belakang ' + CHARS[a.id].name);
  });
}

/* ───────────────────────── 首页／切换 ───────────────────────── */
function go(mode) {
  clearAll(); S.mode = mode; if (typeof DragHint !== "undefined") DragHint.stop();
  $('#home').hidden = mode !== 'home'; playEl.hidden = mode === 'home';
  if (mode === 'home') return;
  $$('.step').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  if (!stage.firstChild) buildStage();
  layout();
  ({ kenali, jawab, susun })[mode]();
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => { Sfx.pick(); go(b.dataset.mode); }));
$('#btnHome').addEventListener('click', () => go('home'));
$('#btnVoice').addEventListener('click', e => {
  Voice.on = !Voice.on; if (!Voice.on) Voice.stop();
  e.currentTarget.innerHTML = '<span class="vl">Suara: </span>' + (Voice.on ? 'Buka' : 'Tutup'); e.currentTarget.setAttribute('aria-pressed', Voice.on);
});
addEventListener('resize', () => { if (S.mode && S.mode !== 'home') layout(); });

/* ───────────────────────── Kenali ───────────────────────── */
const K = { auto: false, paused: false, idx: 0, word: null };
function placeTags() {
  if (!tagBox) return;
  $$('.tag', tagBox).forEach(t => { const p = D.TAGS[t.dataset.word]; t.style.left = (p.x * S.U) + 'px'; t.style.top = (p.y * S.U) + 'px'; });
}
function kenali() {
  clearChars(); tagBox.innerHTML = ''; flagEl.hidden = true;
  setStaticDim(false, false); layer.dataset.names = '';
  Object.entries(D.KENALI).forEach(([id, [x, y, pose]]) => { const a = addChar(id, x, y, pose, { cls: 'kenali' }); a.el.classList.add('show-name'); a.dbg = (id === 'weihan' || id === 'sinling'); a.el.addEventListener('click', () => { const w = WORDS.find(w => D.KENALI_WHO[w].includes(id)); if (w) { K.auto = false; showWord(w); } }); });
  K.portrait = S.portrait;
  const mkTag = (w, inPanel) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tag t-' + w + (inPanel ? ' wbtn' : ''); b.dataset.word = w; b.textContent = w;
    b.addEventListener('click', e => { e.stopPropagation(); K.auto = false; showWord(w); }); return b; };
  if (!S.portrait) WORDS.forEach(w => tagBox.appendChild(mkTag(w, false)));   // 横屏：词标贴在角色旁
  placeTags();
  panel.innerHTML = `<h2>Kenali</h2>
    <button id="kOpen" class="open" type="button">${esc(D.OPENING)}</button>
    ${S.portrait ? '<div class="wgrid" id="wgrid"></div>' : ''}
    <div id="kSent" class="sent" aria-live="polite"><span class="hintline">Sentuh kata atau orang di gambar.</span></div>
    <div class="row"><button id="kAll" class="pill c-mint" type="button">Main semua</button><button id="kPause" class="pill c-sun" type="button" hidden>Henti</button></div>`;
  if (S.portrait) WORDS.forEach(w => $('#wgrid').appendChild(mkTag(w, true)));
  $('#kOpen').addEventListener('click', () => Voice.say(D.OPENING));
  $('#kAll').addEventListener('click', () => { K.auto = true; K.paused = false; K.idx = 0; $('#kAll').hidden = true; $('#kPause').hidden = false; $('#kPause').textContent = 'Henti'; autoNext(); });
  $('#kPause').addEventListener('click', () => {
    if (!K.paused) { K.paused = true; Voice.stop(); timers.forEach(clearTimeout); timers = []; $('#kPause').textContent = 'Sambung'; }
    else { K.paused = false; $('#kPause').textContent = 'Henti'; autoNext(); }
  });
  Voice.say(D.OPENING); drawDebug();
}
function autoNext() {
  if (!K.auto || K.paused) return;
  if (K.idx >= WORDS.length) { K.auto = false; $('#kAll').hidden = false; $('#kPause').hidden = true; return; }
  const w = WORDS[K.idx];
  showWord(w, () => { later(() => { K.idx++; autoNext(); }, 1000); });   // 等朗读读完，再停 1 秒
}
function showWord(w, done) {
  K.word = w;
  $$('.tag').forEach(t => t.classList.toggle('on', t.dataset.word === w));
  Object.values(A).forEach(a => a.el.classList.remove('glow', 'pulse'));
  const [pre, word, post] = D.KENALI_SENT[w];
  $('#kSent').innerHTML = `${esc(pre)}<span class="w">${esc(word)}</span>${esc(post)}` + (D.KENALI_EXTRA[w] ? `<div class="hintline">${esc(D.KENALI_EXTRA[w])}</div>` : '');
  D.KENALI_WHO[w].forEach(id => { if (id === 'crowd') { crowdHop(); } else { hop(A[id]); A[id].el.classList.add('glow'); } });
  const ref = D.KENALI_REF[w]; later(() => flashRef(ref), 250);
  Sfx.pop();
  const lines = [w, pre + word + post]; if (D.KENALI_EXTRA[w]) lines.push(D.KENALI_EXTRA[w]);
  Voice.say(lines, () => { later(() => Object.values(A).forEach(a => a.el.classList.remove('glow')), 600); if (done) done(); });
}

/* ───────────────────────── Jawab ───────────────────────── */
const J = { i: 0, errs: 0, locked: false, right: 0 };
function jawab() { J.i = 0; J.right = 0; jQuestion(); }
function jQuestion() {
  J.errs = 0; J.locked = false;
  const q = D.Q[J.i];
  clearChars(); tagBox.innerHTML = ''; flagEl.hidden = true;
  setStaticDim(!q.hi.includes('crowd'), true); layer.dataset.names = '';
  Object.entries(q.lay).forEach(([id, [x, y, pose]]) => { const a = addChar(id, x, y, pose); if (q.hi.includes(id) || id === q.ref) a.el.classList.add('show-name'); });
  const ask = A[q.hi.find(h => A[h])];
  const dots = D.Q.map((_, k) => `<i class="${k < J.i ? 'done' : k === J.i ? 'now' : ''}"></i>`).join('');
  panel.innerHTML = `<h2>Jawab <small>${J.i + 1}/${D.Q.length}</small></h2>
    <div class="card"><p class="q" id="jQ">${esc(q.pre)} <span class="blank">&nbsp;&nbsp;&nbsp;</span> ${esc(q.post)}</p><button id="jListen" class="pill sm c-cloud" type="button">Dengar</button></div>
    <div class="opts">${shuffle(WORDS).map(w => `<button class="opt" type="button" data-word="${w}">${w}</button>`).join('')}</div>
    <p id="jfb" class="fb neutral">Pilih kata yang betul.</p><div class="dots" aria-hidden="true">${dots}</div>`;
  $('#jListen').addEventListener('click', () => Voice.say(`${q.pre} ... ${q.post}`));
  $$('.opt').forEach(b => b.addEventListener('click', () => jPick(b)));
  Voice.say(`${q.pre} ... ${q.post}`);
}
function jPick(btn) {
  if (J.locked) return;
  const q = D.Q[J.i], w = btn.dataset.word, fb = $('#jfb');
  if (w === q.ans) {
    J.locked = true; J.right++;
    btn.classList.add('ok'); fb.className = 'fb good'; fb.textContent = 'Betul!';
    $('#jQ').innerHTML = `${esc(q.pre)} <span class="blank w">${esc(w)}</span> ${esc(q.post)}`;
    q.hi.forEach(id => id === 'crowd' ? crowdHop() : hop(A[id]));
    Sfx.good();
    Voice.say(['Betul!', `${q.pre} ${q.ans} ${q.post}`], () => later(jNext, 700));
  } else {
    btn.classList.add('no'); btn.disabled = true; Sfx.bad(); flashRef(q.ref === 'pentas' || q.ref === 'pokok' ? q.ref : q.ref);
    J.errs++;
    if (J.errs >= 2) {
      J.locked = true; fb.className = 'fb bad'; fb.textContent = q.expl;
      $$('.opt').forEach(b => { if (b.dataset.word === q.ans) b.classList.add('ok'); });
      q.hi.forEach(id => id === 'crowd' ? crowdHop() : hop(A[id]));
      Voice.say([q.expl], () => later(jNext, 900));
    } else { fb.className = 'fb bad'; fb.textContent = 'Cuba lagi.'; Voice.say('Cuba lagi.'); }
  }
}
function jNext() {
  J.i++;
  if (J.i >= D.Q.length) {
    clearChars(); setStaticDim(false, false);
    panel.innerHTML = `<div class="final"><h2>Tahniah!</h2><p class="hintline">${J.right}/${D.Q.length}</p><button id="jAgain" class="pill c-mint" type="button">Main lagi</button><button id="jSusun" class="pill c-berry" type="button">Susun</button></div>`;
    $('#jAgain').addEventListener('click', () => go('jawab')); $('#jSusun').addEventListener('click', () => go('susun'));
    Sfx.good(); Voice.say('Tahniah!'); return;
  }
  jQuestion();
}

/* ───────────────────────── Susun：小班长排周会 ───────────────────────── */
const T = { level: 1, tasks: [], idx: 0, errs: 0, finished: false, unlocked: Math.max(1, +store.get('kb-unlocked') || 1), hist: {} };
const levelTitle = n => ({ 1: 'Tahap 1', 2: 'Tahap 2', 3: 'Tahap 3' })[n];
function susun() { startLevel(Math.min(T.unlocked, 3) === 1 ? 1 : T.level <= T.unlocked ? T.level : 1); }

function pickTasks(level) {
  // 每关从题库随机抽；不与上一次抽到的组合完全相同
  for (let tries = 0; tries < 200; tries++) {
    let ts;
    if (level === 3) ts = D.CHAINS[Math.floor(Math.random() * D.CHAINS.length)].map(t => ({ ...t }));
    else {
      const n = level === 1 ? 3 : 4, pool = shuffle(D.BANK1);
      ts = []; const who = new Set(), fixedRefs = new Set();
      for (const t of pool) {
        const isP = t.ref !== 'pentas' && t.ref !== 'pokok';
        if (who.has(t.who) || fixedRefs.has(t.who)) continue;
        if (isP && (who.has(t.ref) || fixedRefs.size >= 3)) continue;
        if (isP && ts.some(o => o.ref === t.ref)) continue;
        ts.push({ ...t }); who.add(t.who); if (isP) fixedRefs.add(t.ref);
        if (ts.length === n) break;
      }
      if (ts.length < n) continue;
      if (level === 2 && !ts.some(t => t.ref !== 'pentas' && t.ref !== 'pokok')) continue;
      if (level === 1 && ts.filter(t => t.ref !== 'pentas' && t.ref !== 'pokok').length > 1) continue;
      // 先放「谁在谁前后」的参照要靠 fixed 的人，所以任务里被当参照的人不能同时是要放的人（上面已排除）
    }
    const sig = ts.map(t => t.who + t.word + t.ref).join('|');
    if (sig !== T.hist[level]) { T.hist[level] = sig; return ts; }
  }
  return D.BANK1.slice(0, 3);
}

function startLevel(n) {
  clearAll(); T.level = n; T.idx = 0; T.errs = 0; T.finished = false; S.sel = null;
  clearChars(); tagBox.innerHTML = ''; flagEl.hidden = true; fxClear();
  setStaticDim(false, false); layer.dataset.names = 'faint';
  T.tasks = pickTasks(n);
  // 固定的参照同学（站在跑道上，不可拖）
  const refs = [...new Set(T.tasks.map(t => t.ref).filter(r => r !== 'pentas' && r !== 'pokok' && !T.tasks.some(o => o.who === r)))];
  refs.forEach((id, i) => { const a = addChar(id, D.FIXED_X[i], D.FIXED_Y, 'back'); a.fixed = true; a.el.classList.add('static', 'show-name'); });
  // 其余的人在候场区（场景最下方一条地面带）
  const rest = IDS.filter(id => !A[id]);
  rest.forEach((id, i) => { const [tx, ty] = trayXY(i, S.portrait); const a = addChar(id, tx, ty, id === 'mohan' ? 'front' : 'back', { tray: true, cls: 'movable tray-item' }); a.slot = i; bindDrag(a); });
  renderCard();
  speakCmd();
  drawDebug();
  DragHint.show(() => { const f = rest.find(id => A[id] && A[id].tray); return f && A[f].el; });
}
/* ── 拖拽示范小手：Susun 开场循环示范「按住→拖到场景」，学生第一次碰到可拖的东西就永久收起 ── */
const DragHint = (() => {
  let el = null, anim = null, timer = 0, learned = false;
  function stop() { clearTimeout(timer); timer = 0; if (anim) { anim.cancel(); anim = null; } if (el) { el.remove(); el = null; } }
  function loop(srcFn) {
    const src = srcFn(), st = document.getElementById('stage');
    if (learned || !src || !st) return stop();
    const a = src.getBoundingClientRect(), b = st.getBoundingClientRect();
    if (!a.width || !b.width) { timer = setTimeout(() => loop(srcFn), 600); return; }
    const x0 = a.left + a.width / 2, y0 = a.top + a.height * .45, x1 = b.left + b.width * .5, y1 = b.top + b.height * .42;
    if (!el) { el = document.createElement('div'); el.className = 'drag-hint'; el.setAttribute('aria-hidden', 'true'); el.textContent = '👆'; document.body.append(el); }
    const at = (x, y, s, o) => ({ transform: `translate(${x}px, ${y}px) translate(-35%, -12%) scale(${s})`, opacity: o });
    anim = el.animate([at(x0, y0, 1, 0), at(x0, y0, 1, 1), at(x0, y0, .85, 1), at(x0, y0, .85, 1), at(x1, y1, .85, 1), at(x1, y1, .85, 1), at(x1, y1, 1, 0)],
      { duration: 2800, offsets: [0, .12, .22, .3, .72, .82, 1], easing: 'ease-in-out', fill: 'both' });
    anim.onfinish = () => { timer = setTimeout(() => loop(srcFn), 900); };
  }
  document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.movable, .tray-item')) { learned = true; stop(); } }, true);
  return { show(srcFn) { stop(); if (learned) return; timer = setTimeout(() => loop(srcFn), 900); }, stop };
})();

function renderCard(msg, kind) {
  const t = T.tasks[T.idx];
  const lv = [1, 2, 3].map(n => `<button class="lvl ${n === T.level ? 'on' : ''} ${n < T.unlocked ? 'done' : ''}" data-lv="${n}" type="button" ${n > T.unlocked ? 'disabled' : ''}>${n > T.unlocked ? '<span class="lock"></span>' : ''}${levelTitle(n)}</button>`).join('');
  const dots = T.tasks.map((_, k) => `<i class="${k < T.idx ? 'done' : k === T.idx ? 'now' : ''}"></i>`).join('');
  let cmd = '';
  if (t && !T.finished) { const c = SENT.cmd(t); cmd = esc(c).replace(t.word, `<span class="kw">${t.word}</span>`); }
  panel.innerHTML = `<div class="lvls" role="group" aria-label="Tahap">${lv}</div>
    <div class="card"><p class="cmd" id="cmd">${cmd || 'Tahniah!'}</p><button id="sListen" class="pill sm c-cloud" type="button">Dengar</button></div>
    <p id="sfb" class="fb ${kind || 'neutral'}">${esc(msg || 'Seret murid ke tempat yang betul, atau sentuh murid dahulu, kemudian sentuh tempatnya.')}</p>
    <div class="dots" aria-hidden="true">${dots}</div>
    <button id="sReset" class="pill sm c-sun" type="button">Mula semula</button>`;
  $$('.lvl').forEach(b => b.addEventListener('click', () => startLevel(+b.dataset.lv)));
  $('#sReset').addEventListener('click', () => startLevel(T.level));
  $('#sListen').addEventListener('click', speakCmd);
}
function setFb(msg, kind) { const e = $('#sfb'); if (e) { e.textContent = msg; e.className = 'fb ' + kind; } }
function speakCmd(done) { const t = T.tasks[T.idx]; if (t && !T.finished) Voice.say(SENT.cmd(t), done); }
const curTask = () => T.tasks[T.idx];
const refFoot = ref => (typeof ref === 'string' && A[ref]) ? footOf(A[ref]) : ref;   // 'pentas'|'pokok' 原样返回
const refKey = t => (t.ref === 'pentas' || t.ref === 'pokok') ? t.ref : footOf(A[t.ref]);

/* ── 拖拽（Pointer Events）＋ 点角色→点位置 ── */
function scenePt(e) { const r = stage.getBoundingClientRect(), b = 4; return { x: (e.clientX - r.left - b) / S.U, y: (e.clientY - r.top - b) / S.U }; }
function bindDrag(a) {
  const el = a.el; let st = null;
  el.addEventListener('pointerdown', e => {
    if (a.locked || T.finished) return;
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch (_) { }
    const p = scenePt(e); st = { sx: e.clientX, sy: e.clientY, ox: p.x - a.x, oy: p.y - a.y, moved: false, id: e.pointerId };
  });
  el.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < 6) return;
    if (!st.moved) { st.moved = true; a.dragging = true; el.classList.add('drag'); el.classList.remove('glide'); el.style.zIndex = 5000; a.tray && (a.tray = false); Sfx.pick(); clearSel(); }
    const p = scenePt(e); a.x = clamp(p.x - st.ox, 0, W); a.y = clamp(p.y - st.oy, 0, H); position(a); el.style.zIndex = 5000;
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    try { el.releasePointerCapture(e.pointerId); } catch (_) { }
    if (s.moved) { a.dragging = false; el.classList.remove('drag'); place(a.id, footOf(a)); }
    else {
      // 已选中另一位时：点在候场带之上＝要放置（热区比小人大，不能被别人的热区吃掉）
      const p = scenePt(e);
      if (S.sel && S.sel !== a.id && p.y < 925) tapPlace(p); else selectActor(a);
    }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', e => { if (st && st.moved) { a.dragging = false; el.classList.remove('drag'); sendBack(a); } st = null; });
}
function clearSel() { if (S.sel) { A[S.sel] && A[S.sel].el.classList.remove('sel'); S.sel = null; } }
function selectActor(a) {
  if (S.sel === a.id) { clearSel(); return; }
  clearSel(); S.sel = a.id; a.el.classList.add('sel'); Sfx.pick();
  setFb(`${CHARS[a.id].name}: sentuh tempatnya.`, 'neutral');
}
// 点位置：舞台上空白处（非可拖角色）
let tapSt = null;
stage.addEventListener('pointerdown', e => { tapSt = { x: e.clientX, y: e.clientY, t: Date.now() }; });
stage.addEventListener('pointerup', e => {
  if (!tapSt || S.mode !== 'susun' || !S.sel || T.finished) { tapSt = null; return; }
  const moved = Math.hypot(e.clientX - tapSt.x, e.clientY - tapSt.y); tapSt = null;
  if (moved > 8) return;
  if (e.target.closest('.actor.movable')) return;
  tapPlace(scenePt(e));
});

function tapPlace(p) {
  const a = A[S.sel]; if (!a) return;
  const id = S.sel; clearSel(); a.el.classList.add('glide'); a.tray = false; setPos(a, clamp(p.x, 0, W), clamp(p.y, 0, H), true);
  later(() => place(id, footOf(a)), 260);
}
function sendBack(a) {
  const [tx, ty] = trayXY(a.slot, S.portrait); a.tray = true; a.el.classList.add('tray-item');
  setPos(a, tx, ty, true); hopSoon(a);
}
const hopSoon = a => later(() => { a.el.classList.remove('shake'); }, 400);

/* ── 放置判定（点拖放与两步放置共用）── */
function place(id, foot) {
  const a = A[id], t = curTask(); if (!a || !t || T.finished) return;
  const px = D.toPx(foot);
  // 放回候场区：不算错
  if (D.inTray(foot)) { a.tray = true; a.el.classList.add('tray-item'); a.el.classList.add('glide'); const [tx, ty] = trayXY(a.slot, S.portrait); setPos(a, tx, ty, true); return; }
  a.el.classList.remove('tray-item');
  const bounce = () => { a.el.classList.add('shake'); later(() => sendBack(a), 220); };
  if (D.inCrowd(foot)) { setFb('Cuba lagi.', 'bad'); Sfx.bad(); Voice.say('Cuba lagi.'); bounce(); return; }
  if (id !== t.who) { const m = SENT.notThis(t.who); setFb(m, 'bad'); Sfx.bad(); Voice.say(m); bounce(); return; }
  const got = classify(refKey(t), foot);
  if (got === t.word) { success(a, t, px); return; }
  // 放错：说出他实际放的位置（先看被问的参照物，再看别的参照物）
  T.errs++;
  Sfx.bad();
  const cands = [[t.ref, classify(refKey(t), foot)], ['pentas', classify('pentas', foot)], ['pokok', classify('pokok', foot)]];
  Object.keys(A).filter(k => k !== id && (A[k].locked || A[k].fixed)).forEach(k => cands.push([k, classify(footOf(A[k]), foot)]));
  const hit = cands.find(c => c[1]);
  const lines = [];
  if (hit) { const m = SENT.youPut(id, hit[1], hit[0]); lines.push(m, SENT.tryWord(t.word)); setFb(`${m} ${SENT.tryWord(t.word)}`, 'bad'); }
  else { lines.push('Cuba lagi.'); setFb('Cuba lagi.', 'bad'); flashRef(t.ref); }
  Voice.say(lines);
  bounce();
  if (T.errs >= 2) showHint(t);
}
function success(a, t, px) {
  clearHint();
  a.locked = true; a.tray = false; a.el.classList.remove('movable', 'tray-item', 'sel'); a.el.classList.add('static', 'show-name');
  // 轻吸附：排队关的第一位放进跑道（其余人要排在他前后，不被群众挡住）
  if (T.level === 3 && T.idx === 0 && t.ref === 'pentas') {
    const sx = clamp(px.x, D.ANCHOR_SNAP.x[0], D.ANCHOR_SNAP.x[1]), sy = clamp(px.y, D.ANCHOR_SNAP.y[0], D.ANCHOR_SNAP.y[1]);
    setPos(a, sx, sy, true);
  } else setPos(a, px.x, px.y, true);
  hop(a); Sfx.good();
  const msg = SENT.cmd(t); setFb(msg, 'good');
  T.errs = 0; T.idx++;
  if (T.idx >= T.tasks.length) { T.finished = true; Voice.say(msg, () => later(finale, 300)); renderCard(msg, 'good'); $('#cmd').textContent = 'Tahniah!'; return; }
  Voice.say(msg, () => later(() => { renderCard(); drawDebug(); speakCmd(); }, 400));
  drawDebug();
}

/* ── 提示光：同一条口令错 2 次后才出现 ── */
function clearHint() { $$('.hint', layer).forEach(h => h.remove()); }
function goodFoot(t) {    // 一个一定判对的脚点（像素）
  const key = refKey(t);
  let c;
  if (key === 'pentas') c = t.word === 'atas' ? { x: 500, y: 250 } : { x: 520, y: 455 };
  else if (key === 'pokok') c = { x: 1230, y: 482 };
  else {
    const r = D.toPx(key), h = hOf(r.y); c = { x: r.x, y: t.word === 'belakang' ? r.y + .95 * h : r.y - .85 * h };
    c.y = clamp(c.y, 378, 1000);
    if (classify(key, N(c.x, c.y)) !== t.word) { for (let y = 372; y < 1000; y += 4) if (classify(key, N(r.x, y)) === t.word && !D.inCrowd(N(r.x, y))) { c = { x: r.x, y }; if (t.word === 'hadapan') break; if (y > r.y + .9 * h) break; } }
  }
  return c;
}
function showHint(t) {
  clearHint(); const c = goodFoot(t), d = document.createElement('div'); d.className = 'hint';
  const sz = 150 * S.U; d.style.cssText = `left:${c.x * S.U}px;top:${(c.y - hOf(c.y) * .45) * S.U}px;width:${sz}px;height:${sz}px;z-index:4500`;
  layer.appendChild(d);
}

/* ── 结局：升旗＋彩带＋星星 ── */
let fxRaf = 0;
function fxClear() { if (fxCanvas) { const c = fxCanvas.getContext('2d'); c.clearRect(0, 0, fxCanvas.width, fxCanvas.height); } }
const FLAG = { poleX: 944, w: 150, topY: 46, baseY: 262 };   // 旗杆在场景图里的位置（实测）：x≈944，杆顶 y≈40，杆座 y≈330
function placeFlag() {
  if (!flagEl) return;
  const U = S.U, w = FLAG.w * U; flagEl.style.width = w + 'px';
  flagEl.style.left = ((FLAG.poleX + 2) * U - w * 0.075) + 'px';
  flagEl.style.top = (FLAG.topY * U) + 'px';
  const y = flagEl.dataset.dy ? +flagEl.dataset.dy : 0; flagEl.style.transform = `translateY(${y * U}px)`;
}
function raiseFlag(ms = 3000) {
  flagEl.hidden = false; flagEl.dataset.dy = FLAG.baseY - FLAG.topY; placeFlag();
  const t0 = performance.now(), from = FLAG.baseY - FLAG.topY;
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    flagEl.dataset.dy = from * (1 - e); placeFlag();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function confetti(ms = 3600) {
  const c = fxCanvas, dpr = Math.min(2, devicePixelRatio || 1);
  c.width = stage.clientWidth * dpr; c.height = stage.clientHeight * dpr;
  const ctx = c.getContext('2d'), cols = ['#FF8FB1', '#FFC93C', '#4CC9A8', '#7DB1FF', '#FFFFFF', '#FF7A59'];
  const ps = Array.from({ length: 110 }, (_, i) => ({ x: Math.random() * c.width, y: -Math.random() * c.height * .6, vx: (Math.random() - .5) * 2.2 * dpr, vy: (1.5 + Math.random() * 3) * dpr, r: (5 + Math.random() * 7) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, col: cols[i % cols.length], star: i % 4 === 0 }));
  const t0 = performance.now();
  const star = (x, y, r, rot) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const loop = now => {
    const el = now - t0; ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = 'rgba(90,55,43,.8)';
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; ctx.fillStyle = p.col; ctx.globalAlpha = Math.max(0, 1 - Math.max(0, el - ms + 800) / 800);
      if (p.star) star(p.x, p.y, p.r * 1.3, p.rot); else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r / 3, p.r * 2, p.r * .66); ctx.restore(); }
    });
    ctx.globalAlpha = 1;
    if (el < ms) fxRaf = requestAnimationFrame(loop); else ctx.clearRect(0, 0, c.width, c.height);
  };
  fxRaf = requestAnimationFrame(loop);
}
function finale() {
  clearSel(); clearHint();
  const lvl = T.level, last = lvl === 3;
  // Cikgu Mohan 站到台上跳起来
  const m = A.mohan;
  if (m) { if (!m.locked) { m.el.classList.remove('movable', 'tray-item'); m.el.classList.add('static'); m.tray = false; setPos(m, 520, 258, true); } later(() => { m.el.classList.remove('hop'); m.el.classList.add('jump'); later(() => m.el.classList.remove('jump'), 1900); }, 500); }
  raiseFlag(3000); confetti(); Sfx.good();
  if (T.unlocked < Math.min(3, lvl + 1)) { T.unlocked = Math.min(3, lvl + 1); store.set('kb-unlocked', T.unlocked); }
  const say = last ? 'Tahniah! Kita kibarkan bendera!' : 'Tahniah!';
  Voice.say(say);
  later(() => {
    renderCard(say, 'good'); $('#cmd').textContent = say;
    const nx = lvl < 3 ? `<button id="sNext" class="pill c-mint" type="button">${levelTitle(lvl + 1)}</button>` : '';
    $('#sReset').insertAdjacentHTML('beforebegin', nx + `<button id="sAgain" class="pill c-berry" type="button">Main lagi</button>`);
    $('#sNext') && $('#sNext').addEventListener('click', () => startLevel(lvl + 1));
    $('#sAgain').addEventListener('click', () => startLevel(lvl));
  }, 600);
}

/* ───────────────────────── 暴露给测试与 gen-voice ───────────────────────── */
function target() { const t = curTask(); if (!t) return null; const c = goodFoot(t); return { id: t.who, word: t.word, ref: t.ref, foot: N(c.x, c.y), task: t }; }
window.__kataarah = { allVoiceLines, classify, scenes: D, go, S, T, K, J, A, startLevel, target, footOf, place, goodFoot, flagInfo: FLAG, unlock: n => { T.unlocked = n; } };
go('home');
