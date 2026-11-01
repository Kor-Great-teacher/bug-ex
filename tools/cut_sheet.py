#!/usr/bin/env python3
"""자세 모음 그림(포즈 시트)을 자세별 그림으로 잘라요.

사용법:  python3 tools/cut_sheet.py art/sheets/stag.png stag [--double]
  → art/bugs/stag_stand.png, art/bugs/stag_run1.png … 를 만들어요.

시트 모양 (ChatGPT로 만든 시트와 같은 배치):
  1줄: stand · happy · strain · dizzy
  (--double 이면 2줄에 그 두 번째 모습: stand2 · happy2 · strain2 · dizzy — 첫 줄 dizzy 는 dizzy1 로 저장)
  다음 줄: run1 run2 · push1 push2 · pull1 pull2 · balance1 balance2
  다음 줄: climb1 climb2 · hang1 hang2 · fly1 fly2 · cheer1 cheer2
  다음 줄: attack1 attack2 · damage1 damage2 · defend1 defend2 · idle1 idle2
배경이 투명하지 않으면(어두운 배경) 가장자리에서 이어진 어두운 배경을 지워요.
이름표(파란 알약 모양 글자)는 지우고, 캐릭터 몸통과 노란 별만 남겨요.
필요한 것: Python 3, Pillow, numpy
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROWS = [
    ['stand', 'happy', 'strain', 'dizzy'],
    ['run1', 'run2', 'push1', 'push2', 'pull1', 'pull2', 'balance1', 'balance2'],
    ['climb1', 'climb2', 'hang1', 'hang2', 'fly1', 'fly2', 'cheer1', 'cheer2'],
    ['attack1', 'attack2', 'damage1', 'damage2', 'defend1', 'defend2', 'idle1', 'idle2'],
]


DOUBLE_TOP = [['stand', 'happy', 'strain', 'dizzy1'], ['stand2', 'happy2', 'strain2', 'dizzy']]
DOUBLE_BOUNDS = [0, 0.217, 0.405, 0.598, 0.793, 1]   # 5줄 시트의 줄 나눔 (세로 비율)


def key_background(im):
    """불투명한 어두운 배경을 지워요: 가장자리에서 이어진 푸르스름한·어두운 픽셀 + 이름표."""
    a = np.array(im.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    v = np.maximum(np.maximum(r, g), b)
    cand = ((b >= g - 6) & (b >= r - 6) & (v < 150)) | ((b > 90) & (r < 90) & (b - r > 45))
    pill = (b > 90) & (r < 90) & (g < 130) & (b - r > 45)
    near = pill.copy()
    for _ in range(7):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    cand |= near & (r > 150) & (g > 150) & (b > 150)
    m = Image.fromarray((cand * 255).astype(np.uint8)).copy()   # copy: 바로 쓰면 floodfill 이 안 돼요
    h, w = cand.shape
    for x in range(0, w, 8):
        for y in (0, h - 1):
            if m.getpixel((x, y)) == 255:
                ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, h, 8):
        for x in (0, w - 1):
            if m.getpixel((x, y)) == 255:
                ImageDraw.floodfill(m, (x, y), 128)
    bg = (np.array(m) == 128) | near | ((b - r > 10) & (b >= g) & (v < 125))
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out


def remove_labels(a):
    """파란 이름표와 그 안의 흰 글자를 지워요."""
    r, g, b, al = (a[..., i] for i in range(4))
    pill = (b > 90) & (r < 90) & (g < 130) & (b - r > 45) & (al > 150)
    near = pill.copy()
    for _ in range(7):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    white = (r > 200) & (g > 200) & (b > 200)
    a[near & (pill | white | (al < 200)), 3] = 0


def segments(colsum, count):
    """세로로 비어 있는 틈을 기준으로 칸을 나누고, 붙어 있으면 가운데의 가장 얇은 곳에서 갈라요."""
    col = colsum > 2
    segs, x, w = [], 0, len(col)
    while x < w:
        if col[x]:
            s = x
            while x < w and col[x]:
                x += 1
            segs.append([s, x])
        x += 1
    merged = []
    for s in segs:
        if merged and (s[1] - s[0] < 35 or s[0] - merged[-1][1] < 4):
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    while len(merged) < count:
        i = max(range(len(merged)), key=lambda k: merged[k][1] - merged[k][0])
        s, e = merged[i]
        lo, hi = s + int((e - s) * 0.35), s + int((e - s) * 0.65)
        cut = lo + int(np.argmin(colsum[lo:hi]))
        merged[i:i + 1] = [[s, cut], [cut, e]]
    return merged[:count]


def keep_body(frame):
    """캐릭터 몸통과 이어진 부분 + 노란 별만 남기고 나머지(글자 부스러기)는 지워요."""
    a = np.array(frame).astype(np.int32)
    r, g, b, al = (a[..., i] for i in range(4))
    m = Image.fromarray(((al > 30) * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(5))
    ys, xs = np.where(al > 120)
    cy, cx = ys.mean(), xs.mean()
    k = int(np.argmin((ys - cy) ** 2 + (xs - cx) ** 2))
    ImageDraw.floodfill(m, (int(xs[k]), int(ys[k])), 128)
    keep = (np.array(m) == 128) | ((r > 200) & (g > 150) & (b < 140) & (al > 60))
    a[~keep, 3] = 0
    ys, xs = np.where(a[..., 3] > 40)
    return Image.fromarray(a.astype(np.uint8), 'RGBA').crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main(sheet_path, name, out_dir='art/bugs', double=False):
    im = Image.open(sheet_path)
    if im.mode != 'RGBA' or np.array(im.convert('RGBA'))[..., 3].min() == 255:
        im = key_background(im)
    im = im.convert('RGBA')
    rows = DOUBLE_TOP + ROWS[1:] if double else ROWS
    a = np.array(im).astype(np.int32)
    remove_labels(a)
    sheet = Image.fromarray(a.astype(np.uint8), 'RGBA')
    mask = a[..., 3] > 60
    h = a.shape[0]
    # 줄 나누기: 가로로 비어 있는 틈을 찾아요 (못 찾으면 4등분)
    rowsum = mask.sum(1) > 2
    bounds, y = [], 0
    while y < h:
        if rowsum[y]:
            s = y
            while y < h and rowsum[y]:
                y += 1
            if y - s > 60:
                bounds.append((s, y))
        y += 1
    if double:
        bounds = [(int(DOUBLE_BOUNDS[i] * h), int(DOUBLE_BOUNDS[i + 1] * h)) for i in range(len(rows))]
    elif len(bounds) != len(rows):
        step = h // len(rows)
        bounds = [(i * step, (i + 1) * step) for i in range(len(rows))]
    os.makedirs(out_dir, exist_ok=True)
    for (y0, y1), names in zip(bounds, rows):
        for (x0, x1), pose in zip(segments(mask[y0:y1].sum(0), len(names)), names):
            frame = keep_body(sheet.crop((x0, y0, x1, y1)))
            frame.save(os.path.join(out_dir, f'{name}_{pose}.png'))
            print(f'{name}_{pose}.png', frame.size)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], double='--double' in sys.argv)
