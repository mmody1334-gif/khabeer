#!/usr/bin/env python3
"""يولّد نسخة PNG بجانب كل صورة WebP في مجلد الأصول: «x.webp» ← «x.webp.png».
السبب: Microsoft Word لا يقرأ WebP، فملف Word المُصدَّر من الموقع يضمِّن نسخة PNG بدلها.
PNG بلوحة 64 لونًا (نص أسود على أبيض) — حادّ الحروف وحجمه قريب من JPEG.
الاستخدام: python3 fin_png.py <مجلد> — لا يفشل أبدًا (يتخطى أي صورة بها مشكلة).
"""
import os, sys
from PIL import Image


def to_png(src):
    im = Image.open(src)
    im.load()
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, 'white')
        bg.paste(im, mask=im.split()[3])
        im = bg
    im = im.convert('RGB').quantize(64)
    im.save(src + '.png', 'PNG', optimize=True)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    n = bad = 0
    for d, _, fs in os.walk(root):
        for f in fs:
            if f.lower().endswith('.webp'):
                try:
                    to_png(os.path.join(d, f)); n += 1
                except Exception as e:  # noqa
                    bad += 1; print('skip', f, e)
    print(f'fin_png: {n} png, {bad} skipped')


if __name__ == '__main__':
    main()
