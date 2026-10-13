"""触控／版面测试：Chromium 触控模拟（CDP touch）拖放、不触发页面滚动、可点区域尺寸、无滚动条／横向溢出。
用法：先开 `python3 -m http.server 8793 --bind 127.0.0.1`，再跑 `python3 test-mobile.py`。截图存 ~/Documents/my-agent/playwright-to-delete/。"""
import os, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('TARGET', 'http://127.0.0.1:8793/index.html')
OUT = os.path.expanduser('~/Documents/my-agent/playwright-to-delete/')
os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
STUB = "HTMLMediaElement.prototype.play = function(){ const el=this; setTimeout(()=>el.dispatchEvent(new Event('ended')), 120); return Promise.resolve(); };"
fails = 0
def check(name, ok, extra=''):
    global fails
    print(('  PASS ' if ok else '  FAIL ') + name + (f' - {extra}' if extra else ''))
    if not ok: fails += 1

def stage_info(page):
    return page.evaluate("() => { const r = document.querySelector('#stage').getBoundingClientRect(); return {l:r.left+4,t:r.top+4,U:document.querySelector('#stage').clientWidth/1536}; }")

def touch_drag(ctx, page, aid, fx, fy, steps=12):
    box = page.locator(f'.actor[data-id="{aid}"]').bounding_box(); st = stage_info(page)
    foot = page.evaluate(f"() => {{ const a = __kataarah.A['{aid}']; return [a.x, a.y]; }}")
    sx, sy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    ex = st['l'] + fx * st['U'] + (sx - (st['l'] + foot[0] * st['U'])); ey = st['t'] + fy * st['U'] + (sy - (st['t'] + foot[1] * st['U']))
    cdp = ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy}]})
    for i in range(1, steps + 1):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': sx + (ex - sx) * i / steps, 'y': sy + (ey - sy) * i / steps}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.wait_for_timeout(1000)

def small(page, sel, mn):
    return page.evaluate("""([sel, mn]) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [(e.dataset.id || e.dataset.word || e.textContent.trim().slice(0, 8)), Math.round(r.width), Math.round(r.height)]; }).filter(s => s[1] < mn || s[2] < mn)""", [sel, mn])

