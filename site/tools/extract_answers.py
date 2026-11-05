#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يقرأ جدول «نموذج الإجابة» من أوراق امتحانات الوزارة ويعيد بيانات كل مفردة.

جدول النموذج فيه الأعمدة (من اليمين): الجزئية · المفردة · الإجابة الصحيحة ·
الدرجة · معلومات إضافية · رمز الهدف التعليمي · هدف التقويم · الموضوع · الوحدة.

- يعمل على الأوراق النصية من الطبقة النصية، وعلى المصوّرة بـ OCR (rapidocr).
- يعيد تعقيد الأعمدة تلقائيًا من مواضع الخلايا (لا نعتمد على ترتيب ثابت).
- رمز الهدف (مثل 7Cs1) يأتي دائمًا باللاتينية والأرقام، فأدق ما يُقرأ.

الاستخدام:
  python3 extract_answers.py <Ans.pdf> --out <مجلد> [--pages 2-9] [--method auto|text|ocr]
"""
import argparse, json, os, re, sys

import numpy as np
import pymupdf

CODE_RE = re.compile(r'^\s*(\d{1,2})\s*([A-Za-z]{1,3})\s*([a-z]{1,2})\s*(\d{1,2})\s*$')
NUM_RE = re.compile(r'^\s*(\d{1,2})\s*$')
AO_NAMES = {'معرفة': 'AO1', 'تطبيق': 'AO2', 'استدلال': 'AO3',
            'AO1': 'AO1', 'AO2': 'AO2', 'AO3': 'AO3'}

_ocr = None


def ocr_engine():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


def cells_from_text(page, scale=1.0):
    """خلايا نصية من طبقة النص: [(x0, y0, x1, y1, نص)]."""
    out = []
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for l in b['lines']:
            for s in l['spans']:
                t = (s['text'] or '').strip()
                if t:
                    x0, y0, x1, y1 = s['bbox']
                    out.append((x0 * scale, y0 * scale, x1 * scale, y1 * scale, t))
    return out


def cells_from_ocr(page, dpi=300):
    """خلايا من OCR: [(x0, y0, x1, y1, نص)] بإحداثيات البكسل."""
    pix = page.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = img[:, :, :3]
    res, _ = ocr_engine()(img)
    out = []
    for box, txt, score in (res or []):
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        out.append((min(xs), min(ys), max(xs), max(ys), str(txt).strip()))
    return out


def cluster_rows(cells, tol):
    """يجمّع الخلايا في صفوف بحسب مركزها العمودي."""
    items = []
    for x0, y0, x1, y1, t in cells:
        items.append({'x0': x0, 'x1': x1, 'y': (y0 + y1) / 2.0, 'text': t})
    items.sort(key=lambda z: z['y'])
    rows = []
    for it in items:
        for r in rows:
            if abs(r['y'] - it['y']) <= tol:
                r['items'].append(it)
                r['y'] = sum(i['y'] for i in r['items']) / len(r['items'])
                break
        else:
            rows.append({'y': it['y'], 'items': [it]})
    rows.sort(key=lambda r: r['y'])
    for r in rows:
        r['items'].sort(key=lambda z: z['x0'])
    return rows


def detect_columns(rows):
    """يعيد حدود الأعمدة من تجميع مواضع x0 لكل الخلايا.

    نعتمد على أن الجدول شبكي: خلايا العمود نفسه تتراكم حول x0 متقارب.
    """
    xs = []
    for r in rows:
        for it in r['items']:
            xs.append(it['x0'])
    if not xs:
        return []
    xs.sort()
    # تجميع بسيط بفجوة
    groups, cur = [], [xs[0]]
    for x in xs[1:]:
        if x - cur[-1] <= 26:
            cur.append(x)
        else:
            groups.append(cur)
            cur = [x]
    groups.append(cur)
    return [sum(g) / len(g) for g in groups if len(g) >= 2]


def col_of(x, cols):
    if not cols:
        return -1
    best, bi = 1e18, -1
    for i, c in enumerate(cols):
        d = abs(x - c)
        if d < best:
            best, bi = d, i
    return bi


def parse_rows(rows, cols, *, code_key='code', ans_key='answer'):
    """يبني مفردات من الصفوف: نبحث في كل صف عن رمز الهدف، ثم نقرأ الدرجة والإجابة."""
    out = []
    for r in rows:
        code = None
        for it in r['items']:
            m = CODE_RE.match(it['text'])
            if m:
                code = (m.group(1) + m.group(2).upper() + m.group(3).lower() + m.group(4))
                break
        if not code:
            continue
        # الدرجة والمفردة: أرقام صغيرة في نفس الصف
        nums = [(it['x0'], int(NUM_RE.match(it['text']).group(1)))
                for it in r['items'] if NUM_RE.match(it['text'])]
        texts = [it['text'] for it in r['items']
                 if len(it['text']) > 12 and not CODE_RE.match(it['text'])]
        ao = next((AO_NAMES[t.strip()] for it in r['items']
                   for t in [it['text'].strip()] if t in AO_NAMES), '')
        out.append({'code': code, 'ao': ao,
                    'numbers': sorted(n for _, n in nums),
                    'marks': max([n for _, n in nums if n <= 10], default=None),
                    'item_no': max([n for _, n in nums], default=None),
                    'text': max(texts, key=len) if texts else '',
                    'row_y': round(r['y'], 1)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--out', required=True)
    ap.add_argument('--pages', default='')
    ap.add_argument('--method', default='auto', choices=['auto', 'text', 'ocr'])
    ap.add_argument('--dpi', type=int, default=300)
    a = ap.parse_args()

    doc = pymupdf.open(a.pdf)
    pages = list(range(doc.page_count))
    if a.pages:
        lo, _, hi = a.pages.partition('-')
        pages = list(range(int(lo) - 1, int(hi or lo)))

    os.makedirs(a.out, exist_ok=True)
    all_items = []
    for pi in pages:
        page = doc[pi]
        txt_len = len(page.get_text('text').strip())
        method = a.method
        if method == 'auto':
            method = 'text' if txt_len > 250 else 'ocr'
        if method == 'text':
            cells = cells_from_text(page)
            tol = 8.0
        else:
            cells = cells_from_ocr(page, a.dpi)
            tol = 26.0
        rows = cluster_rows(cells, tol)
        cols = detect_columns(rows)
        items = parse_rows(rows, cols)
        codes = [i['code'] for i in items]
        print('ص%-3d %-4s خلايا=%-4d صفوف=%-4d أعمدة=%-2d مفردات=%-3d %s' %
              (pi + 1, method, len(cells), len(rows), len(cols), len(items),
               ' '.join(codes[:10])))
        for it in items:
            it['page'] = pi + 1
        all_items += items

    outp = os.path.join(a.out, 'answer_key_%s.json' % os.path.splitext(os.path.basename(a.pdf))[0][:40])
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump({'pdf': os.path.basename(a.pdf), 'pages': a.pages,
                   'count': len(all_items), 'items': all_items}, f, ensure_ascii=False, indent=1)
    print('\nإجمالي المفردات: %d | كُتب %s' % (len(all_items), outp))


if __name__ == '__main__':
    main()
