# -*- coding: utf-8 -*-
"""يفكّ تشفير حمولة الصفحة (XOR + base64 كما في pack() في build_worker.py) ويتحقق من وجود كود معيّن.

الاستخدام: python3 unpack_check.py <worker.js> <صفحة> "نص1" ["نص2" ...]
مثال:      python3 unpack_check.py site/dist/worker.js app showAnnouncement
"""
import base64, json, re, sys

src = open(sys.argv[1], encoding='utf-8').read()
page = sys.argv[2]
needles = sys.argv[3:]

# PAGES = {"app":"<!doctype html>...", ...} — نستخرج حمولة الصفحة المطلوبة
m = re.search(r'const PAGES = (\{.*?\});\n', src, re.S)
if not m:
    sys.exit('لم أجد PAGES في worker.js')
pages = json.loads(m.group(1))
if page not in pages:
    sys.exit('الصفحة %s غير موجودة. المتاح: %s' % (page, ', '.join(sorted(pages)[:20])))
html = pages[page]

# الحمولة: atob("...") مع مفتاح k="..."
mm = re.search(r'k="([0-9a-f]+)",b=atob\("([^"]+)"\)', html)
if not mm:
    sys.exit('لم أجد الحمولة المشفّرة في صفحة %s' % page)
key, blob = mm.group(1), mm.group(2)
raw = base64.b64decode(blob)
out = bytes(c ^ ord(key[i % len(key)]) for i, c in enumerate(raw)).decode('utf-8', 'replace')
print('صفحة %s: فُكّ %d حرفًا' % (page, len(out)))

bad = 0
for n in needles:
    found = n in out
    print('   %s  %s' % ('موجود ' if found else 'مفقود ', n))
    if not found:
        bad += 1
if len(needles) > 1:
    print('النتيجة: %d موجود، %d مفقود' % (len(needles) - bad, bad))
sys.exit(1 if bad else 0)
