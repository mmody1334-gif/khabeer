# نشر إضافة «خبير — أداة نور» في المتاجر

الحزم تُبنى بالأمر `python3 site/tools/build_ext.py` في `site/dist/store/`:
- `khabeer-chrome-edge-<الإصدار>.zip` ← متجر Edge (ومتجر Chrome لاحقًا إن أردت — نفس الملف)
- `khabeer-firefox-<الإصدار>.zip` ← متجر Firefox (AMO)
- `amo-source-<الإصدار>.zip` (بالأمر `python3 site/tools/make_amo_source.py`) ← فقط لو طلب مراجع موزيلا الكود المصدري

**إضافة جديدة مستقلة، لا تحديث لإضافة أخرى:** معرّف فايرفوكس `noor-tool@khaber.site`، والإضافة تعمل على
`khaber.site` و`khabeer.khabeer.workers.dev` ومنصة نور فقط. سكربت Tampermonkey لا يتأثر، ولو اجتمعا لا تعمل الأداة مرتين.

**بعد الموافقة:** ضع رابط صفحة الإضافة في كل متجر داخل `EXT_STORE` في `site/server/common.js`
(مكان الروابط الحالية). عندها يظهر للمعلم في فايرفوكس وإيدج زر «تثبيت الإضافة»، وTampermonkey ممنوع فيهما (`TM_BLOCKED`).

---

## البيانات المشتركة (لكل المتاجر)

**الاسم:** خبير — أداة نور

**الوصف المختصر (حتى 132 حرفًا):**
ترسل التحضير والواجب من منصة «خبير» إلى منصة نور وتملأ الحقول تلقائيًا. لا تضغط حفظ أبدًا.

**الوصف الكامل (عربي):**
أداة مجانية لمعلمي سلطنة عُمان تعمل مع منصة «خبير» (khaber.site).

• اختر الدرس في «خبير» واضغط «إرسال التحضير إلى نور»، فتفتح الأداة صفحة «إضافة تحضير» للصف الصحيح في منصة نور وتملأ الخانات تلقائيًا.
• الواجب الإلكتروني: تملأ نموذج المهمة ثم تضيف الأسئلة دفعة واحدة.
• لا تضغط «حفظ» أبدًا: المعلم يراجع ويحفظ بنفسه.
• لا تجمع أي بيانات ولا ترسل شيئًا لأي خادم؛ كل شيء يبقى على جهاز المعلم.
• تتحدّث تلقائيًا من المتجر.

(ليست تطبيقًا رسميًا لوزارة التعليم.)

**Full description (English):**
A free helper for teachers in Oman that works with the "Khabeer" teaching platform (khaber.site).

• Pick a lesson on Khabeer and click "Send preparation to Nour": the extension opens the "Add preparation" page for the right class on the Nour LMS (lms.moe.gov.om) and fills in the fields.
• Homework: fills the assignment form and adds the questions in one batch.
• It never clicks "Save" — the teacher reviews and saves.
• Collects no data and sends nothing to any server; everything stays on the teacher's device.

Not an official Ministry of Education app.

**الفئة:** Education / التعليم (فايرفوكس: Other أو Productivity)
**الموقع (Homepage):** https://khaber.site/
**سياسة الخصوصية:** https://khaber.site/privacy
**الدعم (Support URL):** https://khaber.site/support
**الظهور:** Public (منشورة) أو Hidden/Unlisted حسب رغبتك

**الصور (في مجلد store-images):**
| الملف | المقاس | أين يُستخدم |
|---|---|---|
| icon128.png (داخل الحزمة) | 128×128 | Chrome · Firefox |
| logo300.png | 300×300 | Edge: Extension Store logo |
| shot_app.png · shot2.png | 1280×800 | لقطات الشاشة (Edge · Firefox · Chrome) |
| tile440.png | 440×280 | Edge: Small promotional tile · Chrome: Small promo tile |
| marquee1400.png | 1400×560 | Edge: Large promotional tile (اختياري) · Chrome: Marquee (اختياري) |

---

## Edge Add-ons (Partner Center)

- Extensions ← **Create new extension** ← ارفع `khabeer-chrome-edge-<الإصدار>.zip`.
- Availability: Public أو Hidden — الأسواق: كل الأسواق أو Oman على الأقل.
- Category: Education. Privacy policy: نعم ← الرابط أعلاه.
- **Notes for certification:** «The extension only works on khaber.site (teacher login required) and lms.moe.gov.om (Ministry of Education LMS, teacher login required). It fills web forms with lesson text the teacher sends from the Khabeer site and never submits them.»

## Firefox (addons.mozilla.org)

- Developer Hub ← **Submit a New Add-on** ← **On this site** (منشورة على المتجر).
- ارفع `khabeer-firefox-<الإصدار>.zip`. لا يوجد كود مصغّر؛ لو طلب المراجع الكود المصدري ارفع `amo-source-<الإصدار>.zip`.
- Data collection: الحزمة تعلن `data_collection_permissions: none`.
- Notes to reviewer: نفس نص Edge أعلاه.
- يعمل على Firefox 140+ للكمبيوتر وFirefox 142+ للأندرويد.

## Chrome Web Store (اختياري — كروم يبقى على Tampermonkey حاليًا)

**Single purpose:** Transfers a teacher's lesson preparation and homework from the Khabeer website into the Nour LMS (lms.moe.gov.om) forms.

**Permission justification:**
- storage: keeps the lesson the teacher just sent from Khabeer until the Nour page opens and is filled (local only).
- Host permissions (lms.moe.gov.om and the Khabeer domains): needed to receive the "send" action on the Khabeer site and to fill the preparation/homework forms on Nour.

**Remote code:** No. **Data usage:** لا تختر أي نوع بيانات، ثم فعّل الإقرارات الثلاثة.
