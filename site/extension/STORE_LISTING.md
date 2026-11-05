# نشر إضافة «خبير — أداة نور» في المتاجر

الحزم تُبنى بالأمر `python3 site/tools/build_ext.py` في `site/dist/store/`:
- `kabsula-chrome-edge-<الإصدار>.zip` ← متجر Chrome **و** متجر Edge (نفس الملف)
- `kabsula-firefox-<الإصدار>.zip` ← متجر Firefox (AMO)

الإضافة تُبنى من نسخة من سكربت أداة نور (`tahdir-noor.user.js`) **دون أي تعديل عليه**، فسكربت
Tampermonkey المثبَّت عند المعلمين لا يتأثر. ولو ثبّت معلم الإضافة وTampermonkey معًا لا تعمل الأداة مرتين.

بعد النشر: ضع رابط صفحة الإضافة في كل متجر داخل `EXT_STORE` في `site/server/common.js`
فيظهر للمعلم «مرشد التثبيت» (ضغطتان) بدل خطوات Tampermonkey.

**تم النشر:**
- **Microsoft Edge Add-ons**: https://microsoftedge.microsoft.com/addons/detail/%D8%A7%D9%84%D9%83%D8%A8%D8%B3%D9%88%D9%84%D8%A9-%E2%80%94-%D8%A3%D8%AF%D8%A7%D8%A9-%D9%86%D9%88%D8%B1/jbpbibeppdfddjlhkeobfkbccbjcnjpd —
  الرابط موضوع في `EXT_STORE.edge`. معلمو Edge يتثبّتون من المتجر مباشرة (بلا Tampermonkey ولا ZIP)،
  ومن لديه النسخة القديمة «غير المجمّعة» يُوجَّه في إشعار التحديث إلى نسخة المتجر (كود الإضافة يعلن
  مصدرها عبر `data-tahdir-ext-src` بـ`store` فيتحدّث تلقائيًا بلا تنبيهات).
- **Firefox (AMO) — النسخة المدرِجة (Listed): اعتمدتها موزيلا ✅** (٢٠٢٦-١٠-٢٤، معرّف
  `noor-tool@elkabsula.site`): صفحة الإضافة الرسمية
  `https://addons.mozilla.org/firefox/addon/الكبسولة-أداة-نور/` موضوع في `EXT_STORE.firefox`
  في `site/server/common.js`. المعلم يثبّت من صفحة المتجر بضغطتين («إضافة إلى Firefox» ←
  «إضافة») بلا Tampermonkey، ويتحدّث تلقائيًا من AMO مع كل إصدار — بلا تغيير أي رابط.
  للتحديث: ارفع `kabsula-firefox-<الإصدار>.zip` كإصدار جديد في نفس التسجيل على AMO.
- **نسخة Unlisted الموقَّعة — مسار احتياطي يبقى كما هو** (معرّف `noor-tool-unlisted@elkabsula.site`،
  رقم التسجيل 3104946): لا تُحذف ولا يُتغير رابطها. إن احتجنا إليها (حجب المتجر، مشكلة في
  النسخة المدرِجة) نضع رابط ملف .xpi الموقَّع في `EXT_STORE.firefox` — فمرشد التثبيت يتعرف
  على رابط .xpi المباشر ويتبعا الخطوة القديمة («افتح الرابط» ← «إضافة») تلقائيًا.
- ملف الكود المصدري الذي طلبته مراجعة AMO يُبنى بـ `site/tools/make_amo_source.py`
  (وصفه في `site/extension/AMO_SOURCE.md`)، وقد قبِلوا المصدر ووافقوا.

---

## البيانات المشتركة (لكل المتاجر)

**الاسم:** خبير — أداة نور

**الوصف المختصر (حتى 132 حرفًا):**
ترسل التحضير والواجب من منصة «خبير» إلى منصة نور وتملأ الحقول تلقائيًا. لا تضغط حفظ أبدًا.

**الوصف الكامل (عربي):**
أداة مجانية لمعلمي سلطنة عُمان تعمل مع منصة «خبير» (khabeer.khabeer-bio.workers.dev).

