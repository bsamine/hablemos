#!/usr/bin/env bash
# Lists the Gemini models your API key can use (reads GEMINI_API_KEY from .env).
#   ./scripts/check-models.sh
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)
[ -n "$KEY" ] || { echo "GEMINI_API_KEY is empty in .env"; exit 1; }
curl -s -H "x-goog-api-key: $KEY" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=500" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if "error" in d:
    sys.exit("Gemini error: " + d["error"].get("message", str(d["error"])))
live, text = [], []
for m in d.get("models", []):
    name = m["name"].split("/", 1)[1]
    methods = m.get("supportedGenerationMethods", [])
    if "bidiGenerateContent" in methods:
        live.append(name)
    elif "generateContent" in methods and "flash" in name:
        text.append(name)
print("LIVE models (for GEMINI_LIVE_MODEL):")
for n in sorted(live): print("  ", n)
print("TEXT models (for GEMINI_TEXT_MODEL):")
for n in sorted(text): print("  ", n)
env = dict(l.split("=", 1) for l in open(".env") if "=" in l and not l.startswith("#"))
for k, pool in (("GEMINI_LIVE_MODEL", live), ("GEMINI_TEXT_MODEL", live + text)):
    v = env.get(k, "").strip()
    print(f"\n{k}={v}  ->", "OK" if v in pool else "NOT FOUND, pick one from the list above")
'
