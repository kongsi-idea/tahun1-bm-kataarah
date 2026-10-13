"""Kibarkan Bendera · Kata Arah 端到端测试。
用法：先在工具目录开 `python3 -m http.server 8793 --bind 127.0.0.1`，再跑 `python3 test-e2e.py`。
TARGET 环境变量可改成线上网址。截图存到 ~/Documents/my-agent/playwright-to-delete/（不提交）。
朗读用「播放即结束」的桩让测试不必等真音档；真音档存在与否另有检查（§10-8）。"""
import os, re, sys, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TARGET', 'http://127.0.0.1:8793/index.html')
OUT = os.path.expanduser('~/Documents/my-agent/playwright-to-delete/')
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
fails = 0
def check(name, ok, extra=''):
    global fails
    print(('  PASS ' if ok else '  FAIL ') + name + (f' - {extra}' if extra else ''))
    if not ok: fails += 1

STUB = "HTMLMediaElement.prototype.play = function(){ const el=this; setTimeout(()=>el.dispatchEvent(new Event('ended')), 120); return Promise.resolve(); };"

# ── classify 点位（场景像素 1536×1024）──
PENTAS = [
 # atas：台面前半部
 ('课本 Cikgu Mohan（台面）', (500, 256), 'atas'), ('台面左', (300, 240), 'atas'), ('台面右', (720, 240), 'atas'), ('台面中后', (500, 212), 'atas'), ('台面中前', (520, 280), 'atas'),
 ('台面左前', (330, 265), 'atas'), ('台面右前', (680, 270), 'atas'), ('台面正中', (450, 245), 'atas'), ('台面右中', (620, 235), 'atas'), ('台面左中', (380, 225), 'atas'),
 # hadapan：舞台前地面带
 ('课本 hadapan（舞台正前）', (500, 450), 'hadapan'), ('带左', (200, 400), 'hadapan'), ('带右', (900, 400), 'hadapan'), ('带前缘', (500, 520), 'hadapan'), ('带后缘（台阶下）', (500, 380), 'hadapan'),
 ('带左前', (150, 500), 'hadapan'), ('带右前', (1000, 510), 'hadapan'), ('带中左', (350, 440), 'hadapan'), ('带中右', (700, 470), 'hadapan'), ('带中', (600, 400), 'hadapan'),
 # null
 ('台下（台阶）', (480, 320), None), ('台后（后排座位）', (500, 170), None), ('群众里', (500, 650), None), ('树下', (1230, 480), None), ('左上建筑', (60, 100), None),
 ('带与群众之间', (500, 540), None), ('右空地', (1250, 800), None),
]
POKOK = [
 ('课本 Rani（树下）', (1230, 482), 'bawah'), ('花圃', (1380, 450), 'bawah'), ('树影左', (1120, 460), 'bawah'), ('树影前', (1300, 540), 'bawah'), ('树影右', (1480, 500), 'bawah'),
 ('树影中', (1200, 420), 'bawah'), ('树影前左', (1160, 500), 'bawah'), ('树影右前', (1450, 540), 'bawah'), ('花圃左', (1290, 430), 'bawah'), ('花圃右', (1470, 420), 'bawah'),
 ('跑道', (1100, 700), None), ('舞台前', (500, 450), None), ('树影之外下方', (1300, 700), None), ('台面', (500, 250), None), ('树冠上方', (1300, 200), None),
]
# 人形参照：ref 脚点 (1085, 628) h≈175；同列、后（画面更下）0.5–2.5 个身高 = belakang；前 = hadapan
REF = (1085, 628)
PERSON = [
 ('课本 Zali 在 Wei Han 正下方', (1085, 778), 'belakang'), ('Nani 在 Sin Ling 正下方', (1085, 790), 'belakang'), ('后 0.6h', (1085, 735), 'belakang'), ('后 1.0h', (1085, 805), 'belakang'), ('后 1.5h', (1085, 890), 'belakang'),
 ('后 2h', (1085, 970), 'belakang'), ('后偏左', (1030, 790), 'belakang'), ('后偏右', (1140, 790), 'belakang'), ('后 0.9h 略偏', (1120, 786), 'belakang'), ('后 2.2h', (1085, 1000), 'belakang'),
 ('前 0.6h', (1085, 520), 'hadapan'), ('前 1.0h', (1085, 455), 'hadapan'), ('前 1.4h', (1085, 390), 'hadapan'), ('前偏左', (1040, 450), 'hadapan'), ('前偏右', (1130, 450), 'hadapan'),
 ('前 0.8h 偏右', (1150, 490), 'hadapan'), ('前 0.55h', (1085, 530), 'hadapan'), ('前 1.2h', (1085, 420), 'hadapan'), ('前 1.35h 左', (1050, 395), 'hadapan'), ('前 0.7h', (1085, 506), 'hadapan'),
 ('同一高度（旁边）', (1180, 628), None), ('太近（0.3h）', (1085, 680), None), ('太近前（0.3h）', (1085, 575), None), ('列外', (1250, 790), None), ('列外前', (900, 450), None),
 ('太远（>2.5h）', (1085, 1010), None), ('背后太靠近', (1085, 650), None),
]