• اختر الدرس في «خبير» واضغط «إرسال التحضير إلى نور»، فتفتح الأداة صفحة «إضافة تحضير» للصف الصحيح في منصة نور وتملأ الخانات تلقائيًا.
• الواجب الإلكتروني: تملأ نموذج المهمة ثم تضيف الأسئلة دفعة واحدة.
• لا تضغط «حفظ» أبدًا: المعلم يراجع ويحفظ بنفسه.
• لا تجمع أي بيانات ولا ترسل شيئًا لأي خادم؛ كل شيء يبقى على جهاز المعلم.
• تتحدّث تلقائيًا من المتجر.

مبادرة مدرسية من إعداد أ. محمد مجدي — معلم الأحياء، مدرسة حذيفة بن محصن.
(ليست تطبيقًا رسميًا لوزارة التعليم.)

**Full description (English):**
A free helper for teachers in Oman that works with the "Khabeer" lesson-prep platform (khabeer.khabeer-bio.workers.dev).

• Pick a lesson on Elkabsula and click "Send preparation to Nour": the extension opens the "Add preparation" page for the right class on the Nour LMS (lms.moe.gov.om) and fills in the fields.
• Homework: fills the assignment form and adds the questions in one batch.
• It never clicks "Save" — the teacher reviews and saves.
• Collects no data and sends nothing to any server; everything stays on the teacher's device.

A school initiative by Mohamed Magdy, Biology teacher, Hudhaifa bin Muhsin School. Not an official Ministry of Education app.

**الفئة:** Education / التعليم (فايرفوكس: Other أو Productivity)
**الموقع (Homepage):** https://khabeer.khabeer-bio.workers.dev/
**سياسة الخصوصية:** https://khabeer.khabeer-bio.workers.dev/privacy
**الدعم (Support URL):** https://khabeer.khabeer-bio.workers.dev/support
**الظهور:** Unlisted (غير مدرجة — تظهر فقط لمن معه الرابط) أو Public حسب رغبتك

**الصور (في مجلد store-images):**
| الملف | المقاس | أين يُستخدم |
|---|---|---|
| icon128.png (داخل الحزمة) | 128×128 | Chrome · Firefox |
| logo300.png | 300×300 | Edge: Extension Store logo |
| shot_app.png · shot2.png | 1280×800 | لقطات الشاشة (Chrome · Edge · Firefox) |
| tile440.png | 440×280 | Chrome: Small promo tile · Edge: Small promotional tile |
| marquee1400.png | 1400×560 | Chrome: Marquee (اختياري) · Edge: Large promotional tile (اختياري) |

---

## Chrome Web Store — تبويب Privacy practices

**Single purpose:**
Transfers a teacher's lesson preparation and homework from the Elkabsula website into the Nour LMS (lms.moe.gov.om) forms.

**Permission justification:**
- storage: keeps the lesson the teacher just sent from Elkabsula until the Nour page opens and is filled (local only).
- Host permissions (lms.moe.gov.om and the Elkabsula domains): needed to receive the "send" action on the Elkabsula site and to fill the preparation/homework forms on Nour; after installation the extension reloads any open Elkabsula tab so the tool works immediately.

**Remote code:** No, I am not using remote code.
**Data usage:** لا تختر أي نوع بيانات، ثم فعّل الإقرارات الثلاثة (I do not sell… / I do not use… / I do not use… for creditworthiness).

## Edge Add-ons (Partner Center)

- Availability: Hidden (غير مدرجة) أو Public — الأسواق: كل الأسواق أو Oman على الأقل.
- Category: Education. Privacy policy: نعم ← الرابط أعلاه.
- **Notes for certification:** «The extension only works on khabeer.khabeer-bio.workers.dev (teacher login required) and lms.moe.gov.om (Ministry of Education LMS, teacher login required). It fills web forms with lesson text the teacher sends from the Khabeer site and never submits them.»

## Firefox (addons.mozilla.org)

- Developer Hub ← Submit a New Add-on ← **On this site** (منشورة على المتجر).
- ارفع `kabsula-firefox-<الإصدار>.zip`. لا يوجد كود مصغّر، فلن يطلب «source code» (لو سأل: No).
- Data collection: الحزمة تعلن `data_collection_permissions: none`.
- Notes to reviewer: نفس نص Edge أعلاه.
- يعمل على Firefox 140+ للكمبيوتر وFirefox 142+ للأندرويد.
