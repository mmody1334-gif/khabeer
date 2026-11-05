# يحوّل خانتي الاستراتيجيات والمصادر في تحضير الإنجليزي إلى الإنجليزية (للعرض والنسخ)
# أما الإرسال إلى نور فيبقى بأسماء القوائم العربية (sel_strategies / sel_resources) لأن نور لا يقبل غيرها.
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
EN = {'الفصل المقلوب': 'Flipped classroom', 'التعلم التعاوني': 'Cooperative learning', 'التعلم التشاركي': 'Collaborative learning',
      'التعلم الذاتي': 'Self-learning', 'التعلم بالاكتشاف': 'Discovery learning', 'التعلم المبني على حل المشكلات': 'Problem-based learning',
      'التعلم المبني على المشاريع': 'Project-based learning', 'التعلم المبني على اللعب': 'Game-based learning', 'التعلم بالنمذجة': 'Modelling',
      'التعلم المتمايز': 'Differentiated learning', 'الخرائط الذهنية': 'Mind maps', 'العصف الذهني': 'Brainstorming', 'رحلات تعليمية': 'Field trips',
      'رحلات تعليمية افتراضية': 'Virtual field trips', 'تجارب معملية': 'Lab experiments', 'تجارب معملية افتراضية': 'Virtual labs',
      'تقارير كتب': 'Book reports', 'دراسة حالة': 'Case study', 'أخرى': 'Other',
      'الكتاب': "Student's Book", 'كتب الكترونية': 'E-books', 'السبورة التقليدية': 'Whiteboard', 'السبورة الذكية': 'Smart board',
      'الأقلام': 'Markers', 'جهاز عرض البيانات': 'Data projector', 'جهاز الحاسب': 'Computer', 'صورة توضيحية': 'Pictures / flashcards',
      'عروض تقديمية': 'Presentations', 'نماذج مجسمة': 'Models / realia', 'الوسائط المتعددة (سمعية - بصرية)': 'Multimedia (audio-visual)',
      'الوسائط الاجتماعية': 'Social media', 'برمجيات /تطبيقات مثل Edpuzzle, Padlet, Kahoot': 'Apps (Edpuzzle, Padlet, Kahoot)'}
p = os.path.join(HERE, '..', 'data', 'lessons.json')
L = json.load(open(p, encoding='utf-8')); n = 0
for l in L:
    if l.get('subject') != 'اللغة الإنجليزية': continue
    l['strategies'] = ', '.join(EN[x] for x in l['sel_strategies'])
    l['resources'] = ', '.join(EN[x] for x in l['sel_resources'])
    n += 1
json.dump(L, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(n, L[-1]['strategies'], '|', L[-1]['resources'])
