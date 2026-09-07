#!/bin/bash
# Charge l'application dans un Chrome headless, la pilote par le DOM, et rapporte.
cd "$(dirname "$0")/.."

# ── Les pages éditoriales d'abord (elles ne passent pas par build.mjs) ──────────
# 🚨 Elles sont parties en production sans relecture le 07/09/2026, avec une balise
# qui demandait leur exclusion de SafeSearch et une stratégie de base fausse. Rien ne
# les vérifiait parce que rien ne les construisait. Maintenant, si.
node outils/verifier-pages.mjs || exit 1
echo

python3 - <<'PY'
s=open("index.html",encoding="utf8").read()
h='<script>window.__err=[];addEventListener("error",e=>__err.push("ERREUR "+(e.message||e)+" | "+((e.error&&e.error.stack)||"").split("\\n").slice(0,2).join(" ")));addEventListener("unhandledrejection",e=>__err.push("REJET "+((e.reason&&e.reason.message)||e.reason)+" | "+((e.reason&&e.reason.stack)||"").split("\\n").slice(1,3).join(" ")));</script>\n'
p='\n<div id="SONDE">en attente</div><script>\n'+open("outils/sonde.js",encoding="utf8").read()+'\n</script>'
i=s.index("<style>")
open("/tmp/essai.html","w",encoding="utf8").write(s[:i]+h+s[i:]+p)
PY
lsof -ti:8731 >/dev/null 2>&1 || (cd /tmp && python3 -m http.server 8731 >/dev/null 2>&1 &)
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=600000 --dump-dom http://127.0.0.1:8731/essai.html 2>/dev/null \
  | python3 -c "
import sys,re,html,io
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
sys.stdin=io.TextIOWrapper(sys.stdin.buffer,encoding='utf-8',errors='replace')
d=sys.stdin.read()
m=re.search(r'<div id=\"SONDE\">(.*?)</div>',d,re.S)
t=html.unescape(m.group(1)) if m else 'SONDE INTROUVABLE'
res,_,err=t.partition(' || ')
ko=[x for x in res.split(' ; ') if x.startswith('KO')]
for x in res.replace('RES ','').split(' ; '): print(('  ' if x.startswith('ok') else '✗ ')+x)
print()
print(err)
print()
# Une sonde qui n'a pas écrit « RES » n'a PAS fini (budget de temps virtuel épuisé, ou
# plantage avant la ligne finale) : c'est un ÉCHEC, jamais un « TOUT PASSE » sur du vide.
if not res.startswith('RES'): print('SONDE INCOMPLÈTE : elle n\'a pas fini (budget de temps virtuel épuisé ?) — ÉCHEC'); sys.exit(1)
if ko: print('ÉCHECS : '+str(len(ko))); sys.exit(1)
print('TOUT PASSE')
"
