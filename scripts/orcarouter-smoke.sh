#!/usr/bin/env bash
# OrcaRouter 疎通確認スクリプト（S3 の事前検証）
#
# 使い方:
#   cp .env.example .env.local   # ORCAROUTER_API_KEY を記入
#   bash scripts/orcarouter-smoke.sh
#
# 検証内容:
#   1. 疎通とモデルカタログの取得
#   2. 構造化出力（json_schema）— SMALL 階層
#   3. R-08: Anthropic の response_format 実機検証
#   4. usage の取得とコストモデルの検算
#   5. R-09: レート制限に関するレスポンスヘッダ
#
# ※ APIキーは表示しない。ログにも残さない。

set -uo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "✗ .env.local がありません。'cp .env.example .env.local' して ORCAROUTER_API_KEY を記入してください。"
  exit 1
fi

set -a; source .env.local; set +a
BASE="${ORCAROUTER_BASE_URL:-https://api.orcarouter.ai/v1}"

if [ -z "${ORCAROUTER_API_KEY:-}" ] || [[ "$ORCAROUTER_API_KEY" == *xxxxx* ]]; then
  echo "✗ ORCAROUTER_API_KEY が未設定です（.env.local）"
  exit 1
fi
echo "✓ APIキーを読み込みました（末尾4桁: ...${ORCAROUTER_API_KEY: -4}）"
echo "  base_url: $BASE"
echo

AUTH="Authorization: Bearer $ORCAROUTER_API_KEY"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- 1. 疎通
echo "── 1. 疎通とモデルカタログ ──"
code=$(curl -s -o "$TMP/models.json" -w '%{http_code}' --max-time 30 -H "$AUTH" "$BASE/models")
if [ "$code" != "200" ]; then
  echo "✗ /v1/models が HTTP $code"; head -c 400 "$TMP/models.json"; echo; exit 1
fi
python3 - "$TMP/models.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); rows=d.get('data',[])
print(f"✓ 疎通OK。利用可能モデル {len(rows)} 件")
for want in ('openai/gpt-5-nano','openai/gpt-4.1-mini','openai/gpt-5.1','anthropic/claude-sonnet-5','google/gemini-2.5-flash'):
    print(('  ✓ ' if any(r['id']==want for r in rows) else '  ✗ 見つからない: ')+want)
PY
echo

# ------------------------------------------------- 2. 構造化出力（SMALL）
echo "── 2. 構造化出力 json_schema（SMALL: ${MODEL_TIER_SMALL:-openai/gpt-5-nano}）──"
cat > "$TMP/req_small.json" <<JSON
{
  "model": "${MODEL_TIER_SMALL:-openai/gpt-5-nano}",
  "messages": [
    {"role":"system","content":"日本語の入力から、養育費の提案内容を抽出してください。"},
    {"role":"user","content":"月3万が限界。こっちだって仕事切られて必死なんだよ。そっちだって働いてるだろ。"}
  ],
  "response_format": {
    "type":"json_schema",
    "json_schema": {
      "name":"child_support_proposal","strict":true,
      "schema":{"type":"object","additionalProperties":false,
        "properties":{
          "monthlyAmount":{"type":"integer"},
          "intents":{"type":"array","items":{"type":"string","enum":["REQUEST","PROPOSAL","ACCEPT","REJECT","EMOTIONAL_EXPRESSION","INFO_QUERY"]}},
          "contextFacts":{"type":"array","items":{"type":"string"}}
        },
        "required":["monthlyAmount","intents","contextFacts"]}
    }
  }
}
JSON
code=$(curl -s -o "$TMP/small.json" -w '%{http_code}' --max-time 90 \
  -H "$AUTH" -H 'Content-Type: application/json' -d @"$TMP/req_small.json" "$BASE/chat/completions")
python3 - "$TMP/small.json" "$code" <<'PY'
import json,sys
code=sys.argv[2]
try: d=json.load(open(sys.argv[1]))
except Exception: print(f"✗ HTTP {code} / JSONではない"); raise SystemExit
if code!="200":
    print(f"✗ HTTP {code}:", json.dumps(d, ensure_ascii=False)[:300]); raise SystemExit
