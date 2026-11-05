#!/usr/bin/env bash
# يحدد حساب Cloudflare الخاص بـ«خبير» (نطاق workers.dev = khabeer) وقاعدة D1 «khabeer»
# ويصدّرهما كمتغيرات للخطوات التالية: CF_ACCOUNT و CF_DB. لا يلمس أي حساب آخر.
set -euo pipefail
API=https://api.cloudflare.com/client/v4
AUTH="Authorization: Bearer ${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN secret is missing}"
ACC=""
for a in $(curl -sS "$API/accounts?per_page=50" -H "$AUTH" | python3 -c "import sys,json;print(' '.join(x['id'] for x in json.load(sys.stdin)['result']))"); do
  sub=$(curl -sS "$API/accounts/$a/workers/subdomain" -H "$AUTH" | python3 -c "import sys,json;print((json.load(sys.stdin).get('result') or {}).get('subdomain',''))" || true)
  if [ "$sub" = "khabeer" ]; then ACC=$a; fi
done
[ -n "$ACC" ] || { echo "::error::لم أجد حساب khabeer بهذا التوكن"; exit 1; }
DB=$(curl -sS "$API/accounts/$ACC/d1/database?name=khabeer" -H "$AUTH" | python3 -c "import sys,json;r=[d['uuid'] for d in json.load(sys.stdin)['result'] if d['name']=='khabeer'];print(r[0] if r else '')")
echo "CF_ACCOUNT=$ACC" >> "$GITHUB_ENV"
echo "CF_DB=$DB" >> "$GITHUB_ENV"
echo "::notice::Cloudflare account $ACC, D1 khabeer = ${DB:-غير موجودة بعد}"
