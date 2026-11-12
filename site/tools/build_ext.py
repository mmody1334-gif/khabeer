# يبني إضافة المتصفح (Chrome / Edge) من نفس كود أداة نور. الناتج: dist/ext/ و dist/tahdir-ext-<version>.zip
# --test: يضيف localhost للاختبار المحلي فقط (لا يُرفع للمتجر أبدًا)
import json, os, re, sys, zipfile, base64, io, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'extension'); OUT = os.path.join(ROOT, 'dist', 'ext' + ('_test' if '--test' in sys.argv else ''))
tool = open(os.path.join(ROOT, 'server', 'tahdir-noor.user.js'), encoding='utf-8').read()
ver = re.search(r'@version\s+(\S+)', tool).group(1)
body = tool[tool.index('==/UserScript=='):].split('\n', 1)[1]
test = '--test' in sys.argv
if test: body = body.replace("location.hostname === 'khabeer.khabeer.workers.dev'", "(location.hostname === 'khabeer.khabeer.workers.dev' || location.hostname === 'localhost')")
# الإضافة والسكربت لموقع «خبير» فقط؛ الفحص أدناه يضمن ألا يتسرّب نطاق منصة أخرى.
_OTHER = re.compile(r'(hudhaifa|kabsula)', re.I)
body = body.replace("location.hostname === 'tahdir.hudhaifa-bio.workers.dev' || ", '').replace(" || /(^|\\.)(el|al)kabsula\\.(me|com|works|site|online|tech|studio)$/.test(location.hostname)", '')
run = 'function (GM_getValue, GM_setValue, GM_deleteValue, GM_openInTab, GM_registerMenuCommand, unsafeWindow) {\n' + body + '\n}'
shim = open(os.path.join(SRC, 'shim.js'), encoding='utf-8').read().replace('__RUN__', '(' + run + ')').replace('__EXTVER__', ver).replace('__EXTSRC__', 'zip')
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
open(os.path.join(OUT, 'main.js'), 'w', encoding='utf-8').write(shim)
for f in ('bridge.js', 'background.js'): shutil.copy(os.path.join(SRC, f), OUT)
icons = json.load(open(os.path.join(ROOT, 'server', 'icons.json')))
big_png = base64.b64decode(icons['/icon-512.png'])
try:
    from PIL import Image
    big = Image.open(io.BytesIO(big_png)).convert('RGBA')
    for n in (16, 32, 48, 128): big.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f'icon{n}.png'))
except ImportError:  # بيئة بلا PIL: نفس الصورة الكبيرة لكل المقاسات (يقبلها المتصفح)
    for n in (16, 32, 48, 128): open(os.path.join(OUT, f'icon{n}.png'), 'wb').write(big_png)
# النطاقات: نفس @match في رأس سكربت Tampermonkey (نور + الموقع بكل نطاقاته) — لا قائمة مكررة يدويًا
hdr = tool[:tool.index('==/UserScript==')]
sites = sorted(set(m for m in re.findall(r'@match\s+(\S+)', hdr) if m.endswith('/*') and not _OTHER.search(m))) + (['http://localhost/*'] if test else [])
man = {
  'manifest_version': 3, 'name': 'خبير — أداة نور', 'short_name': 'أداة نور', 'version': ver,
  'description': 'ترسل التحضير والواجب من موقع «خبير» إلى منصة نور وتملأ الحقول تلقائيًا. لا تضغط حفظ أبدًا.',
  'author': 'خبير', 'homepage_url': 'https://khaber.site/',
  'permissions': ['storage'],
  # نفس نطاقات content_scripts (لا صلاحية جديدة): تلزم لإعادة المعلم إلى تبويب المنصة بعد التثبيت
  'host_permissions': sites,
  'background': {'service_worker': 'background.js'},
  'content_scripts': [
    {'matches': sites, 'js': ['bridge.js'], 'run_at': 'document_start'},
    {'matches': sites, 'js': ['main.js'], 'run_at': 'document_idle', 'world': 'MAIN'}],
  'icons': {str(n): f'icon{n}.png' for n in (16, 32, 48, 128)},
  'action': {'default_icon': {str(n): f'icon{n}.png' for n in (16, 32)}, 'default_title': 'خبير — أداة نور'},
  'minimum_chrome_version': '111'
}
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
if not test:
    z = os.path.join(ROOT, 'dist', f'khabeer-ext-{ver}.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(OUT)): zf.write(os.path.join(OUT, f), f)
    print(z)
print('ext', ver, OUT)

# ===== حزم المتاجر (Chrome Web Store · Edge Add-ons · Firefox AMO) =====
# نفس ملفات الإضافة بالضبط؛ لفايرفوكس فقط: خلفية بالسكربت بدل service_worker،
# ومعرّف gecko، وإعلان «لا نجمع بيانات» المطلوب في AMO. سكربت Tampermonkey لا يُمسّ.
if not test:
    store = os.path.join(ROOT, 'dist', 'store'); os.makedirs(store, exist_ok=True)
    def _zip(path, manifest):
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in sorted(os.listdir(OUT)):
                if f == 'main.js':  # نسخة المتجر تتحدّث من المتجر تلقائيًا: لا نعرض لها تنبيه «حمّل التحديث»
                    zf.writestr(f, open(os.path.join(OUT, f), encoding='utf-8').read().replace("'data-tahdir-ext-src', 'zip'", "'data-tahdir-ext-src', 'store'"))
                elif f != 'manifest.json': zf.write(os.path.join(OUT, f), f)
            zf.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=1))
        print(path)
    _zip(os.path.join(store, f'khabeer-chrome-edge-{ver}.zip'), man)
    ff = json.loads(json.dumps(man))
    ff.pop('minimum_chrome_version', None)
    ff['background'] = {'scripts': ['background.js']}
    ff['browser_specific_settings'] = {
        'gecko': {'id': 'noor-tool@khaber.site', 'strict_min_version': '140.0',
                  'data_collection_permissions': {'required': ['none']}},
        'gecko_android': {'strict_min_version': '142.0'}}
    _zip(os.path.join(store, f'khabeer-firefox-{ver}.zip'), ff)
    # نسخة فايرفوكس «توزيع ذاتي» (Unlisted): تُوقَّع تلقائيًا بمجرد الرفع فتصبح جاهزة للتوزيع
    # الفوري بلا انتظار المراجعة (نفس الحزمة ولو معرّف gecko مختلف — فالمعرّف لا يتكرر على AMO).
    # هكذا يثبّت المعلم الإضافة بضغطتين من رابط الملف الموقَّع، ثم ينتقل المتجر الرئيسي لاحقًا.
    ff2 = json.loads(json.dumps(ff))
    ff2['browser_specific_settings']['gecko']['id'] = 'noor-tool-unlisted@khaber.site'
    _zip(os.path.join(store, f'khabeer-firefox-unlisted-{ver}.zip'), ff2)
