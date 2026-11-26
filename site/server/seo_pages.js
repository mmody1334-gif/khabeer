// صفحات تعريفية عامة (قابلة للأرشفة) لموقع خبير: الأسئلة الشائعة وصفحة لكل مادة.
const SEO_BASE = 'https://khaber.site';
const SEO_FEATS = [
  ['تحضير جاهز', 'تحضير كل درس جاهز ومرتّب حسب فهرس الكتاب المدرسي، ويُنسخ بضغطة واحدة.'],
  ['اختبارات قصيرة', 'بنك أسئلة واختبارات قصيرة ومراجعات للوحدات.'],
  ['واجبات منزلية', 'واجبات جاهزة بدرجات وأنواع أسئلة متنوعة.'],
  ['ملخصات الدروس', 'ملخصات للدروس والوحدات وفق مخرجات التعلم.'],
  ['ألعاب تعليمية', 'ألعاب صفية لكل درس تشجع الطلاب على المشاركة.'],
  ['تحليل النتائج', 'تحليل نتائج الاختبارات وإعداد الخطط العلاجية والإثرائية.'],
  ['عروض ونماذج', 'عروض تقديمية ونماذج إدارية جاهزة للطباعة.']
];
const SEO_SUBJ = {
  'science': ['العلوم', 'العلوم', 'دروس العلوم مرتبة حسب فهرس الكتاب المدرسي: تحضير جاهز، واختبارات قصيرة، وملخصات، وألعاب لكل درس.'],
  'biology': ['الأحياء', 'الأحياء', 'تحضير دروس الأحياء جاهز مع أسئلة وملخصات وأنشطة تساعد المعلم على توفير وقته.'],
  'chemistry': ['الكيمياء', 'الكيمياء', 'تحضير دروس الكيمياء جاهز مع اختبارات قصيرة وملخصات ومراجعات للوحدات.'],
  'environmental-science': ['العلوم البيئية', 'العلوم البيئية', 'تحضير دروس العلوم البيئية جاهز، مع أسئلة وملخصات وأنشطة صفية.'],
  'information-technology': ['تقنية المعلومات', 'تقنية المعلومات', 'تحضير دروس تقنية المعلومات جاهز، مع أسئلة تقويم وأنشطة وملخصات.'],
  'english': ['اللغة الإنجليزية', 'اللغة الإنجليزية', 'تحضير دروس اللغة الإنجليزية جاهز مع أسئلة وألعاب وأنشطة لكل درس.']
};
const SEO_FAQ = [
  ['ما هي منصة خبير؟', 'خبير منصة عربية لمعلمي سلطنة عُمان، تجمع تحضير الدروس والاختبارات والواجبات والملخصات والألعاب وتحليل النتائج في مكان واحد.'],
  ['ما المقصود بالتحضير الجاهز؟', 'هو تحضير لكل درس مرتّب حسب فهرس الكتاب المدرسي، يفتحه المعلم وينسخه بضغطة واحدة بدل كتابته من البداية.'],
  ['ما المواد المتوفرة؟', 'العلوم، والأحياء، والكيمياء، والعلوم البيئية، وتقنية المعلومات، واللغة الإنجليزية، للفصل الدراسي الأول.'],
  ['هل يوجد اختبارات وواجبات؟', 'نعم، فيها اختبارات قصيرة ومراجعات للوحدات وواجبات منزلية وبنك أسئلة.'],
  ['هل توجد ألعاب تعليمية؟', 'نعم، لكل درس ألعاب صفية يستخدمها المعلم داخل الحصة.'],
  ['كيف أبدأ؟', 'أنشئ حسابك من صفحة التسجيل في الموقع، ثم افتح المادة والدرس الذي تريده.'],
  ['هل الموقع يعمل على الجوال؟', 'نعم، الموقع مصمم ليعمل على الجوال والحاسوب.']
];
function seoEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function seoPage(path, title, desc, h1, bodyHtml, ld) {
  const url = SEO_BASE + path;
  const nav = '<nav>' + [['/', 'الرئيسية'], ['/faq', 'الأسئلة الشائعة']].concat(Object.keys(SEO_SUBJ).map(k => ['/subjects/' + k, SEO_SUBJ[k][0]])).map(a => '<a href="' + a[0] + '">' + a[1] + '</a>').join(' · ') + '</nav>';
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + seoEsc(title) + '</title><meta name="description" content="' + seoEsc(desc) + '"><meta name="robots" content="index,follow">' +
    '<link rel="canonical" href="' + url + '"><meta property="og:type" content="website"><meta property="og:site_name" content="خبير">' +
    '<meta property="og:title" content="' + seoEsc(title) + '"><meta property="og:description" content="' + seoEsc(desc) + '"><meta property="og:url" content="' + url + '"><meta property="og:locale" content="ar_OM">' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '<style>body{font-family:system-ui,Tahoma,sans-serif;margin:0;background:#f6f5fc;color:#1d1b2e;line-height:1.9}main{max-width:760px;margin:0 auto;padding:24px 16px}h1{font-size:1.7rem}h2{font-size:1.2rem;margin-top:1.6rem}nav{font-size:.9rem;margin-bottom:1rem}a{color:#4b3bd1}.card{background:#fff;border-radius:12px;padding:12px 16px;margin:10px 0;box-shadow:0 1px 4px #0001}.cta{display:inline-block;background:#4b3bd1;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;margin-top:12px}</style></head><body><main>' +
    nav + '<h1>' + seoEsc(h1) + '</h1>' + bodyHtml +
    '<p><a class="cta" href="/">ابدأ مع خبير</a></p></main></body></html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'", 'X-Content-Type-Options': 'nosniff' } });
}
function seoResponse(p) {
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const feats = '<div>' + SEO_FEATS.map(f => '<div class="card"><b>' + f[0] + '</b><br>' + f[1] + '</div>').join('') + '</div>';
  if (p === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /$\nAllow: /faq$\nAllow: /subjects/\nAllow: /sitemap.xml\nAllow: /icon-192.png\nAllow: /icon-512.png\nDisallow: /\n\nSitemap: ' + SEO_BASE + '/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (p === '/sitemap.xml') {
    const urls = ['/', '/faq'].concat(Object.keys(SEO_SUBJ).map(k => '/subjects/' + k));
    const x = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + SEO_BASE + (u === '/' ? '/' : u) + '</loc><changefreq>weekly</changefreq><priority>' + (u === '/' ? '1.0' : '0.7') + '</priority></url>').join('') + '</urlset>\n';
    return new Response(x, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (p === '/faq') {
    const body = '<p>إجابات سريعة عن منصة خبير لمعلمي سلطنة عُمان.</p>' + SEO_FAQ.map(q => '<div class="card"><h2>' + seoEsc(q[0]) + '</h2><p>' + seoEsc(q[1]) + '</p></div>').join('');
    return seoPage('/faq', 'الأسئلة الشائعة عن منصة خبير للمعلمين في سلطنة عُمان', 'أجوبة عن منصة خبير: التحضير الجاهز، والمواد المتوفرة، والاختبارات والواجبات والألعاب، وطريقة البدء.', 'الأسئلة الشائعة', body,
      { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'ar', mainEntity: SEO_FAQ.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) });
  }
  const m = p.match(/^\/subjects\/([a-z-]+)$/);
  if (m && SEO_SUBJ[m[1]]) {
    const s = SEO_SUBJ[m[1]];
    const title = 'تحضير جاهز لمادة ' + s[0] + ' للمعلمين في سلطنة عُمان | خبير';
    const body = '<p>' + s[2] + '</p><h2>ماذا يوفر خبير لمعلم ' + s[1] + '؟</h2>' + feats +
      '<h2>مواد أخرى</h2><p>' + Object.keys(SEO_SUBJ).filter(k => k !== m[1]).map(k => '<a href="/subjects/' + k + '">' + SEO_SUBJ[k][0] + '</a>').join(' · ') + '</p><p><a href="/faq">الأسئلة الشائعة</a></p>';
    return seoPage(p, title, s[2], 'تحضير جاهز لمادة ' + s[0], body,
      { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SEO_BASE + p, inLanguage: 'ar', isPartOf: { '@type': 'WebSite', name: 'خبير', url: SEO_BASE + '/' } });
  }
  return null;
}
