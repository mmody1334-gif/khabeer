# -*- coding: utf-8 -*-
"""OCR عربي جاهز لقراءة الأوراق الامتحانية الممسوحة (تثبيت تلقائي للنماذج).

لماذا هذا الملف
---------------
بعض أوراق امتحانات اللغة العربية **ممسوحة** بلا طبقة نص (الصفان 6 و7 مثلًا)، فلا
يمكن قراءة أرقام الأسئلة ولا عناوين الأقسام منها نصيًّا. الحزمة المرفقة مع بايثون
تحوي RapidOCR بنموذج صيني/إنجليزي يقرأ العربية حروفًا لاتينية مشوّهة، فنُثبّت هنا
**نموذج التعرّف العربي الرسمي** `arabic_PP-OCRv4_rec_mobile.onnx` مع نموذج كشف
متعدد اللغات وقاموس عربي.

مبدأ العمل المهم
----------------
يُستخدم OCR **للعثور على مواضع الأسئلة فقط**؛ أما محتوى السؤال فيُقصّ **صورةً من
الورقة الأصلية** — فيبقى مطابقًا 100% للورقة الوزارية بلا أي وساطة نصية.

التثبيت
-------
    python site/tools/arabic_ocr.py --install     # ينزّل النماذج العربية
    python site/tools/arabic_ocr.py --check       # يتحقق من الجاهزية

الاستخدام
---------
    from arabic_ocr import get_ocr
    ocr = get_ocr()
    result, _ = ocr('page.png')          # [[box, text, score], ...]
    for box, text, score in result or []:
        print(text, score)

المتطلبات: rapidocr_onnxruntime · onnxruntime · opencv · Pillow · numpy
(كلها متوفرة في حزمة بايثون المرفقة).
"""
import os
import sys
import urllib.request

BASE_URL = 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0'
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HERE, 'rapidocr_arabic.yaml')

# (اسم الملف · الرابط · الحجم التقريبي بالميجابايت)
MODELS = [
    ('arabic_PP-OCRv4_rec_mobile.onnx',
     BASE_URL + '/onnx/PP-OCRv4/rec/arabic_PP-OCRv4_rec_mobile.onnx', 7.3),
    ('multi_PP-OCRv3_det_mobile.onnx',
     BASE_URL + '/onnx/PP-OCRv4/det/multi_PP-OCRv3_det_mobile.onnx', 2.3),
    ('arabic_dict.txt',
     BASE_URL + '/paddle/PP-OCRv4/rec/arabic_PP-OCRv4_rec_mobile/arabic_dict.txt', 0.01),
]

TEMPLATE = """Global:
    text_score: 0.5
    use_det: true
    use_cls: true
    use_rec: true
    print_verbose: false
    min_height: 30
    width_height_ratio: 8
    max_side_len: 2400
    min_side_len: 30
    return_word_box: false
    intra_op_num_threads: -1
    inter_op_num_threads: -1

Det:
    intra_op_num_threads: -1
    inter_op_num_threads: -1
    use_cuda: false
    use_dml: false
    model_path: {det}
    limit_side_len: 960
    limit_type: min
    std: [ 0.5, 0.5, 0.5 ]
    mean: [ 0.5, 0.5, 0.5 ]
    thresh: 0.3
    box_thresh: 0.5
    max_candidates: 1000
    unclip_ratio: 1.6
    use_dilation: true
    score_mode: fast

Cls:
    intra_op_num_threads: -1
    inter_op_num_threads: -1
    use_cuda: false
    use_dml: false
    model_path: {cls}
    cls_image_shape: [ 3, 48, 192 ]
    cls_batch_num: 6
    cls_thresh: 0.9
    label_list: [ '0', '180' ]

Rec:
    intra_op_num_threads: -1
    inter_op_num_threads: -1
    use_cuda: false
    use_dml: false
    model_path: {rec}
    rec_keys_path: {keys}
    rec_img_shape: [ 3, 48, 320 ]
    rec_batch_num: 6
"""


def models_dir():
    import rapidocr_onnxruntime as R
    return os.path.join(os.path.dirname(R.__file__), 'models')


def p(name):
    return os.path.join(models_dir(), name).replace('\\', '/')


def install(verbose=True):
    """ينزّل النماذج العربية إن لم تكن موجودة."""
    d = models_dir()
    os.makedirs(d, exist_ok=True)
    ok = True
    for name, url, mb in MODELS:
        dst = os.path.join(d, name)
        if os.path.exists(dst) and os.path.getsize(dst) > 1000:
            if verbose:
                print('  %-34s موجود (%.1f MB)' % (name, os.path.getsize(dst) / 1048576))
            continue
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            data = urllib.request.urlopen(req, timeout=300).read()
            open(dst, 'wb').write(data)
            if verbose:
                print('  %-34s نُزّل %.1f MB' % (name, len(data) / 1048576))
        except Exception as e:
            ok = False
            if verbose:
                print('  %-34s فشل: %s' % (name, str(e)[:70]))
    return ok


def write_config():
    txt = TEMPLATE.format(det=p('multi_PP-OCRv3_det_mobile.onnx'),
                          cls=p('ch_ppocr_mobile_v2.0_cls_infer.onnx'),
                          rec=p('arabic_PP-OCRv4_rec_mobile.onnx'),
                          keys=p('arabic_dict.txt'))
    open(CFG, 'w', encoding='utf-8').write(txt)
    return CFG


def get_ocr(auto_install=True):
    """يعيد كائن RapidOCR مهيّأً للنموذج العربي."""
    need = [n for n, _, _ in MODELS if not os.path.exists(os.path.join(models_dir(), n))]
    if need and auto_install:
        install()
    from rapidocr_onnxruntime import RapidOCR
    return RapidOCR(config_path=write_config())


def check():
    from rapidocr_onnxruntime import RapidOCR
    missing = [n for n, _, _ in MODELS if not os.path.exists(os.path.join(models_dir(), n))]
    print('مجلد النماذج: %s' % models_dir())
    print('نماذج ناقصة: %s' % (', '.join(missing) if missing else 'لا شيء'))
    if missing:
        return False
    RapidOCR(config_path=write_config())
    keys = open(os.path.join(models_dir(), 'arabic_dict.txt'), encoding='utf-8').read().split('\n')
    print('رموز القاموس العربي: %d' % len(keys))
    print('OCR العربي جاهز ✓')
    return True


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else '--check'
    if cmd == '--install':
        sys.exit(0 if install() else 1)
    sys.exit(0 if check() else 1)
