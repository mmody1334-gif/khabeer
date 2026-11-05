#!/usr/bin/env python3
"""ينظّف صور أسئلة الوزارة (webp) من بقايا الورقة الأصلية:
  - الخطوط/الأشرطة الرمادية أو السوداء على حافتي الصورة (يمين/يسار) وإطار الصفحة العلوي/السفلي
  - عمود «لا تكتب في هذا الجزء»
  - صناديق الدرجات المقطوعة في أعلى يسار الصورة
  - شظايا نصوص مقطوعة على الحافة العلوية/السفلية
الاستخدام: python3 clean_fin.py <مجلد الصور> [--dry] — يعدّل الملفات في مكانها ولا يفشل أبدًا (يتخطى أي صورة بها مشكلة).
"""
import os, re, sys
import re
import numpy as np
from PIL import Image
import cv2

DARK = 190      # أقل من هذا = حبر
NONWHITE = 246  # أقل من هذا = غير أبيض (لتمييز الشريط الرمادي)


def _side_cluster(a, side, maxw=72):
    """يعيد عدد الأعمدة (من الحافة) التي يجب تبييضها، أو 0."""
    H, W = a.shape
    cols = range(0, min(maxw, W // 3)) if side == 'L' else range(W - 1, W - 1 - min(maxw, W // 3), -1)
    first = last = -1
    for i, x in enumerate(cols):
        col = a[:, x]
        dfrac = (col < DARK).mean()
        gfrac = (col < NONWHITE).mean()
        art = dfrac >= 0.80 or gfrac >= 0.88 or (gfrac >= 0.60 and i <= 3 and (a[:, x + (1 if side == 'L' else -1) * 12] < NONWHITE).mean() >= 0.60)
        if art:
            if first < 0:
                first = i
            last = i
        elif first >= 0 and i - last > 6:
            break
        elif first < 0 and i > 12:
            break
    if first < 0 or first > 12:
        return 0
    return last + 3  # هامش بسيط


def _band_rows(a0, edge, sides):
    """صفوف الحافة العلوية/السفلية التي تمثل إطارًا ممتدًا من حافة إلى حافة (لا سطر إجابة)."""
    H, W = a0.shape
    n = 0
    rng = range(0, min(14, H // 4)) if edge == 'T' else range(H - 1, H - 1 - min(14, H // 4), -1)
    for i, y in enumerate(rng):
        row = a0[y, :]
        dk = np.where(row < DARK)[0]
        full = len(dk) > 0 and (row < DARK).mean() >= 0.85
        left_ok = full and (dk[0] <= 6 or 'L' in sides or dk[0] <= 70 and 'L' not in sides and False)
        right_ok = full and (dk[-1] >= W - 7 or 'R' in sides)
        if full and not (left_ok and right_ok):
            # يلامس حافة واحدة، والطرف الآخر قريب (≤ 70px) → إطار؛ أما سطر الإجابة فيبدأ بعد رقم الدرجة
            left_ok = left_ok or (right_ok and dk[0] <= 70) or (dk[0] <= 40 and dk[-1] >= W - 45)
            right_ok = right_ok or (left_ok and dk[-1] >= W - 71) or (dk[0] <= 40 and dk[-1] >= W - 45)
        if full and left_ok and right_ok:
            n = i + 1
        elif i - n > 3:
            break
    return n + 2 if n else 0


def _header_rows(a):
    """ترويسة الورقة (المادة / الصف / الفصل / الدور / العام) المسطّرة أعلى الصورة."""
    ink = a < DARK
    H, W = a.shape
    rows = ink.any(1)
    bands, y = [], 0
    while y < H:
        if rows[y]:
            st = y
            while y < H and rows[y]:
                y += 1
            bands.append([st, y])
        else:
            y += 1
    m = []
    for st, e in bands:
        if m and st - m[-1][1] <= 2:
            m[-1][1] = e
        else:
            m.append([st, e])
    if len(m) < 2:
        return 0
    st, e = m[0]
    if st > 20 or not (14 <= e - st <= 32):
        return 0
    dens = ink[st:e].mean(1)
    line = dens >= 0.5
    if not line[-10:].any():
        return 0
    txt = ink[st:e][~line]
    if not len(txt):
        return 0
    cols = txt.any(0)
    xs = np.where(cols)[0]
    if xs[-1] - xs[0] < 0.65 * W or 1 + int((np.diff(xs) > 12).sum()) < 4:
        return 0
    if m[1][0] - e < 6:
        return 0
    return e + 2


def strip_score_box(a, max_h_frac=0.45):
    """يبيّض صندوق درجة الصفحة في أعلى اليسار (مربّع بخط أفقي وداخله رقم).

    يُطبع في رأس كل صفحة امتحان، وكثيرًا ما يدخل في قصّ السؤال الأول فيظهر
    «مربّع فيه رقم» لا علاقة له بالسؤال. نكتشفه بالبنية لا بالحجم: مكوّن متصل
    في أقصى اليسار أعلى الصورة، شكله إطار مستطيل مستدير، وداخله خط أفقي ممتد.
    يعيد عدد ما أُزيل (قد يكون أكثر من صندوق).
    """
    H, W = a.shape
    ink = (a < DARK).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    removed = 0
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        # أقصى اليسار وأعلى الصورة (قد يكون مقطوعًا من أعلى القصّ فـ y=0)
        if x > W * 0.15 or y > max(8, H * 0.08):
            continue
        if not (26 <= w <= W * 0.28 and 26 <= h <= max(40, H * max_h_frac)):
            continue
        if not (0.60 <= h / max(1, w) <= 2.4):            # مربّع تقريبًا
            continue
        if ar / float(max(1, w * h)) > 0.20:              # ممتلئ/جدول: ليس صندوق درجة
            continue
        sub = ink[y:y + h, x:x + w]
        rows = sub.mean(1)
        if not (rows > 0.55).any():                       # لا خط أفقي ممتد
            continue
        body = sub[rows <= 0.55]
        if body.size == 0 or body.mean() < 0.012:         # ولا رقم داخل الإطار
            continue
        a[max(0, y - 3):min(H, y + h + 4), max(0, x - 3):min(W, x + w + 4)] = 255
        removed += 1
    return removed


def clean_array(a):
    """a: مصفوفة رمادية uint8. تعيد (المصفوفة، قائمة ما تمّت إزالته)."""
    a0 = a
    a = a.copy()
    H, W = a.shape
    done = []
    sides = ''

    # 1) الأشرطة الجانبية
    for side in ('L', 'R'):
        k = _side_cluster(a, side)
        if k:
            if side == 'L':
                a[:, :k] = 255
            else:
                a[:, W - k:] = 255
            sides += side
            done.append('side' + side)
    # 2) إطار علوي/سفلي
    for edge in ('T', 'B'):
        k = _band_rows(a0, edge, sides)
        if k:
            if edge == 'T':
                a[:k, :] = 255
            else:
                a[H - k:, :] = 255
            done.append('frame' + edge)
    k = _header_rows(a)
    if k:
        a[:k, :] = 255
        done.append('header')
    # 3) صناديق الدرجات في أعلى اليسار
    ink = (a < DARK).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        if x > 30 or not (45 <= w <= 150):
            continue
        cut = y == 0 and h <= 45                                   # بقية صندوق سابق مقطوع من الأعلى
        scored = False
        if y <= 200 and 25 <= h <= 140 and ar < 0.2 * w * h:        # صندوق الدرجة وفيه رقم
            for j in range(1, n):
                if j == i:
                    continue
                xj, yj, wj, hj, _ = st[j]
                if xj > x + 3 and yj > y + 3 and xj + wj < x + w - 3 and yj + hj < y + h - 3 and 8 <= hj <= 45:
                    scored = True
                    break
        if cut or scored:
            a[max(0, y - 3):y + h + 4, max(0, x - 3):x + w + 4] = 255
            done.append('box')
    # 4) شظايا على الحافتين العلوية والسفلية
    ink = (a < DARK)
    for edge in ('T', 'B'):
        rows = ink[:12, :] if edge == 'T' else ink[H - 12:, :]
        rows = rows if edge == 'T' else rows[::-1]
        if not rows.any():
            continue
        has = rows.any(1)
        if not has[0]:
            continue
        hb = 0
        while hb < len(has) and has[hb]:
            hb += 1
        if hb >= len(has):
            continue  # طويلة: ليست شظية
        sub = rows[:hb]
        if sub.mean(1).max() >= 0.5:
            continue  # خط أفقي (سطر إجابة) — يبقى
        if sub.mean() > 0.2:
            continue
        if edge == 'T':
            a[:hb + 1, :] = 255
        else:
            a[H - hb - 1:, :] = 255
        done.append('frag' + edge)
    return a, done


def mask_printed_number(a, num=None, y_hi=60, dark=165, pad=3):
    """يبيّض **رقم السؤال المطبوع** في أقصى يمين السطر الأول.

    العربية تُكتب من اليمين، فرقم السؤال المطبوع («2)» · «17 )» · «10)») هو آخر ما
    في السطر، ثم مسافة، ثم نص السؤال. **المرساة الموثوقة** التي قِسناها في كل
    مفردات العلوم صف 7 (65/65): **القوس** — كتلة رقيقة عرضها 2–14 وارتفاعها 10–26
    في آخر 12% من العرض وعند x=892–944.

    القاعدة: نجد القوس (الأقصى يمينًا)، ثم نُبيّضه مع كل ما يقع **يمينه** (خانات
    الرقم) داخل نطاق رمزين كحد أقصى، وفي نطاق صفوفه وحده. ونقف عند مسافة ≥ 8 بكسل
    إن وُجدت، فلا يُمَسّ أول حرف من النص (جرّبنا التقدير بالعرض فأفسد النص).

    يعيد 1 إن بيّض شيئًا.
    """
    H, W = a.shape
    band = (a[:y_hi, :] < dark).astype(np.uint8)
    n, _lab, st, _ = cv2.connectedComponentsWithStats(band, connectivity=8)
    paren = None
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        if ar < 8 or x < W * 0.88:
            continue
        if 10 <= h <= 26 and 2 <= w <= 14:
            if paren is None or x > paren[0]:
                paren = (int(x), int(y), int(w), int(h))
    if paren is None:
        return 0
    px, py, pw, ph = paren
    # ما يمين القوس = خانات الرقم (نطاق محدود)، ثم نتوقف عند مسافة ≥ 8 بكسل
    right_limit = min(W, px + pw + 22)
    x0 = px
    prof = (a[:y_hi, :] < dark).any(0)
    # نمشي يسارًا من بداية القوس ونتوقف عند أول فراغ >= 8 بكسل
    gap = 0
    xx = px - 1
    stop = None
    while xx >= 0 and (px - xx) <= 56:
        if not prof[xx]:
            gap += 1
            if gap >= 6:
                stop = xx + gap
                break
        else:
            gap = 0
        xx -= 1
    if stop is not None:
        x0 = stop
    seg = a[:y_hi, x0:right_limit] < dark
    ys = np.where(seg.any(1))[0]
    if not len(ys):
        return 0
    a[max(0, int(ys[0]) - 3):min(H, int(ys[-1]) + 4), x0:right_limit] = 255
    return 1


def clean_all(a):
    """clean_array + إزالة صندوق درجة الصفحة (يُستدعى من مستخرج الامتحانات)."""
    a, done = clean_array(a)
    k = strip_score_box(a)
    if k:
        done = list(done) + ['scorebox%d' % k]
    return a, done


def process(path, dry=False):
    im = Image.open(path)
    g = np.array(im.convert('L'))
    out, done = clean_array(g)
    if done and not dry:
        # نُطبّق التبييض على الصورة الأصلية (RGB) حتى لا نفقد الألوان
        rgb = np.array(im.convert('RGB'))
        mask = (out == 255) & (g != 255)
        rgb[mask] = 255
        Image.fromarray(rgb).save(path, 'WEBP', quality=88, method=4)
    return done


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else 'site/finals/img'
    dry = '--dry' in sys.argv
    tot = ch = err = 0
    kinds = {}
    for dp, _, fs in os.walk(root):
        for f in fs:
            if not f.lower().endswith('.webp'):
                continue
            tot += 1
            try:
                d = process(os.path.join(dp, f), dry)
            except Exception as e:  # لا نفشل البناء بسبب صورة واحدة
                err += 1
                print('skip', f, e)
                continue
            if d:
                ch += 1
                for k in set(d):
                    kinds[k] = kinds.get(k, 0) + 1
    print('images', tot, 'cleaned', ch, 'errors', err, kinds)


if __name__ == '__main__':
    main()
