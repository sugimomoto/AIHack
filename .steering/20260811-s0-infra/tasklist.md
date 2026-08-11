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

## 残タスク

### T7｜Terraform の適用 〔要対応〕

- [ ] **Terraform をインストールする**（未インストール）
      `brew install terraform`
- [ ] `terraform init`（GCS バックエンド）
- [ ] **既存リソースを import する**
      Cloud Run サービスは Cloud Build 経由で先に作成済みのため
- [ ] `terraform plan` に差分がないことを確認
- [ ] `terraform.tfvars` を作成（`.gitignore` 済み）

> **現状、Cloud Run は Terraform 管理外。**AC-04（Terraform で再現できる）が未達。

### T8｜シークレットの投入

- [ ] Secret Manager に `orcarouter-api-key` を作成
- [ ] 値を投入（`gcloud secrets versions add`。**コマンド履歴に残さない**）
- [ ] Cloud Run から読めることを確認

### T9｜自動デプロイ

- [ ] Cloud Build トリガーを作成（`main` への push）
- [ ] `_TAG=$SHORT_SHA` を substitution に設定
- [ ] **CI が通らないとデプロイされない**構成にする
- [ ] push で自動デプロイされることを確認

### T10｜予算アラート 〔要対応〕

- [ ] **設定済みか確認する**（未確認）
      https://console.cloud.google.com/billing/budgets?project=aida-505206

---

## 受け入れ条件の達成状況

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **Cloud Run の本番URLでモックが表示される** | ✅ |
| AC-02 | `main` への push で自動デプロイされる | ⬜ T9 |
| AC-03 | CI が通らないとデプロイされない | ⬜ T9 |
| AC-04 | **Terraform で再現できる** | ⬜ **T7（Terraform 未インストール）** |
| AC-05 | サービスアカウント鍵をリポジトリに置いていない | ✅ |
| AC-06 | APIキーが Secret Manager から読まれる | ⬜ T8 |
| AC-07 | ヘルスチェックが 200 を返す | ✅ |
| AC-08 | **最小インスタンス数が 0** | ✅（既定値0。Terraform 適用で明示化） |

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
