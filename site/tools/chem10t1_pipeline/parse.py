"""يحلّل ملف تحضير الكيمياء للصف العاشر (الفصل الأول) إلى حقول الدروس.
الاستخدام: python3 parse.py prep.docx > parsed.json"""
import docx, json, re, sys, unicodedata

ORD = {'الأولى': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4}

def clean(s):
    s = unicodedata.normalize('NFC', s or '').replace('\xa0', ' ').replace('‏', '').replace('‎', '')
    lines = []
    for ln in s.split('\n'):
        ln = re.sub(r'[ \t]+', ' ', ln).strip()
        if ln in ('.', ''):
            continue
        lines.append(ln)
    return '\n'.join(lines)

def cells(row):
    out, seen = [], set()
    for c in row.cells:
        if id(c._tc) in seen:
            continue
        seen.add(id(c._tc)); out.append(c)
    return out

def strategies(txt):
    got = []
    for ln in txt.split('\n'):
        m = re.match(r'\(\s*([√✓✔]?)\s*\)\s*(.+)', ln.strip())
        if m and m.group(1):
            got.append(re.sub(r'[.,،]+$', '', m.group(2)).strip())
    return '، '.join(got)

def main(path):
    d = docx.Document(path)
    T = d.tables
    out = []
    i = 0
    while i < len(T):
        r0 = cells(T[i].rows[0])
        if len(r0) >= 2 and 'عنوان الدرس' in r0[1].text:
            unit = ORD[re.search(r'الوحدة:\s*(\S+)', r0[0].text).group(1)]
            raw = re.sub(r'^\s*عنوان الدرس:\s*', '', r0[1].text).strip()
            m = re.match(r'\((\d)\s*-\s*(\d)\)\s*(.+)', raw)
            code = (m.group(1) + '-' + m.group(2)) if m else ''
            title = clean(m.group(3) if m else raw)
            C, D = T[i + 2], T[i + 3]
            rows = {cells(r)[0].text.strip(): cells(r) for r in C.rows}
            body = None
            for r in C.rows:
                cs = cells(r)
                if 'المخرج' in cs[0].text and 'المخرجات التعليمية' not in cs[0].text or ('جميع' in cs[0].text):
                    body = cs
            if body is None:
                body = cells(C.rows[-1])
            pre = rows.get('التعلم القبلي/التمهيد')
            mis = rows.get('المفاهيم الخاطئة وسوء الفهم')
            dr = cells(D.rows[1])
            out.append(dict(unit=unit, code=code, title=title,
                            pre_learning=clean(pre[1].text) if pre else '',
                            misconceptions=clean(mis[1].text) if mis else '',
                            outcomes=clean(body[0].text), strategies=strategies(body[1].text),
                            activities_teach=clean(body[2].text), resources=clean(body[3].text),
                            formative=clean(dr[0].text), enrich=clean(dr[1].text),
                            closing=clean(dr[2].text), homework=clean(dr[3].text)))
            i += 4
        else:
            i += 1
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1])
