# خط إنتاج اللغة الإنجليزية 11–12 (الفصل الأول)

- `en11_src.py` · `en12_src.py`: محتوى الدروس (التحضير، البنك، الملخصات، العلاجي، الألعاب، أستطيع أن) لكل وحدة من Engage with English 11A/12A.
- `gen.py SITE`: يكتب lessons.json وbio_bank/en11|en12.txt وstudy_pack وgames_pack وcando_src (ثم `python3 tools/build_cando.py data/cando_src data/lessons.json data/cando.json`).
- `build.py`: يقص أقسام امتحانات الوزارة (11: 2023–2026 ستة أوراق، 12: 2024–2026 أربع أوراق) صورًا مع صفحات نموذج الإجابة.
- `bank.py`: يستخرج مفردات القراءة 1 (صح/خطأ) والمفردات والقواعد من الامتحانات إلى البنك (الإجابات المظللة تُقرأ بكشف البكسل).
- `publish.py SITE`: يكتب finals.json وصور finals/img/en11|en12.
- المواصفة: Student Assessment Handbook – English Grades 11-12 (Sept. 2026)، ص 7 (الواجب تكويني)، ص 9 (Quizzes)، ص 38 و43 (الامتحان النهائي).
