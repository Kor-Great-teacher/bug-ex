#!/usr/bin/env python3
"""art/bugs 의 캐릭터 그림을 게임용 그림(public/img/bugs)으로 만들어요.

사용법:  python3 tools/build_sprites.py
  art/bugs/<곤충>.webp|png         → 대표 그림 (카드·목록) — 자세 그림이 없으면 대결에서도 이 그림을 움직여 써요
  art/bugs/<곤충>_<자세>.png|webp  → 자세 그림 (stand · happy · strain · dizzy · run1 run2 · push1 push2 · pull1 pull2 ·
                                     balance1 balance2 · climb1 climb2 · hang1 hang2 · fly1 fly2 · cheer1 cheer2 ·
                                     attack1 attack2 · damage1 damage2 · defend1 defend2 · idle1 idle2)
  <곤충>: ant ladybug bee grasshopper cricket butterfly firefly dragonfly dungbeetle mantis cicada rhino stag swallowtail
그림은 배경이 투명하고 오른쪽을 보고 있어야 해요. 투명한 테두리를 잘라 내고, 긴 쪽을 360px 이하로 줄여 webp 로 저장한 뒤
public/img/bugs/manifest.json 에 목록을 적어요. 필요한 것: Python 3, Pillow, numpy
"""
import json
import os
import re

import numpy as np
from PIL import Image

SRC, OUT, MAX = 'art/bugs', 'public/img/bugs', 360
TYPES = {'ant', 'ladybug', 'bee', 'grasshopper', 'cricket', 'butterfly', 'firefly', 'dragonfly',
         'dungbeetle', 'mantis', 'cicada', 'rhino', 'stag', 'swallowtail'}


def trim(im):
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 40)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for f in sorted(os.listdir(SRC)):
        m = re.match(r'^([a-z]+)(?:_([a-z]+\d?))?\.(png|webp)$', f)
        if not m or m.group(1) not in TYPES:
            continue
        kind, pose = m.group(1), m.group(2) or 'card'
        im = trim(Image.open(os.path.join(SRC, f)).convert('RGBA'))
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        name = f'{kind}_{pose}.webp'
        im.save(os.path.join(OUT, name), 'WEBP', quality=88, method=6)
        manifest.setdefault(kind, {})[pose] = {'file': name, 'w': im.width, 'h': im.height}
        print(name, im.size)
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=1)
    print('manifest:', {k: len(v) for k, v in manifest.items()})


if __name__ == '__main__':
    main()
