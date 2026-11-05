# يجهّز ملف الكود المصدري الذي يطلبه فريق مراجعة AMO (فايرفوكس) عند طلب Source Code.
# الناتج: site/dist/store/amo-source-<الإصدار>.zip — يرفع كما هو في صفحة Source Code Upload.
# المحتوى: أصل الكود (سكربت أداة نور) + ملفات الإضافة اليدوية + سكربت البناء + تعليمات خطوة بخطوة.
import json, os, zipfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
tool = open(os.path.join(ROOT, 'server', 'tahdir-noor.user.js'), encoding='utf-8').read()
ver = __import__('re').search(r'@version\s+(\S+)', tool).group(1)
store = os.path.join(ROOT, 'dist', 'store'); os.makedirs(store, exist_ok=True)
z = os.path.join(store, f'amo-source-{ver}.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write(os.path.join(ROOT, 'extension', 'AMO_SOURCE.md'), 'AMO_SOURCE.md')
    zf.write(os.path.join(ROOT, 'tools', 'build_ext.py'), 'tools/build_ext.py')
    for f in ('tahdir-noor.user.js', 'icons.json'):
        zf.write(os.path.join(ROOT, 'server', f), 'server/' + f)
    for f in ('shim.js', 'bridge.js', 'background.js'):
        zf.write(os.path.join(ROOT, 'extension', f), 'extension/' + f)
print(z)
