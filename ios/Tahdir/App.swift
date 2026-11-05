import UIKit
import WebKit

// خبير — تطبيق آيفون/آيباد.
// ثلاث شاشات أصلية: موقع خبير، منصة نور، والإعدادات.
// أداة نور (نفس سكربت الموقع) تُحقن تلقائيًا وتُحدَّث من الموقع عند كل تشغيل.
// التطبيق لا يضغط حفظ أو نشر في نور أبدًا؛ هذا يبقى للمعلم.

enum Config {
    static let site = URL(string: "https://khabeer.khabeer-bio.workers.dev/")!
    static let nour = URL(string: "https://lms.moe.gov.om/teacher")!
    static let tool = URL(string: "https://khabeer.khabeer-bio.workers.dev/tool/tahdir-noor.user.js")!
    static let green = UIColor(red: 46/255, green: 58/255, blue: 168/255, alpha: 1)
}

/// مخزن مشترك بين الشاشتين (بديل GM_getValue/GM_setValue في Tampermonkey).
final class Store {
    static let shared = Store()
    private let d = UserDefaults.standard
    private let key = "gm_store"
    var all: [String: String] {
        get { d.dictionary(forKey: key) as? [String: String] ?? [:] }
        set { d.set(newValue, forKey: key) }
    }
    func set(_ k: String, _ v: String?) { var a = all; a[k] = v; all = a }
    var json: String {
        let data = (try? JSONSerialization.data(withJSONObject: all)) ?? Data("{}".utf8)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}

/// سكربت الأداة: نسخة مخزنة + تحديث من الموقع.
final class Tool {
    static let shared = Tool()
    private let d = UserDefaults.standard
    var source: String? {
        if let s = d.string(forKey: "tool_src") { return s }
        if let u = Bundle.main.url(forResource: "tool.user", withExtension: "js") { return try? String(contentsOf: u, encoding: .utf8) }
        return nil
    }
    func refresh() {
        var r = URLRequest(url: Config.tool); r.cachePolicy = .reloadIgnoringLocalCacheData; r.timeoutInterval = 10
        URLSession.shared.dataTask(with: r) { data, resp, _ in
            guard let data = data, (resp as? HTTPURLResponse)?.statusCode == 200,
                  let s = String(data: data, encoding: .utf8), s.contains("==UserScript==") else { return }
            UserDefaults.standard.set(s, forKey: "tool_src")
        }.resume()
    }
    /// البديل لدوال Tampermonkey + السكربت نفسه، مرة واحدة لكل صفحة.
    func script() -> String? {
        guard let src = source else { return nil }
        return """
        (function(){if(window.__tahdirTool)return;window.__tahdirTool=1;
        var S=\(Store.shared.json);var H=window.webkit.messageHandlers.tahdir;
        window.unsafeWindow=window;
        window.GM_getValue=function(k,d){var v=S[String(k)];if(v===undefined||v===null||v==='')return d;try{return JSON.parse(v);}catch(e){return d;}};
        window.GM_setValue=function(k,v){var j=JSON.stringify(v);S[String(k)]=j;H.postMessage({op:'set',k:String(k),v:j});};
        window.GM_deleteValue=function(k){delete S[String(k)];H.postMessage({op:'del',k:String(k)});};
        window.GM_openInTab=function(u){H.postMessage({op:'open',url:String(u)});};
        window.GM_registerMenuCommand=function(){};
        try{
        \(src)
        }catch(e){console.error('tahdir tool',e);}})();
        """
    }
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        Tool.shared.refresh()
        UIView.appearance().semanticContentAttribute = .forceRightToLeft
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = MainTabs()
        w.tintColor = Config.green
        w.makeKeyAndVisible()
        window = w
        return true
    }
    func applicationWillEnterForeground(_ application: UIApplication) { Tool.shared.refresh() }
}

final class MainTabs: UITabBarController {
    let site = WebScreen(home: Config.site, title: "خبير", icon: "book.closed")
    let nour = WebScreen(home: Config.nour, title: "منصة نور", icon: "graduationcap")
    let settings = SettingsScreen(style: .insetGrouped)

