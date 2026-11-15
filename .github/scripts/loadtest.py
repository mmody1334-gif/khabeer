# اختبار ضغط صغير وآمن على صفحات خبير العامة (بلا تسجيل دخول).
# يتوقف تلقائيًا إن تجاوزت الأخطاء 5% في أي مرحلة، وسقف الطلبات الكلي 25000.
import time, statistics, urllib.request, concurrent.futures as cf, os, threading
BASE = 'https://khaber.site'
PATHS = ['/', '/version']
STAGES = [(50, 8), (100, 8), (150, 8)]
CAP = 25000
sent = 0; lock = threading.Lock()
def hit(path):
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + path, headers={'User-Agent': 'khaber-loadtest/1', 'Accept': 'text/html'}), timeout=20)
        r.read(); code = r.status
    except urllib.error.HTTPError as e: code = e.code
    except Exception as e: code = type(e).__name__
    return code, (time.time() - t) * 1000
def stage(conc, secs):
    global sent
    res = []; end = time.time() + secs
    def worker(i):
        global sent
        out = []
        while time.time() < end:
            with lock:
                if sent >= CAP: break
                sent += 1
            out.append(hit(PATHS[(len(out) + i) % len(PATHS)]))
        return out
    with cf.ThreadPoolExecutor(conc) as ex:
        for o in ex.map(worker, range(conc)): res += o
    ok = [ms for c, ms in res if c == 200]; bad = [c for c, _ in res if c != 200]
    q = statistics.quantiles(ok, n=20) if len(ok) > 20 else [0]*19
    err = len(bad) / max(1, len(res))
    print(f'::notice::concurrency {conc}: {len(res)} req, {len(res)/secs:.0f} req/s, p50 {q[9]:.0f}ms p95 {q[18]:.0f}ms max {max(ok or [0]):.0f}ms, errors {len(bad)} ({err:.1%}) {sorted(set(map(str,bad)))[:5]}')
    return err
for conc, secs in STAGES:
    if stage(conc, secs) > 0.05: print('::warning::توقف: الأخطاء تجاوزت 5%'); break
    time.sleep(5)
print(f'::notice::total requests {sent}')