def stage_info(page):
    return page.evaluate("() => { const r = document.querySelector('#stage').getBoundingClientRect(); return {l:r.left+4,t:r.top+4,U:document.querySelector('#stage').clientWidth/1536}; }")

def drag_actor(page, aid, fx, fy, steps=10):
    """把角色拖到「脚点 = 场景像素 (fx, fy)」。"""
    box = page.locator(f'.actor[data-id="{aid}"]').bounding_box()
    st = stage_info(page); foot = page.evaluate(f"() => {{ const a = __kataarah.A['{aid}']; return [a.x, a.y]; }}")
    sx, sy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    offx, offy = sx - (st['l'] + foot[0] * st['U']), sy - (st['t'] + foot[1] * st['U'])
    ex, ey = st['l'] + fx * st['U'] + offx, st['t'] + fy * st['U'] + offy
    page.mouse.move(sx, sy); page.mouse.down()
    for i in range(1, steps + 1):
        page.mouse.move(sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps)
    page.mouse.up(); page.wait_for_timeout(700)

def wait_idle(page, ms=900): page.wait_for_timeout(ms)
def fb(page): return page.inner_text('#sfb').replace('\n', ' ')
def cls(page, ref, x, y):
    return page.evaluate("([r,x,y]) => __kataarah.classify(r, {x:x, y:y})", [ref, x / W, y / H])

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1366, 'height': 768})
    ctx.add_init_script(STUB)
    ctx.route('**/kongsi-idea.vercel.app/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    page.goto(BASE); page.wait_for_timeout(600)

    # ── 1. classify 点位 ──
    print('classify 点位测试（SPEC §10-3）')
    for label, ref, pts in (('pentas', 'pentas', PENTAS), ('pokok', 'pokok', POKOK)):
        for nm, (x, y), exp in pts:
            got = cls(page, ref, x, y); check(f'{label} {nm} {(x, y)} -> {exp}', got == exp, f'得到 {got}')
    for nm, (x, y), exp in PERSON:
        got = page.evaluate("([r,x,y]) => __kataarah.classify({x:r[0]/1536, y:r[1]/1024}, {x:x, y:y})", [list(REF), x / W, y / H])
        check(f'person {nm} {(x, y)} -> {exp}', got == exp, f'得到 {got}')
    cnt = {}
    for nm, pt, exp in PENTAS + PERSON + POKOK: cnt[exp] = cnt.get(exp, 0) + 1
    check('每个（参照物，词）至少 10 点（atas／hadapan／bawah／belakang／person-hadapan）',
          sum(1 for _, _, e in PENTAS if e == 'atas') >= 10 and sum(1 for _, _, e in PENTAS if e == 'hadapan') >= 10 and sum(1 for _, _, e in POKOK if e == 'bawah') >= 10
          and sum(1 for _, _, e in PERSON if e == 'belakang') >= 10 and sum(1 for _, _, e in PERSON if e == 'hadapan') >= 10)
    # atas 与 hadapan 互不重叠；台下判 null
    ov = page.evaluate("""() => { let n = 0; for (let x = 0; x < 1536; x += 12) for (let y = 0; y < 1024; y += 12) { const a = __kataarah.classify('pentas', {x:x/1536,y:y/1024}); const b = __kataarah.classify('pokok', {x:x/1536,y:y/1024}); if (a && b) n++; } return n; }""")
    check('pentas 区域与 pokok 区域互不重叠', ov == 0, str(ov))

    # ── 2. 画面基础：人数、无格子、debug ──
    print('画面与规则')
    page.evaluate("__kataarah.go('kenali')"); wait_idle(page, 700)
    n_crowd = page.locator('.actor.crowd').count(); n_t = page.locator('.actor.teacher').count()
    check(f'群众学生 >= 20（{n_crowd}）', n_crowd >= 20)
    srcs = page.evaluate("[...document.querySelectorAll('.actor.crowd img')].map(i => i.getAttribute('src'))")
    check('群众相邻不是同一张', all(srcs[i] != srcs[i + 1] for i in range(len(srcs) - 1)))
    check(f'老师 8 位＝台上坐 4＋站立 3＋Cikgu Mohan（static 老师 {n_t}，Mohan {page.locator(".actor[data-id=mohan]").count()}）', n_t == 7 and page.locator('.actor[data-id="mohan"]').count() == 1)
    check('正式画面无 debug 描框（svg.debug 为空）', page.evaluate("document.querySelector('svg.debug').children.length") == 0)
    check('正式画面无格子／框线元素（只有背景图、角色、词标）', page.evaluate("""() => [...document.querySelectorAll('#stage *')].filter(e => ['polygon','rect','line','path','circle'].includes(e.tagName.toLowerCase()) && !e.closest('.glowshape')).length""") == 0)
    page.screenshot(path=OUT + 'k1-e2e-kenali.png')
    # 2.5D：近大远小、遮挡顺序、影子、台面高度
    hs = page.evaluate("() => { const a = __kataarah.A; const hh = id => a[id].el.querySelector('.sp').getBoundingClientRect().height; return {wei: hh('weihan'), zali: hh('zali'), mohan: hh('mohan'), zW: +a.weihan.el.style.zIndex, zZ: +a.zali.el.style.zIndex, shadow: !!a.weihan.el.querySelector('.shadow')}; }")
    check('近大远小：Zali（画面下方）比 Wei Han 高大', hs['zali'] > hs['wei'], f"{hs['zali']:.0f} vs {hs['wei']:.0f}")
    check('遮挡：z-index 按脚点 y 排序（Zali 盖在 Wei Han 上）', hs['zZ'] > hs['zW'], f"{hs['zZ']} > {hs['zW']}")
    check('脚下影子存在', hs['shadow'])
    r = page.evaluate("() => { const a = __kataarah.A.mohan, D = __kataarah.scenes; return [D.hOf(a.y), D.hOf(a.y + D.SC.stageLift) * D.SC.stageK, a.el.querySelector('.sp').getBoundingClientRect().height / (document.querySelector('#stage').clientWidth/1536)]; }")
    check('台面高度：台上角色按台面深度（stageLift）缩放', abs(r[2] - r[1]) < 1.5 and abs(r[1] - r[0]) > 0.5, str([round(v, 1) for v in r]))
    check('页面文字无中文、无创作者人名', not re.search(r'[一-鿿]', page.inner_text('body')) and 'Xin Hui' not in page.content() and 'Lee Xin' not in page.content())
    page.goto(BASE + '?debug=1'); page.wait_for_timeout(500); page.evaluate("__kataarah.go('kenali')"); wait_idle(page, 600)
    check('?debug=1 才描出区域', page.evaluate("document.querySelector('svg.debug').children.length") >= 6)
    page.screenshot(path=OUT + 'k1-e2e-debug.png')
    page.goto(BASE); page.wait_for_timeout(500)

    # ── 3. Kenali ──
    print('Kenali')
    page.evaluate("__kataarah.go('kenali')"); wait_idle(page, 600)
    check('开场句 Semua murid menghadap pentas.', 'Semua murid menghadap pentas.' in page.inner_text('#kOpen'))
    exp = {'atas': 'Cikgu Mohan berdiri di atas pentas.', 'hadapan': 'Murid-murid berhimpun di hadapan pentas.', 'belakang': 'Zali berdiri di belakang Wei Han.', 'bawah': 'Rani berdiri di bawah pokok.'}
    for w, s in exp.items():
        page.click(f'.tag[data-word="{w}"]'); page.wait_for_timeout(300)
        t = page.inner_text('#kSent').replace('\n', ' ')
        check(f'点词标 {w} -> {s}', t.startswith(s) and page.locator('#kSent .w').inner_text() == w, t)
    page.click('.actor[data-id="rani"]'); page.wait_for_timeout(250)
    check('点角色 Rani -> 同样演示 bawah', page.locator('#kSent .w').inner_text() == 'bawah')
    page.click('#kAll'); seen = []
    for _ in range(80):
        page.wait_for_timeout(200)
        w = page.evaluate("document.querySelector('#kSent .w') && document.querySelector('#kSent .w').textContent")
        if w and (not seen or seen[-1] != w): seen.append(w)
        if page.locator('#kAll').is_visible(): break
    check('Main semua 依序演示 4 个词并结束', seen == ['atas', 'hadapan', 'belakang', 'bawah'] and page.locator('#kAll').is_visible(), str(seen))
    page.click('#kAll'); page.wait_for_timeout(300); page.click('#kPause')
    check('Henti 后按钮变 Sambung', page.inner_text('#kPause') == 'Sambung')
    page.click('#kPause'); page.wait_for_timeout(300); check('Sambung 后恢复', page.inner_text('#kPause') == 'Henti')

    # ── 4. Jawab ──
    print('Jawab')
    book = [('Murid-murid berkumpul di', 'hadapan', 'guru.'), ('Nani berdiri di', 'belakang', 'Sin Ling.'), ('Cikgu Mohan berdiri di', 'atas', 'pentas.'), ('Rani berdiri di', 'bawah', 'pokok.')]
    page.evaluate("__kataarah.go('jawab')"); wait_idle(page, 500)
    n = page.evaluate("__kataarah.scenes.Q.length"); check('Jawab 共 8 题', n == 8)
    seq = []
    for i in range(8):
        q = page.evaluate(f"__kataarah.scenes.Q[{i}]")
        txt = page.inner_text('#jQ').replace('\n', ' ')
        opts = page.eval_on_selector_all('.opt', 'e => e.map(x => x.dataset.word)')
        if i < 4: check(f'前 4 题 #{i + 1} 是课本句「{book[i][0]} ___ {book[i][2]}」答案 {book[i][1]}', q['pre'] == book[i][0] and q['post'] == book[i][2] and q['ans'] == book[i][1] and txt.startswith(book[i][0]))
        check(f'题 {i + 1} 4 个选项齐全', sorted(opts) == ['atas', 'bawah', 'belakang', 'hadapan'])
        seq.append(q['ans'])
        if i == 4:   # 测错 2 次揭晓答案
            wrong = [w for w in opts if w != q['ans']]
            page.click(f'.opt[data-word="{wrong[0]}"]'); page.wait_for_timeout(250)
            check('第 1 次答错 -> Cuba lagi.', page.inner_text('#jfb') == 'Cuba lagi.')
            page.click(f'.opt[data-word="{wrong[1]}"]'); page.wait_for_timeout(250)
            check('第 2 次答错 -> 揭晓并说明', page.inner_text('#jfb') == q['expl'], page.inner_text('#jfb'))
            page.wait_for_timeout(1600)
        else:
            page.click(f'.opt[data-word="{q["ans"]}"]'); page.wait_for_timeout(250)
            check(f'题 {i + 1} 答对 -> Betul!', page.inner_text('#jfb') == 'Betul!')
            page.wait_for_timeout(1500)
    check('同一词不连续超过 2 题', all(not (seq[i] == seq[i + 1] == seq[i + 2]) for i in range(6)), str(seq))
    check('结束 Tahniah! 与 Main lagi', 'Tahniah!' in page.inner_text('#panel') and page.locator('#jAgain').is_visible())

    # ── 5. Susun：错误反馈、提示光、三关、升旗 ──
    print('Susun')
    page.evaluate("localStorage.clear()"); page.evaluate("__kataarah.T.unlocked = 1")
    page.evaluate("__kataarah.go('susun')"); wait_idle(page, 500)
    check('Tahap 2、3 初始锁定', page.locator('.lvl[data-lv="2"]').is_disabled() and page.locator('.lvl[data-lv="3"]').is_disabled())
    check('Susun 6 个可拖角色（候场区＋已固定站在跑道的参照同学）', page.locator('.actor.movable').count() + page.locator('.actor.static[data-id]').count() == 6 and page.locator('.actor.movable').count() >= 3)
    check('Susun 无任何词标按钮／格子', page.locator('.tag').count() == 0)
    page.evaluate("__kataarah.startLevel(1)"); wait_idle(page, 500)
    t = page.evaluate("__kataarah.target()")
    who = t['task']['who']; nm = page.evaluate(f"__kataarah.scenes.CHARS['{who}'].name")
    # 放到别处：若题目是 pentas/hadapan 就放树下，否则放舞台前
    if t['ref'] == 'pentas' and t['word'] == 'hadapan': P, expw = (1230, 482), f'Kamu letak {nm} di bawah pokok. Cuba hadapan.'
    elif t['ref'] == 'pokok': P, expw = (520, 455), f'Kamu letak {nm} di hadapan pentas. Cuba bawah.'
    else: P, expw = (520, 455), f'Kamu letak {nm} di hadapan pentas. Cuba {t["word"]}.'
    drag_actor(page, who, *P)
    check('放错：说出实际位置（反馈文字）', fb(page) == expw, fb(page))
    check('放错后弹回候场区（脚点在候场带 y>=925）', page.evaluate(f"__kataarah.A['{who}'].y") >= 925)
    check('同一条口令错 1 次：不亮提示光', page.locator('.hint').count() == 0)
    drag_actor(page, who, *P)
    check('同一条口令错 2 次：亮提示光', page.locator('.hint').count() == 1)
    # 放到群众身上
    drag_actor(page, who, 560, 700); check('不可放到群众身上 -> Cuba lagi.', fb(page) == 'Cuba lagi.')
    # 放错人
    other = [i for i in ['weihan', 'zali', 'nani', 'sinling', 'rani', 'mohan'] if i != who and page.locator(f'.actor.movable[data-id="{i}"]').count()][0]
    drag_actor(page, other, 520, 455); check('拖错人 -> Itu bukan …', fb(page).startswith('Itu bukan '), fb(page))
    page.screenshot(path=OUT + 'k1-e2e-susun-hint.png')

    def play_level(n, shot=None):
        page.evaluate(f"__kataarah.startLevel({n})"); wait_idle(page, 500)
        total = page.evaluate("__kataarah.T.tasks.length"); done = 0
        for k in range(total):
            tt = page.evaluate("__kataarah.target()")
            fx, fy = tt['foot']['x'] * W, tt['foot']['y'] * H
            drag_actor(page, tt['id'], fx, fy)
            page.wait_for_timeout(1000)
            done = page.evaluate("__kataarah.T.idx")
            if done != k + 1:
                check(f'Tahap {n} 第 {k + 1} 条放对', False, f"{tt} -> {fb(page)}"); return False
        check(f'Tahap {n} 的 {total} 条口令全部放对', page.evaluate("__kataarah.T.finished") is True)
        return True
    ok1 = play_level(1)
    page.wait_for_timeout(900)
    check('过关后升旗（旗显示）、Tahap 2 解锁', page.locator('.flagimg').is_visible() and not page.locator('.lvl[data-lv="2"]').is_disabled() and page.locator('.lvl[data-lv="3"]').is_disabled())
    page.wait_for_timeout(2600)
    fl = page.evaluate("() => { const f = document.querySelector('.flagimg').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect(); const U = document.querySelector('#stage').clientWidth/1536; return {top: (f.top - s.top - 4) / U, left: (f.left - s.left - 4) / U, w: f.width / U}; }")
    check('旗升到杆顶（旗顶 y≈46、旗杆管贴在杆 x≈944）', abs(fl['top'] - 46) < 4 and abs((fl['left'] + 0.075 * fl['w']) - 946) < 4, str({k: round(v, 1) for k, v in fl.items()}))
    page.screenshot(path=OUT + 'k1-e2e-flag.png')
    ok2 = play_level(2)
    page.wait_for_timeout(900)
    check('Tahap 3 解锁', not page.locator('.lvl[data-lv="3"]').is_disabled())
    ok3 = play_level(3)
    page.wait_for_timeout(900)
    check('Tahap 3 完成：朗读 Tahniah! Kita kibarkan bendera!', 'Tahniah! Kita kibarkan bendera!' in page.inner_text('#cmd'))
    page.screenshot(path=OUT + 'k1-e2e-finale.png')
    # 两种拖放：两步放置（点角色 → 点位置）走同一个 place
    page.evaluate("__kataarah.startLevel(1)"); wait_idle(page, 500)
    t = page.evaluate("__kataarah.target()"); st = stage_info(page)
    page.click(f'.actor.movable[data-id="{t["id"]}"]'); page.wait_for_timeout(200)
    check('点角色后被选中', page.locator('.actor.sel').count() == 1)
    page.mouse.click(st['l'] + t['foot']['x'] * W * st['U'], st['t'] + t['foot']['y'] * H * st['U']); page.wait_for_timeout(1100)
    check('点位置完成放置（两步法）', page.evaluate("__kataarah.T.idx") == 1)

    # ── 6. 控制台、断网 ──
    check('无 JS 报错／控制台红字', not errors, str(errors[:3]))
    ctx.set_offline(True)
    n_before = len(errors)
    try:
        page.evaluate("__kataarah.go('kenali')"); page.click('.tag[data-word="atas"]'); page.wait_for_timeout(500)
        page.evaluate("__kataarah.go('jawab')"); page.wait_for_timeout(300)
        jserr = [e for e in errors[n_before:] if e.startswith('pageerror')]
        check('断网：切换与点词无 JS 报错（浏览器只会记音档载入失败，朗读回退到备案）', not jserr and page.locator('.opt').count() == 4, str(errors[:2]))
    except Exception as e:
        check('断网：切换与点词不报错', False, str(e)[:120])
    ctx.set_offline(False)

    # ── 7. 音档 ──
    print('音档')
    lines = page.evaluate("__kataarah.allVoiceLines()")
    missing = [l['text'] for l in lines if not os.path.exists(os.path.join(HERE, 'audio', l['key'] + '.mp3')) or os.path.getsize(os.path.join(HERE, 'audio', l['key'] + '.mp3')) < 1000]
    check(f'audio/ 每句都有 mp3（共 {len(lines)} 句）', not missing, str(missing[:3]))
    clips = page.evaluate("Object.keys(window.VOICE_CLIPS).length"); check('manifest 与句子数一致', clips == len(lines), f'{clips} vs {len(lines)}')
    check('allVoiceLines 与实际使用的句子一致（无空句）', all(l['text'].strip() for l in lines))
    br.close()
print('\n失败数:', fails)
sys.exit(1 if fails else 0)
