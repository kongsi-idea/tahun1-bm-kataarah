/* scenes.js — 场景数据 + 位置判定（纯函数，浏览器与测试都能直接调用）
 * 区域坐标先用「场景图 1536×1024 像素」量出来，经 N() 归一化成 0–1 再存。
 * classify(ref, foot)：foot 是角色脚点（归一化）；ref 是 'pentas' | 'pokok' | 另一位同学的脚点 {x,y}。
 * 场景里不画任何格子；?debug=1 时 app.js 才把这些区域描出来。 */
(function () {
  const W = 1536, H = 1024;
  const N = a => a.map(([x, y]) => [+(x / W).toFixed(4), +(y / H).toFixed(4)]);
  const toPx = p => ({ x: p.x * W, y: p.y * H });

  /* ───────── 2.5D 参数 ───────── */
  // 角色高度（场景像素）随脚点 y 线性变化：越靠近舞台（y 小）越小。y=400 时约为 y=1000 的 0.57。
  const SC = { base: 120, y0: 300, k: 0.17, stageLift: 36, stageK: 1.0 };
  const hOf = y => SC.base + (y - SC.y0) * SC.k;

  /* ───────── 区域（互不重叠）───────── */
  const R = {
    // 台面（整块可站的面）与 atas＝台面前半部
    platform: N([[250, 190], [330, 160], [500, 146], [680, 150], [760, 185], [800, 240], [790, 262], [600, 296], [440, 298], [280, 286], [190, 262]]),
    atas: N([[222, 228], [300, 206], [500, 196], [700, 200], [772, 224], [790, 252], [600, 288], [440, 292], [285, 281], [205, 260]]),
    // hadapan pentas＝舞台前地面带（含右边通往跑道的一段，到树影之前）
    hadapan: N([[118, 372], [1060, 372], [1060, 528], [118, 528]]),
    // bawah pokok＝树冠投影下、靠近树干／花圃的地面
    bawah: N([[1075, 440], [1160, 392], [1250, 370], [1500, 370], [1536, 398], [1536, 545], [1420, 568], [1230, 565], [1110, 512]]),
    // 群众队伍占的地面（角色不可放进去）
    crowd: N([[268, 548], [905, 548], [905, 838], [268, 838]]),
    // 候场区（放到这里＝放回去）
    tray: N([[300, 925], [1330, 925], [1330, 1024], [300, 1024]])
  };

  function inPoly(p, poly) {   // p：像素点；poly：归一化多边形
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0] * W, yi = poly[i][1] * H, xj = poly[j][0] * W, yj = poly[j][1] * H;
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const inCrowd = f => inPoly(toPx(f), R.crowd);
  const inTray = f => inPoly(toPx(f), R.tray);
  const onStage = f => inPoly(toPx(f), R.platform);
  const walkable = p => p.y >= 366 && p.y <= 1008 && p.x >= 100 && p.x <= 1500 && !inPoly(p, R.crowd);

  // 人形参照物：同一纵列（|dx| ≤ 0.5 个身高）、纵向相隔 0.5–2.5 个身高
  const COL = 0.5, GAP_MIN = 0.5, GAP_MAX = 2.5;
  function classify(ref, f) {
    const p = toPx(f);
    if (ref === 'pentas') return inPoly(p, R.atas) ? 'atas' : inPoly(p, R.hadapan) ? 'hadapan' : null;
    if (ref === 'pokok') return inPoly(p, R.bawah) ? 'bawah' : null;
    if (ref && typeof ref === 'object') {
      if (!walkable(p)) return null;
      const r = toPx(ref), h = hOf(r.y), dy = p.y - r.y;
      if (Math.abs(p.x - r.x) > COL * h) return null;
      if (dy >= GAP_MIN * h && dy <= GAP_MAX * h) return 'belakang';
      if (-dy >= GAP_MIN * h && -dy <= GAP_MAX * h) return 'hadapan';
    }
    return null;
  }

  /* ───────── 角色 ───────── */
  const CHARS = {
    weihan: { name: 'Wei Han', back: 'assets/weihan-back.webp', front: 'assets/weihan-front.webp', ab: 200 / 360, af: 204 / 360 },
    zali: { name: 'Zali', back: 'assets/zali-back.webp', front: 'assets/zali-front.webp', ab: 198 / 360, af: 211 / 358 },
    nani: { name: 'Nani', back: 'assets/nani-back.webp', front: 'assets/nani-front.webp', ab: 196 / 360, af: 198 / 360 },
    sinling: { name: 'Sin Ling', back: 'assets/sinling-back.webp', front: 'assets/sinling-front.webp', ab: 228 / 360, af: 273 / 360 },
    rani: { name: 'Rani', back: 'assets/rani-back.webp', front: 'assets/rani-front.webp', ab: 233 / 360, af: 321 / 360 },
    mohan: { name: 'Cikgu Mohan', back: null, front: 'assets/mohan-front.webp', ab: 201 / 360, af: 201 / 360 }
  };
  const IDS = Object.keys(CHARS);
  const nameOf = id => id === 'pentas' ? 'pentas' : id === 'pokok' ? 'pokok' : CHARS[id].name;

  /* ───────── 候场区（场景里的一条地面带，不画框）───────── */
  const TRAY = { y: 985, scale: 0.8, xs: [400, 520, 640, 760, 880, 1000] };
  // 竖屏候场区：两排错开，任意两人点击框不重叠（横向间距 200 场景像素 ≈ 竖屏 47px）
  const TRAY_P = [[300, 932], [500, 1004], [700, 932], [900, 1004], [1100, 932], [1300, 1004]];
  const trayXY = (i, portrait) => portrait ? TRAY_P[i] : [TRAY.xs[i], TRAY.y];
  const trayFoot = i => ({ x: +(TRAY.xs[i] / W).toFixed(4), y: +(TRAY.y / H).toFixed(4) });

  /* ───────── 群众与老师（固定背景人物）───────── */
  const CROWD_SPR = ['a1', 'b2', 'c3', 'a4', 'b5', 'c1', 'a2', 'b3', 'c4', 'a5', 'b1', 'c2', 'a3', 'b4', 'c5'];
  const rows = [{ y: 590, n: 6, x0: 322 }, { y: 662, n: 5, x0: 378 }, { y: 736, n: 6, x0: 322 }, { y: 810, n: 5, x0: 378 }];
  const crowd = [];
  let ci = 0;
  rows.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const spr = CROWD_SPR[(ci * 4 + ri) % 15]; // 步长 4（与 15 互质）：相邻两人一定不同
      crowd.push({ spr: 'assets/crowd-' + spr + '.webp', x: r.x0 + i * 108 + ((ci * 7) % 9) - 4, y: r.y + ((ci * 5) % 7) - 3, flip: (ci % 3) === 1, k: 0.96 + ((ci * 3) % 5) * 0.02 });
      ci++;
    }
  });
  const teachers = {
    seated: [{ spr: 'assets/teacher-seat1.webp', x: 335, y: 214 }, { spr: 'assets/teacher-seat2.webp', x: 450, y: 204 }, { spr: 'assets/teacher-seat3.webp', x: 565, y: 204 }, { spr: 'assets/teacher-seat4.webp', x: 680, y: 214 }],
    standing: [{ spr: 'assets/teacher-stand1.webp', x: 222, y: 668 }, { spr: 'assets/teacher-stand2.webp', x: 262, y: 786 }, { spr: 'assets/teacher-stand3.webp', x: 950, y: 690 }]
  };

  /* ───────── 场景布置（Kenali／Jawab 用）：id → [x, y, 朝向] ───────── */
  const RW = { c1: 1085, c2: 1320 };         // 跑道上两列的 x
  const KENALI = {
    mohan: [500, 256, 'front'], weihan: [RW.c1, 628, 'back'], zali: [RW.c1, 778, 'back'],
    sinling: [RW.c2, 628, 'back'], nani: [RW.c2, 778, 'back'], rani: [1215, 488, 'front']
  };
  const TAGS = { atas: { x: 640, y: 236 }, hadapan: { x: 560, y: 402 }, belakang: { x: 1202, y: 706 }, bawah: { x: 1215, y: 316 } };
  // 课文句（Kenali 例句）：[前, 词, 后]
  const KENALI_SENT = {
    atas: ['Cikgu Mohan berdiri di ', 'atas', ' pentas.'],
    hadapan: ['Murid-murid berhimpun di ', 'hadapan', ' pentas.'],
    belakang: ['Zali berdiri di ', 'belakang', ' Wei Han.'],
    bawah: ['Rani berdiri di ', 'bawah', ' pokok.']
  };
  const KENALI_EXTRA = { belakang: 'Wei Han di hadapan. Zali di belakang Wei Han.' };
  const KENALI_WHO = { atas: ['mohan'], hadapan: ['crowd'], belakang: ['zali'], bawah: ['rani'] };
  const KENALI_REF = { atas: 'pentas', hadapan: 'pentas', belakang: 'weihan', bawah: 'pokok' };
  const OPENING = 'Semua murid menghadap pentas.';

  /* ───────── Jawab：8 题（前 4 题＝课本 BA 28）───────── */
  const Q = [
    { pre: 'Murid-murid berkumpul di', post: 'guru.', ans: 'hadapan', hi: ['crowd', 'mohan'], ref: 'mohan', lay: { mohan: [500, 256, 'front'] }, expl: 'Murid-murid ada di hadapan guru.' },
    { pre: 'Nani berdiri di', post: 'Sin Ling.', ans: 'belakang', hi: ['nani', 'sinling'], ref: 'sinling', lay: { sinling: [1140, 600, 'back'], nani: [1140, 752, 'back'] }, expl: 'Nani ada di belakang Sin Ling.' },
    { pre: 'Cikgu Mohan berdiri di', post: 'pentas.', ans: 'atas', hi: ['mohan'], ref: 'pentas', lay: { mohan: [500, 256, 'front'] }, expl: 'Cikgu Mohan ada di atas pentas.' },
    { pre: 'Rani berdiri di', post: 'pokok.', ans: 'bawah', hi: ['rani'], ref: 'pokok', lay: { rani: [1235, 492, 'front'] }, expl: 'Rani ada di bawah pokok.' },
    { pre: 'Sin Ling berdiri di', post: 'Nani.', ans: 'hadapan', hi: ['sinling', 'nani'], ref: 'nani', lay: { sinling: [1090, 600, 'back'], nani: [1090, 752, 'back'] }, expl: 'Sin Ling ada di hadapan Nani.' },
    { pre: 'Zali berdiri di', post: 'Wei Han.', ans: 'belakang', hi: ['zali', 'weihan'], ref: 'weihan', lay: { weihan: [1270, 600, 'back'], zali: [1270, 752, 'back'] }, expl: 'Zali ada di belakang Wei Han.' },
    { pre: 'Murid-murid berhimpun di', post: 'pentas.', ans: 'hadapan', hi: ['crowd'], ref: 'pentas', lay: {}, expl: 'Murid-murid ada di hadapan pentas.' },
    // 第 8 题（自选）：从另一位的角度问同一列——Wei Han 在 Zali 前面
    { pre: 'Wei Han berdiri di', post: 'Zali.', ans: 'hadapan', hi: ['weihan', 'zali'], ref: 'zali', lay: { weihan: [1200, 596, 'back'], zali: [1200, 748, 'back'] }, expl: 'Wei Han ada di hadapan Zali.' }
  ];

  /* ───────── Susun 题库 ───────── */
  // 每题：who 要放的人、word 词、ref 参照物（'pentas'|'pokok'|角色 id）。ref 是角色时先把他固定站在 fixed 指定的位置。
  const T = (who, word, ref) => ({ who, word, ref });
  const BANK1 = [T('mohan', 'atas', 'pentas'), T('rani', 'bawah', 'pokok'), T('weihan', 'hadapan', 'pentas'), T('sinling', 'hadapan', 'pentas'),
                 T('zali', 'belakang', 'nani'), T('nani', 'belakang', 'sinling'), T('sinling', 'hadapan', 'nani'), T('weihan', 'hadapan', 'zali')];
  const FIXED_X = [1075, 1220, 1365];   // 固定参照同学站的 x（y=610）
  const FIXED_Y = 610;
  // 排队关：连环口令（后一条依赖前一条放好的人）；第一条的人放对后会轻轻滑进跑道（snap）
  const CHAINS = [
    [T('weihan', 'hadapan', 'pentas'), T('zali', 'belakang', 'weihan'), T('nani', 'belakang', 'zali'), T('sinling', 'hadapan', 'weihan')],
    [T('sinling', 'hadapan', 'pentas'), T('rani', 'belakang', 'sinling'), T('zali', 'belakang', 'rani'), T('nani', 'hadapan', 'sinling')]
  ];
  const ANCHOR_SNAP = { x: [1010, 1055], y: [500, 525] };

  /* ───────── 句子（朗读与文字共用）───────── */
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const SENT = {
    cmd: t => `${CHARS[t.who].name} berdiri di ${t.word} ${nameOf(t.ref)}.`,
    youPut: (who, w, ref) => `Kamu letak ${CHARS[who].name} di ${w} ${nameOf(ref)}.`,
    tryWord: w => `Cuba ${w}.`,
    notThis: who => `Itu bukan ${CHARS[who].name}. Cari ${CHARS[who].name}.`
  };

  /* ───────── 全部要朗读的句子（gen-voice.py 用）───────── */
  const VOICE_NAME = 'ms-MY-YasminNeural';
  function allSentences() {
    const s = new Set(['Betul!', 'Cuba lagi.', 'Tahniah!', 'Tahniah! Kita kibarkan bendera!', OPENING, 'Tahap 1', 'Tahap 2', 'Tahap 3']);
    ['atas', 'bawah', 'belakang', 'hadapan'].forEach(w => { s.add(w); s.add(SENT.tryWord(w)); });
    for (const w in KENALI_SENT) s.add(KENALI_SENT[w].join(''));
    for (const w in KENALI_EXTRA) s.add(KENALI_EXTRA[w]);
    Q.forEach(q => { s.add(`${q.pre} ... ${q.post}`); s.add(`${q.pre} ${q.ans} ${q.post}`); s.add(q.expl); });
    const tasks = [...BANK1, ...CHAINS.flat()];
    tasks.forEach(t => s.add(SENT.cmd(t)));
    IDS.forEach(id => s.add(SENT.notThis(id)));
    // 放错反馈：每位同学 × 每个合法（词, 参照物）
    IDS.forEach(id => {
      ['atas', 'hadapan'].forEach(w => s.add(SENT.youPut(id, w, 'pentas')));
      s.add(SENT.youPut(id, 'bawah', 'pokok'));
      IDS.filter(o => o !== id).forEach(o => ['hadapan', 'belakang'].forEach(w => s.add(SENT.youPut(id, w, o))));
    });
    return [...s];
  }

  window.KATAARAH_DATA = { W, H, SC, hOf, R, inPoly, inCrowd, inTray, onStage, walkable, classify, toPx, CHARS, IDS, nameOf, TRAY, trayFoot, trayXY, crowd, teachers,
    KENALI, TAGS, KENALI_SENT, KENALI_EXTRA, KENALI_WHO, KENALI_REF, OPENING, Q, BANK1, CHAINS, FIXED_X, FIXED_Y, ANCHOR_SNAP, SENT, VOICE_NAME, allSentences, cap };
})();