with sync_playwright() as p:
    br = p.chromium.launch()
    # ── 多个视窗：无滚动条（横屏）／无横向溢出 ──
    print('视窗无滚动条')
    ctx0 = br.new_context(viewport={'width': 1000, 'height': 566}); ctx0.route('**/kongsi-idea.vercel.app/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    pg0 = ctx0.new_page()
    for vw, vh in ((1000, 566), (1280, 720), (1366, 768), (1920, 1080)):
        pg0.set_viewport_size({'width': vw, 'height': vh}); pg0.goto(BASE); pg0.wait_for_timeout(400)
        for mode in ('home', 'kenali', 'jawab', 'susun'):
            pg0.evaluate(f"__kataarah.go('{mode}')"); pg0.wait_for_timeout(300)
            sc = pg0.evaluate("[document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth]")
            check(f'{vw}x{vh} {mode} 无滚动条', sc[0] <= 1 and sc[1] <= 1, str(sc))
    ctx0.close()
    for label, vw, vh, mobile, minhit, tag in (('landscape 1366x768', 1366, 768, False, 64, 'land'), ('portrait 390x844', 390, 844, True, 44, 'port')):
        print(label)
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=True)
        ctx.add_init_script(STUB)
        ctx.route('**/kongsi-idea.vercel.app/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
        page = ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e))); page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        page.goto(BASE); page.wait_for_timeout(500)
        page.screenshot(path=OUT + f'k1-m-{tag}-home.png')
        check('首页无横向溢出', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.evaluate("__kataarah.go('kenali')"); page.wait_for_timeout(500)
        check('Kenali 无横向溢出', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        sm = small(page, '.actor[data-id]', minhit); check(f'Kenali 角色可点区域 >= {minhit}px', not sm, str(sm))
        sm = small(page, '.tag', 44); check('Kenali 词标可点区域 >= 44px', not sm, str(sm))
        check('词标位置：' + ('竖屏在面板里、不盖场景' if mobile else '横屏贴在角色旁（在场景里）'), page.evaluate("[...document.querySelectorAll('.tag')].every(t => !!t.closest('#stage')) === " + ('false' if mobile else 'true')) and page.locator('.tag').count() == 4)
        page.tap('.tag >> nth=0'); page.wait_for_timeout(250)
        check('触控点词标有反应', page.locator('#kSent .w').count() == 1)
        page.screenshot(path=OUT + f'k1-m-{tag}-kenali.png')
        n_c = page.locator('.actor.crowd').count(); n_t = page.locator('.actor.teacher').count() + 1
        check(f'群众 {n_c} 人（>=20）、老师 {n_t} 位（8）', n_c >= 20 and n_t == 8)
        page.evaluate("__kataarah.go('jawab')"); page.wait_for_timeout(400)
        if mobile:
            sm = small(page, '.topbar .pill, .topbar .step, #jListen', 44); check('竖屏 Jawab 顶栏／按钮 >= 44x44', not sm, str(sm))
        sm = small(page, '.opt', 44); check('Jawab 选项 >= 44px', not sm, str(sm))
        check('Jawab 无横向溢出', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.tap('.opt >> nth=0'); page.wait_for_timeout(200)
        page.screenshot(path=OUT + f'k1-m-{tag}-jawab.png')
        # Susun 触控
        page.evaluate("__kataarah.unlock(1); __kataarah.go('susun'); __kataarah.startLevel(1)"); page.wait_for_timeout(500)
        sm = small(page, '.actor.movable', minhit); check(f'Susun 候场区角色可点区域 >= {minhit}px', not sm, str(sm))
        ov = page.evaluate("""() => { const r = [...document.querySelectorAll('.actor.tray-item')].map(e => [e.dataset.id, e.getBoundingClientRect()]); const bad = []; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i][1], b = r[j][1]; if (a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5) bad.push(r[i][0] + '/' + r[j][0]); } return bad; }""")
        if mobile: check('竖屏候场区任意两角色点击框不重叠', not ov, str(ov))
        if mobile:
            sm = small(page, '.topbar .pill, .topbar .step, .lvl, #sReset, #sListen', 44); check('竖屏顶栏／关卡／面板按钮 >= 44x44', not sm, str(sm))
            nm = page.evaluate("[...document.querySelectorAll('.actor.tray-item .nm')].filter(n => +getComputedStyle(n).opacity > 0.05).length")
            check('竖屏候场区名牌平时不显示', nm == 0, str(nm))
        check('Susun 无横向溢出', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        check('角色 touch-action: none', page.evaluate("getComputedStyle(document.querySelector('.actor.movable')).touchAction") == 'none')
        y0 = page.evaluate('window.scrollY')
        t = page.evaluate("__kataarah.target()")
        nm = page.evaluate(f"__kataarah.scenes.CHARS['{t['id']}'].name")
        # 先拖到错的位置，再拖到对的位置
        if t['ref'] == 'pentas' and t['word'] == 'hadapan': P, expw = (1230, 482), f'Kamu letak {nm} di bawah pokok. Cuba hadapan.'
        elif t['ref'] == 'pokok': P, expw = (520, 455), f'Kamu letak {nm} di hadapan pentas. Cuba bawah.'
        else: P, expw = (520, 455), f'Kamu letak {nm} di hadapan pentas. Cuba {t["word"]}.'
        touch_drag(ctx, page, t['id'], *P)
        got = page.inner_text('#sfb').replace('\n', ' ')
        check('触控：拖到错位置 -> 说出实际位置', got == expw, got)
        touch_drag(ctx, page, t['id'], t['foot']['x'] * W, t['foot']['y'] * H)
        check('触控：拖放到对的位置', page.evaluate('__kataarah.T.idx') == 1)
        # 点角色 → 点位置（两步）
        t2 = page.evaluate("__kataarah.target()"); st = stage_info(page)
        rects = page.evaluate("[...document.querySelectorAll('.actor.movable')].map(e => { const r = e.getBoundingClientRect(); return e.dataset.id + ':' + [r.left, r.top, r.width, r.height].map(Math.round).join(',') + ':' + e.className.replace('actor ', ''); }).join(' | ')")
        page.tap(f'.actor.movable[data-id="{t2["id"]}"]'); page.wait_for_timeout(250)
        check('触控：点角色 -> 被选中', page.locator('.actor.sel').count() == 1)
        page.touchscreen.tap(st['l'] + t2['foot']['x'] * W * st['U'], st['t'] + t2['foot']['y'] * H * st['U']); page.wait_for_timeout(1100)
        check('触控：点位置完成放置（两步法）', page.evaluate('__kataarah.T.idx') == 2, f"{t2['id']} {t2['word']} {t2['ref']} {page.inner_text('#sfb')} {rects}")
        # 剩下的拖完
        for _ in range(6):
            if page.evaluate('__kataarah.T.finished'): break
            t3 = page.evaluate("__kataarah.target()"); touch_drag(ctx, page, t3['id'], t3['foot']['x'] * W, t3['foot']['y'] * H)
        check('触控：三条口令完成并升旗', page.evaluate('__kataarah.T.finished') is True)
        check('触控拖拽没有触发页面滚动', page.evaluate('window.scrollY') == y0, f'{y0} -> {page.evaluate("window.scrollY")}')
        page.wait_for_timeout(3600); page.screenshot(path=OUT + f'k1-m-{tag}-susun-done.png')
        page.evaluate("__kataarah.startLevel(1)"); page.wait_for_timeout(500)
        t = page.evaluate("__kataarah.target()"); touch_drag(ctx, page, t['id'], t['foot']['x'] * W, t['foot']['y'] * H)
        page.screenshot(path=OUT + f'k1-m-{tag}-susun.png')
        check('无 JS 报错／控制台红字', not errs, str(errs[:2]))
        ctx.close()
    br.close()
print('\n失败数:', fails)
sys.exit(1 if fails else 0)
