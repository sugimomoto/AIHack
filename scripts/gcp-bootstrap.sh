#!/usr/bin/env bash
# GCP 事前設定（S0 の前提）
#
# 使い方:
#   PROJECT_ID=your-project-id bash scripts/gcp-bootstrap.sh
#
# 実行内容:
#   1. 必要な API の有効化
#   2. Firestore データベースの作成（Native mode / asia-northeast1）
#   3. Terraform state 用の GCS バケット作成
#   4. Artifact Registry リポジトリ作成
#
# ⚠️ Firestore のロケーションは後から変更できない。asia-northeast1 で作る。

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-northeast1}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "✗ PROJECT_ID を指定してください: PROJECT_ID=xxx bash scripts/gcp-bootstrap.sh"
  exit 1
fi

echo "project : $PROJECT_ID"
echo "region  : $REGION"
echo

# --- 課金の確認 -------------------------------------------------------------
BILLING=$(gcloud beta billing projects describe "$PROJECT_ID" \
  --format='value(billingEnabled)' 2>/dev/null || echo "unknown")
if [ "$BILLING" != "True" ]; then
  echo "⚠️  課金アカウントが紐づいていない可能性があります（billingEnabled=$BILLING）"
  echo "    先に課金を有効化してください。多くの API が有効化できません。"
  echo
fi

# --- 1. API の有効化 --------------------------------------------------------
echo "── 1. API の有効化 ──"
APIS=(
  run.googleapis.com                 # Cloud Run
  artifactregistry.googleapis.com    # Artifact Registry
  cloudbuild.googleapis.com          # Cloud Build
  secretmanager.googleapis.com       # Secret Manager
  firestore.googleapis.com           # Firestore
  firebase.googleapis.com            # Firebase
  identitytoolkit.googleapis.com     # Firebase Authentication
  cloudscheduler.googleapis.com      # Cloud Scheduler（S9 の逸脱検知バッチ）
  cloudresourcemanager.googleapis.com # Terraform
  iam.googleapis.com
  iamcredentials.googleapis.com      # Workload Identity（GitHub Actions）
  sts.googleapis.com
  logging.googleapis.com
  monitoring.googleapis.com
  cloudtrace.googleapis.com
)
gcloud services enable "${APIS[@]}" --project="$PROJECT_ID"
echo "✓ 有効化しました（${#APIS[@]}件）"
echo

# --- 2. Firestore -----------------------------------------------------------
echo "── 2. Firestore（Native mode / $REGION）──"
if gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" >/dev/null 2>&1; then
  LOC=$(gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" --format='value(locationId)')
  TYPE=$(gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" --format='value(type)')
  echo "  既に存在します: location=$LOC type=$TYPE"
  [ "$LOC" != "$REGION" ] && echo "  ⚠️ ロケーションが $REGION ではありません。変更不可のため要検討。"
else
  gcloud firestore databases create --location="$REGION" --type=firestore-native --project="$PROJECT_ID"
  echo "✓ 作成しました"
fi
echo

# --- 3. Terraform state バケット --------------------------------------------
echo "── 3. Terraform state 用バケット ──"
BUCKET="gs://${PROJECT_ID}-tfstate"
if gcloud storage buckets describe "$BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  既に存在します: $BUCKET"
else
  gcloud storage buckets create "$BUCKET" \
    --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access
  gcloud storage buckets update "$BUCKET" --versioning
  echo "✓ 作成しました: $BUCKET（バージョニング有効）"
fi
echo

# --- 4. Artifact Registry ---------------------------------------------------
echo "── 4. Artifact Registry ──"
REPO="aida"
if gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  既に存在します: $REPO"
else
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker --location="$REGION" \
    --description="Aida container images" --project="$PROJECT_ID"
  echo "✓ 作成しました: $REPO"
fi
echo

echo "── 完了 ──"
echo
echo "次に手動で行うこと:"
echo "  1. 予算アラートの設定（重要）"
echo "     https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"
echo "  2. Firebase コンソールでプロジェクトを追加し、Authentication を有効化"
echo "     https://console.firebase.google.com/"