c=d["choices"][0]["message"]["content"]
try:
    p=json.loads(c); print("✓ json_schema に準拠した出力を取得")
    print("   ", json.dumps(p, ensure_ascii=False)[:220])
except Exception:
    print("✗ JSONとして解釈できない:", c[:200])
u=d.get("usage",{}); print(f"   usage: in={u.get('prompt_tokens')} out={u.get('completion_tokens')}")
PY
echo

# --------------------------------- 3. R-08: Anthropic の response_format
echo "── 3. R-08: Anthropic の response_format 実機検証 ──"
cat > "$TMP/req_anth.json" <<'JSON'
{
  "model": "anthropic/claude-sonnet-5",
  "max_tokens": 300,
  "messages": [{"role":"user","content":"名前と年齢を抽出: 山田太郎さん、42歳"}],
  "response_format": {
    "type":"json_schema",
    "json_schema":{"name":"person","strict":true,
      "schema":{"type":"object","additionalProperties":false,
        "properties":{"name":{"type":"string"},"age":{"type":"integer"}},
        "required":["name","age"]}}
  }
}
JSON
code=$(curl -s -o "$TMP/anth.json" -w '%{http_code}' --max-time 90 \
  -H "$AUTH" -H 'Content-Type: application/json' -d @"$TMP/req_anth.json" "$BASE/chat/completions")
python3 - "$TMP/anth.json" "$code" <<'PY'
import json,sys
code=sys.argv[2]
try: d=json.load(open(sys.argv[1]))
except Exception: print(f"△ HTTP {code} / JSONではない → ドキュメント通り非対応の可能性"); raise SystemExit
if code!="200":
    msg=json.dumps(d, ensure_ascii=False)[:300]
    print(f"△ HTTP {code} → 非対応と判断。tool_use パターンで代替する")
    print("   ", msg); raise SystemExit
c=d["choices"][0]["message"]["content"]
try:
    json.loads(c); print("✓ Anthropic でも json_schema が通った（ドキュメントの記載と異なる）")
    print("   ", c[:160])
except Exception:
    print("△ 200 だがJSONではない → schema 強制はされていない")
    print("   ", c[:160])
PY
echo

# ------------------------------------------- 4. コストモデルの検算（LARGE）
echo "── 4. usage 取得とコスト検算（MEDIUM: ${MODEL_TIER_MEDIUM:-openai/gpt-4.1-mini}）──"
cat > "$TMP/req_med.json" <<JSON
{"model":"${MODEL_TIER_MEDIUM:-openai/gpt-4.1-mini}","max_tokens":200,
 "messages":[{"role":"user","content":"「土曜の予定を変えたい」という相談を、中立的な一文に言い換えてください。"}]}
JSON
curl -s -D "$TMP/hdr.txt" -o "$TMP/med.json" --max-time 90 \
  -H "$AUTH" -H 'Content-Type: application/json' -d @"$TMP/req_med.json" "$BASE/chat/completions" >/dev/null
python3 - "$TMP/med.json" <<'PY'
import json,sys,urllib.request
d=json.load(open(sys.argv[1]))
if "usage" not in d: print("✗ usage が返らない:", json.dumps(d,ensure_ascii=False)[:200]); raise SystemExit
u=d["usage"]; model=d.get("model","?")
print(f"✓ usage 取得: in={u.get('prompt_tokens')} out={u.get('completion_tokens')} model={model}")
try:
    pr=json.load(urllib.request.urlopen("https://api.orcarouter.ai/api/pricing", timeout=20))["data"]
    r=next((x for x in pr if x["model_name"]==model), None)
    if r:
        i=r["model_ratio"]*2; o=i*r["completion_ratio"]
        cost=u["prompt_tokens"]*i/1e6 + u["completion_tokens"]*o/1e6
        print(f"   単価: in=${i:.3f}/1M out=${o:.3f}/1M → この呼び出し ${cost:.6f}（{cost*150:.4f}円）")
except Exception as e:
    print("   価格APIの取得に失敗:", e)
PY
echo "  レート制限系ヘッダ:"
grep -iE 'ratelimit|retry-after|x-request|x-orca' "$TMP/hdr.txt" | sed 's/^/    /' || echo "    （なし）"
echo
echo "── 完了 ──"
