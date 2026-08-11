#!/usr/bin/env bash
# GCP セットアップの診断
#
#   bash scripts/gcp-check.sh              # 現在のプロジェクトを診断
#   PROJECT_ID=xxx bash scripts/gcp-check.sh
#
# 各ステップの状態を確認し、次に何をすればよいかを表示する。
# 何も変更しない（読み取りのみ）。

set -uo pipefail

# --- gcloud の場所を解決（.zshrc に依存しない） ---
if ! command -v gcloud >/dev/null 2>&1; then
  for _p in "$HOME/google-cloud-sdk/bin" \
            /opt/homebrew/share/google-cloud-sdk/bin \
            /usr/local/share/google-cloud-sdk/bin \
            /opt/homebrew/bin /usr/local/bin; do
    [ -x "$_p/gcloud" ] && { PATH="$_p:$PATH"; break; }
  done
fi

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31m✗\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m△\033[0m %s\n' "$1"; }
next() { printf '\n\033[1m次にやること:\033[0m\n  %s\n\n' "$1"; }

echo "════════════════════════════════════"
echo " GCP セットアップ診断"
echo "════════════════════════════════════"
echo

# ── 1. gcloud CLI ───────────────────────────────────────────────
echo "1. gcloud CLI"
if ! command -v gcloud >/dev/null 2>&1; then
  ng "インストールされていません"
  next "brew install --cask google-cloud-sdk
  （インストール後、ターミナルを開き直すか 'exec \$SHELL -l' を実行）"
  exit 1
fi
ok "$(gcloud version 2>/dev/null | head -1)"
echo

# ── 2. ログイン ─────────────────────────────────────────────────
echo "2. ログイン"
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ] || [ "$ACCOUNT" = "(unset)" ]; then
  ng "ログインしていません"
  next "gcloud auth login"
  exit 1
fi
ok "アカウント: $ACCOUNT"

if [ -f ~/.config/gcloud/application_default_credentials.json ]; then
  ok "アプリケーションデフォルト認証情報（ADC）あり"
else
  warn "ADC がありません（Terraform で必要）"
  echo "     → gcloud auth application-default login"
fi
echo

# ── 3. プロジェクト ─────────────────────────────────────────────
echo "3. プロジェクト"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  ng "プロジェクトが未設定です"
  echo
  echo "  利用可能なプロジェクト:"
  gcloud projects list --format='table(projectId,name)' 2>/dev/null | sed 's/^/    /' || echo "    (取得できません)"
  next "gcloud config set project <PROJECT_ID>"
  exit 1
fi
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  ng "プロジェクト '$PROJECT_ID' にアクセスできません（存在しないか権限なし）"
  exit 1
fi
ok "プロジェクト: $PROJECT_ID"
echo

# ── 4. 課金 ─────────────────────────────────────────────────────
echo "4. 課金"
BILLING=$(gcloud beta billing projects describe "$PROJECT_ID" \
  --format='value(billingEnabled)' 2>/dev/null || echo "ERROR")
case "$BILLING" in
  True)  ok "課金アカウントが紐づいています" ;;
  False)
    ng "課金アカウントが紐づいていません"
    next "コンソールで紐付け:
  https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID

  ※ これがないと Cloud Run / Artifact Registry などが有効化できません"
    exit 1 ;;
  *)
    warn "課金状態を確認できません（gcloud beta が未インストールの可能性）"
    echo "     → gcloud components install beta"
    echo "     → または コンソールで確認: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID" ;;
esac
echo

# ── 5. API ──────────────────────────────────────────────────────
echo "5. API の有効化"
NEED=(run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
      secretmanager.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com
      cloudresourcemanager.googleapis.com iam.googleapis.com)
ENABLED=$(gcloud services list --enabled --project="$PROJECT_ID" --format='value(config.name)' 2>/dev/null)
MISSING=()
for a in "${NEED[@]}"; do
  if grep -qx "$a" <<<"$ENABLED"; then ok "$a"; else ng "$a"; MISSING+=("$a"); fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  next "PROJECT_ID=$PROJECT_ID bash scripts/gcp-bootstrap.sh
  （または gcloud services enable ${MISSING[*]} --project=$PROJECT_ID）"
  exit 1
fi
echo

# ── 6. Firestore ────────────────────────────────────────────────
echo "6. Firestore"
if DB=$(gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" \
        --format='value(locationId,type)' 2>/dev/null); then
  LOC=$(cut -f1 <<<"$DB"); TYPE=$(cut -f2 <<<"$DB")
  ok "存在します（location=$LOC / type=$TYPE）"
  [ "$LOC" != "asia-northeast1" ] && warn "ロケーションが asia-northeast1 ではありません。※変更不可"
  [[ "$TYPE" != *NATIVE* ]] && warn "Native mode ではありません。※変更不可"
else
  ng "未作成"
  next "PROJECT_ID=$PROJECT_ID bash scripts/gcp-bootstrap.sh"
  exit 1
fi
echo

# ── 7. その他リソース ───────────────────────────────────────────
echo "7. その他"
gcloud storage buckets describe "gs://${PROJECT_ID}-tfstate" --project="$PROJECT_ID" >/dev/null 2>&1 \
  && ok "Terraform state バケット" || warn "Terraform state バケット未作成（bootstrap で作成）"
gcloud artifacts repositories describe aida --location=asia-northeast1 --project="$PROJECT_ID" >/dev/null 2>&1 \
  && ok "Artifact Registry" || warn "Artifact Registry 未作成（bootstrap で作成）"
echo

echo "════════════════════════════════════"
echo " すべて完了しています"
echo "════════════════════════════════════"
echo
echo "残りは手動:"
echo "  予算アラート  https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"
echo "  Firebase Auth https://console.firebase.google.com/"