    override func viewDidLoad() {
        super.viewDidLoad()
        site.tabs = self; nour.tabs = self; settings.tabs = self
        let nav = UINavigationController(rootViewController: settings)
        nav.tabBarItem = UITabBarItem(title: "الإعدادات", image: UIImage(systemName: "gearshape"), tag: 2)
        viewControllers = [site, nour, nav]
        let ap = UITabBarAppearance(); ap.configureWithDefaultBackground()
        tabBar.standardAppearance = ap
        if #available(iOS 15.0, *) { tabBar.scrollEdgeAppearance = ap }
    }
    func openNour(_ url: URL?) {
        let u = (url?.host ?? "").hasSuffix("moe.gov.om") ? url! : Config.nour
        nour.load(u)
        selectedIndex = 1
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    func openSite(_ url: URL) { site.load(url); selectedIndex = 0 }
}

final class WebScreen: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let home: URL
    weak var tabs: MainTabs?
    var web: WKWebView!
    private var pending: URL?
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var obs: NSKeyValueObservation?

    init(home: URL, title: String, icon: String) {
        self.home = home
        super.init(nibName: nil, bundle: nil)
        tabBarItem = UITabBarItem(title: title, image: UIImage(systemName: icon), tag: 0)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.applicationNameForUserAgent = "TahdirApp/1"
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let uc = WKUserContentController()
        uc.add(WeakHandler(self), name: "tahdir")
        cfg.userContentController = uc
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.progressTintColor = Config.green
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        obs = web.observe(\.estimatedProgress) { [weak self] w, _ in
            self?.progress.progress = Float(w.estimatedProgress)
            self?.progress.isHidden = w.estimatedProgress >= 1
        }
        let rc = UIRefreshControl()
        rc.addTarget(self, action: #selector(pull(_:)), for: .valueChanged)
        web.scrollView.refreshControl = rc
        web.load(URLRequest(url: pending ?? home))
        pending = nil
    }

    func load(_ url: URL) {
        if isViewLoaded { web.load(URLRequest(url: url)) } else { pending = url }
    }
    @objc private func pull(_ rc: UIRefreshControl) { web.reload(); rc.endRefreshing() }

    // MARK: الأداة
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let js = Tool.shared.script() { webView.evaluateJavaScript(js, completionHandler: nil) }
    }
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let op = m["op"] as? String else { return }
        switch op {
        case "set": if let k = m["k"] as? String { Store.shared.set(k, m["v"] as? String) }
        case "del": if let k = m["k"] as? String { Store.shared.set(k, nil) }
        case "open": tabs?.openNour(URL(string: m["url"] as? String ?? ""))
        default: break
        }
    }

    // MARK: الروابط
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url, let scheme = url.scheme else { return .allow }
        if scheme == "about" || scheme == "data" || scheme == "blob" { return .allow }
        let host = url.host ?? ""
        let isNour = host.hasSuffix("moe.gov.om"), isSite = host.hasSuffix("workers.dev")
        if isNour || isSite {
            if action.targetFrame == nil || (isNour && self !== tabs?.nour) || (isSite && self !== tabs?.site) {
                if isNour { tabs?.openNour(url) } else { tabs?.openSite(url) }
                return .cancel
            }
            return .allow
        }
        if action.navigationType == .linkActivated || action.targetFrame == nil {
            await UIApplication.shared.open(url)
            return .cancel
        }
        return .allow
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { webView.load(URLRequest(url: url)) }
        return nil
    }

    // MARK: عدم الاتصال
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled { return }
        let retry = (e.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? home.absoluteString
        let html = """
        <html dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="font-family:-apple-system;text-align:center;padding:70px 24px;color:#163">
        <h2>لا يوجد اتصال بالإنترنت</h2><p>تأكد من الاتصال ثم اضغط إعادة المحاولة.</p>
        <a href="\(retry)" style="display:inline-block;background:#0E7C66;color:#fff;border-radius:12px;padding:12px 28px;text-decoration:none">إعادة المحاولة</a></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: نوافذ التنبيه (تستخدمها الأداة)
    /// «بطاقات الإجابة»: الكاميرا لموقع خبير فقط
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let ours = ["tahdir.hudhaifa-bio.workers.dev", "khabeer.khabeer-bio.workers.dev", "elkabsula.site", "www.elkabsula.site"].contains(origin.host)
        decisionHandler(ours && type == .camera ? .grant : .deny)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (k: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "حسنًا", style: .default) { _ in k.resume() })
            present(a, animated: true)
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { (k: CheckedContinuation<Bool, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in k.resume(returning: false) })
            a.addAction(UIAlertAction(title: "موافق", style: .default) { _ in k.resume(returning: true) })
            present(a, animated: true)
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo) async -> String? {
        await withCheckedContinuation { (k: CheckedContinuation<String?, Never>) in
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in k.resume(returning: nil) })
            a.addAction(UIAlertAction(title: "موافق", style: .default) { [weak a] _ in k.resume(returning: a?.textFields?.first?.text) })
            present(a, animated: true)
        }
    }
}

/// يمنع الدوران المرجعي بين WKUserContentController والشاشة.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(uc, didReceive: m) }
}

final class SettingsScreen: UITableViewController {
    weak var tabs: MainTabs?
    private let rows: [[(String, String)]] = [
        [("arrow.clockwise", "تحديث أداة نور الآن"), ("trash", "مسح بيانات الأداة المؤقتة")],
        [("rectangle.portrait.and.arrow.right", "تسجيل الخروج من الموقع ومن نور")],
        [("info.circle", "عن التطبيق")],
    ]
    override func viewDidLoad() {
        super.viewDidLoad()
        title = "الإعدادات"
        navigationController?.navigationBar.prefersLargeTitles = true
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "c")
    }
    override func numberOfSections(in tableView: UITableView) -> Int { rows.count }
    override func tableView(_ tableView: UITableView, numberOfRowsInSection s: Int) -> Int { rows[s].count }
    override func tableView(_ tableView: UITableView, titleForFooterInSection s: Int) -> String? {
        s == 2 ? "خبير — إعداد أ. محمد مجدي، معلم الأحياء، مدرسة حذيفة بن محصن. الإصدار \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")" : nil
    }
    override func tableView(_ tableView: UITableView, cellForRowAt ip: IndexPath) -> UITableViewCell {
        let c = tableView.dequeueReusableCell(withIdentifier: "c", for: ip)
        let r = rows[ip.section][ip.row]
        var cfg = c.defaultContentConfiguration()
        cfg.text = r.1; cfg.image = UIImage(systemName: r.0)
        if ip.section == 1 { cfg.textProperties.color = .systemRed }
        c.contentConfiguration = cfg
        return c
    }
    override func tableView(_ tableView: UITableView, didSelectRowAt ip: IndexPath) {
        tableView.deselectRow(at: ip, animated: true)
        switch (ip.section, ip.row) {
        case (0, 0): Tool.shared.refresh(); toast("جاري تحديث الأداة من الموقع")
        case (0, 1): Store.shared.all = [:]; toast("تم مسح بيانات الأداة المؤقتة")
        case (1, 0):
            let a = UIAlertController(title: "تسجيل الخروج", message: "سيتم الخروج من موقع خبير ومن منصة نور على هذا الجهاز.", preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "إلغاء", style: .cancel))
            a.addAction(UIAlertAction(title: "خروج", style: .destructive) { [weak self] _ in
                let types = WKWebsiteDataStore.allWebsiteDataTypes()
                WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {
                    self?.tabs?.site.load(Config.site); self?.tabs?.nour.load(Config.nour)
                    self?.tabs?.selectedIndex = 0
                }
            })
            present(a, animated: true)
        default:
            let a = UIAlertController(title: "خبير", message: "تحضير الدروس والواجبات جاهزة للإرسال إلى منصة نور مباشرة. يختار التطبيق الدرس ويملأ الحقول، ويبقى الحفظ والنشر للمعلم.", preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "حسنًا", style: .default))
            present(a, animated: true)
        }
    }
    private func toast(_ s: String) {
        let a = UIAlertController(title: nil, message: s, preferredStyle: .alert)
        present(a, animated: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { a.dismiss(animated: true) }
    }
}
