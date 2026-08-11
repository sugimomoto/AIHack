# タスクリスト — S0：インフラ基盤

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s0-infra` |
| 作成日 | 2026-08-11 |
| 前提 | [requirements.md](requirements.md) |
| **本番URL** | **https://aida-4n47tjpp2a-an.a.run.app** |

---

## 完了したタスク

### T1｜Dockerfile ✅

- [x] `next.config.ts` に `output: "standalone"` を設定
- [x] マルチステージ Dockerfile（deps → builder → runner）
- [x] 非rootユーザーで実行（`nextjs:nodejs`）
- [x] `.dockerignore`（docs・design・.meetings・.steering を除外）
- [x] **ローカルで docker build / run を検証**（イメージ 427MB）

> **R-01（standalone が Cloud Run で動かない）はローカル検証で解消済み。**

### T2｜ヘルスチェック ✅

- [x] `GET /api/health` が `{status:"ok"}` を返す
- [x] Cloud Run の `startup_probe` に設定

### T3｜Terraform ✅（コード作成）

- [x] `providers.tf` / `backend.tf`（GCS state）/ `variables.tf`
- [x] `cloud_run.tf`：Cloud Run v2、**最小インスタンス0**、専用サービスアカウント
- [x] `secret_manager.tf`：**シークレットの値は state に残さない**（`gcloud secrets versions add` で投入）
- [x] `outputs.tf` / `terraform.tfvars.example`

### T4｜Cloud Build ✅

- [x] `infra/cloudbuild/deploy.yaml`（build → push → deploy）
- [x] Cloud Build サービスアカウントへの権限付与（AR writer / logWriter / run.admin / SA user）
- [x] **手動実行でビルド〜デプロイ成功**

### T5｜GitHub Actions ✅

- [x] `.github/workflows/ci.yml`（typecheck / lint / build）
- [x] `package.json` に `typecheck` スクリプトを追加

### T6｜本番稼働の確認 ✅

- [x] **本番URLでモックが表示される**
- [x] `/api/health` が 200
- [x] 静的アセット（カピバラ画像）が 200
- [x] 未認証アクセスを許可（`allUsers` に `run.invoker`）

---

### T7｜Terraform の適用 ✅

- [x] Terraform v1.15.8 をインストール（`brew tap hashicorp/tap`）
- [x] `terraform init`（GCS バックエンド）
- [x] **既存リソースを import**（Cloud Run / サービスアカウント）
- [x] **`terraform plan` の差分ゼロを確認** → AC-04 達成
- [x] `terraform.tfvars` を作成（`.gitignore` 済み）

> **Homebrew core から Terraform が削除されていた**（BUSL ライセンス化のため）。
> `brew tap hashicorp/tap && brew install hashicorp/tap/terraform` で解決。
>
> import 後に**サービスレベルの `scaling` ブロックで差分が残った**（API が既定値を設定するため）。
> 設定に明示して解消した。

### T8｜シークレットの投入 ✅

- [x] Secret Manager に `orcarouter-api-key` を作成（Terraform）
- [x] **値を投入**（`gcloud secrets versions add`。**値を画面に出さずに実行**）
- [x] Cloud Run の環境変数 `ORCAROUTER_API_KEY` が Secret Manager 参照になっている

> **値は Terraform state に残さない。**シークレット本体は Terraform で管理せず、
> `gcloud` で投入する方針とした。

---

## 残タスク

### T9｜自動デプロイ 〔要対応・手動ステップあり〕

- [ ] **⚠️ GitHub リポジトリを Cloud Build に接続する**（コンソールでの OAuth 認可が必要）
      https://console.cloud.google.com/cloud-build/triggers;region=asia-northeast1?project=aida-505206
      → 「リポジトリを接続」→ GitHub → `sugimomoto/AIHack` を選択
- [ ] トリガーを作成（接続後に以下を実行）
      ```
      gcloud builds triggers create github \
        --name=aida-deploy-main \
        --repo-owner=sugimomoto --repo-name=AIHack \
        --branch-pattern='^main$' \
        --build-config=infra/cloudbuild/deploy.yaml \
        --substitutions=_TAG='$SHORT_SHA' \
        --region=asia-northeast1 --project=aida-505206
      ```
- [ ] push で自動デプロイされることを確認

> **CLI からトリガーを作ろうとしたが `INVALID_ARGUMENT` で失敗した。**
> Cloud Build の GitHub App による接続が先に必要で、これはコンソールでの認可を伴う。

### T10｜予算アラート 〔要対応〕

- [ ] **設定済みか確認する**（未確認）
      https://console.cloud.google.com/billing/budgets?project=aida-505206

---

## 受け入れ条件の達成状況

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **Cloud Run の本番URLでモックが表示される** | ✅ |
| AC-02 | `main` への push で自動デプロイされる | ⬜ **T9（GitHub接続が必要）** |
| AC-03 | CI が通らないとデプロイされない | ⬜ T9 |
| AC-04 | **Terraform で再現できる** | ✅ **差分ゼロを確認** |
| AC-05 | サービスアカウント鍵をリポジトリに置いていない | ✅ |
| AC-06 | APIキーが Secret Manager から読まれる | ✅ |
| AC-07 | ヘルスチェックが 200 を返す | ✅ |
| AC-08 | **最小インスタンス数が 0** | ✅ Terraform で明示 |

---

## 補足

### Vercel との併存

| | |
| --- | --- |
| Vercel | https://aih-3jnijo1kh-aida20.vercel.app — **レビュー依頼中のため残す** |
| Cloud Run | https://aida-4n47tjpp2a-an.a.run.app — 本番 |

**レビューが終わるまでURLを切り替えない。**送付済みのURLが変わるのは混乱のもとになる。

### イメージサイズ

427MB。Next.js standalone としては標準的。必要なら `node:24-alpine` で削減できるが、**現時点で最適化は不要**。
