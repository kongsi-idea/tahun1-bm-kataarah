"""素材处理：assets/raw/sel/ 的白底角色表抠图成透明 WebP，场景图转 WebP -> assets/。用法：python3 make-assets.py
抠图：从图像边缘出发，把「近白、低饱和」的连通区域当背景；每个角色单独存文件。"""
import os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__))
RAW, OUT = os.path.join(HERE, 'assets/raw/sel'), os.path.join(HERE, 'assets')

def cut(img, bg_thr=226, sat_thr=22):
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    cand = (mn >= bg_thr) & ((mx - mn) <= sat_thr)
    lab, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    return fg

def peel(img, fg, n=10, mn_thr=150, sat_thr=40):
    """剥掉轮廓外残留的灰白软阴影／白边：每轮只剥「低饱和且偏亮」的边缘像素。"""
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    soft = (mn >= mn_thr) & ((mx - mn) <= sat_thr)
    for _ in range(n):
        edge = fg & ~ndi.binary_erosion(fg)
        kill = edge & soft
        if not kill.any(): break
        fg = fg & ~kill
    return fg

def split(fg, n_expect, min_area=6000, dil=5):
    lab, n = ndi.label(ndi.binary_dilation(fg, iterations=dil))
    objs = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        area = ((lab[sl] == i) & fg[sl]).sum()
        if area >= min_area: objs.append((area, sl, i))
    objs.sort(key=lambda t: -t[0]); objs = objs[:n_expect]
    objs.sort(key=lambda t: t[1][1].start)
    return objs, lab

def save_obj(img, mask, name, maxh, pad=4, limit=60):
    sl = ndi.find_objects(mask.astype(int))[0]
    sub = np.asarray(img.convert('RGB'))[sl]; m = mask[sl]
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    al = np.clip((np.asarray(alpha).astype(np.float32) / 255 - 0.4) / 0.45, 0, 1)
    im = Image.fromarray(np.dstack([sub, (al * 255).astype(np.uint8)]))
    im = im.crop(im.getbbox())
    canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0)); canvas.paste(im, (pad, pad))
    if canvas.height > maxh:
        canvas = canvas.resize((round(canvas.width * maxh / canvas.height), maxh), Image.LANCZOS)
    path = os.path.join(OUT, name + '.webp'); q = 88
    while True:
        canvas.save(path, 'WEBP', quality=q, method=6)
        if os.path.getsize(path) <= limit * 1024 or q <= 50: break
        q -= 6
    print(f'{name}.webp {canvas.size} {os.path.getsize(path)//1024}KB q{q}')

def sheet(fname, names, maxh=360, fix=None):
    img = Image.open(os.path.join(RAW, fname))
    fg = peel(img, cut(img))
    objs, lab = split(fg, len(names))
    assert len(objs) == len(names), (fname, len(objs))
    for (area, sl, i), nm in zip(objs, names):
        part = np.zeros_like(fg); part[sl] = fg[sl] & (ndi.binary_dilation(lab == i, iterations=2)[sl])
        # 只保留最大连通块（去碎屑）
        l2, n2 = ndi.label(part)
        if n2 > 1:
            sz = ndi.sum(part, l2, range(1, n2 + 1)); part = l2 == (1 + int(np.argmax(sz)))
        if fix and nm in fix: part = fix[nm](img, part)
        part = ndi.binary_fill_holes(part) if nm not in ('crowd-skip',) else part
        save_obj(img, part, nm, maxh)

def fix_zali_flag():
    """Zali 正面造型手里原本举着国旗：在最终图上把旗面＋旗杆上段／下端的像素 alpha 清零（手与握拳保留；握拳里还留一小段杆身，见回报）。"""
    from PIL import ImageDraw
    path = os.path.join(OUT, 'zali-front.webp'); im = Image.open(path).convert('RGBA')
    a = im.getchannel('A'); d = ImageDraw.Draw(a)
    P = lambda pts: [(x / 4, y / 4 + 60) for x, y in pts]
    d.polygon(P([(0, 0), (340, 0), (345, 150), (374, 400), (392, 478), (330, 478), (330, 700), (0, 700)]), fill=0)      # 旗面＋杆上段
    d.polygon(P([(405, 646), (458, 646), (458, 700), (405, 700)]), fill=0)                    # 杆下端
    im.putalpha(a); im = im.crop(im.getbbox())
    # 握拳外露的两小段杆身（棕色）：在裁切后的最终图上，只清「拳头轮廓之外、偏暗的棕色」像素
    arr = np.asarray(im).copy(); lum = arr[..., :3].astype(int).mean(2)
    for (x0, x1, y0, y1) in ((6, 16, 176, 183), (17, 29, 213, 226)):
        blk = lum[y0:y1, x0:x1] < 175; arr[y0:y1, x0:x1, 3][blk] = 0
    im = Image.fromarray(arr); im = im.crop(im.getbbox()); im.save(path, 'WEBP', quality=88, method=6)
    print('zali-front fixed', im.size, os.path.getsize(path) // 1024, 'KB')

def scene(name, out, maxw=1536, limit=450):
    im = Image.open(os.path.join(RAW, name)).convert('RGB')
    path = os.path.join(OUT, out + '.webp'); q = 82
    while True:
        im.save(path, 'WEBP', quality=q, method=6)
        if os.path.getsize(path) <= limit * 1024 or q <= 40: break
        q -= 4
    print(f'{out}.webp {im.size} {os.path.getsize(path)//1024}KB q{q}')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    scene('bg45.png', 'bg45')
    names5 = ['weihan', 'zali', 'nani', 'sinling', 'rani']
    sheet('chars-front.png', [n + '-front' for n in names5] + ['mohan-front'])
    fix_zali_flag()
    sheet('kids-back.png', [n + '-back' for n in names5])
    for k in 'abc':
        sheet(f'crowd-{k}.png', [f'crowd-{k}{i}' for i in range(1, 6)])
    sheet('teachers-seated.png', [f'teacher-seat{i}' for i in range(1, 5)])
    sheet('teachers-standing-back.png', [f'teacher-stand{i}' for i in range(1, 4)])
    # 校旗：白底旗面
    img = Image.open(os.path.join(RAW, 'flag.png')); fg = peel(img, cut(img, 232, 30))
    lab, n = ndi.label(fg); sz = ndi.sum(fg, lab, range(1, n + 1)); fg = lab == (1 + int(np.argmax(sz)))
    save_obj(img, ndi.binary_fill_holes(fg), 'flag', 300)
