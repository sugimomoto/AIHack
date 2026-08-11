# 要求定義書 — S0：インフラ基盤

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s0-infra` |
| スライス | **S0**（→ [roadmap.md](../roadmap.md)） |
| 作成日 | 2026-08-11 |
| 前提 | [architecture.md](../../docs/architecture.md) |

---

## 1. 目的

> **中身が空のアプリが、本番URL（Cloud Run）で動いている状態を作る。**

### 1.1 なぜ最初にやるのか

**インフラを後回しにすることが、最も多い失敗要因である。**

```
❌ 機能を作ってから最後にデプロイ → 締切直前にパイプラインで詰まる
✅ 空のアプリを先に本番へ通す     → 以降は中身を足すだけ
```

現時点で**モックは Vercel で動いている**。S0 の完了により、**同じものが Cloud Run で動く**状態にする。

### 1.2 GCP の準備は完了している

| 項目 | 状態 |
| --- | --- |
| プロジェクト | ✅ `aida-505206` |
| 課金 | ✅ 紐付け済み |
| API | ✅ 15件有効化済み |
| Firestore | ✅ `asia-northeast1` / Native mode |
| Terraform state バケット | ✅ `gs://aida-505206-tfstate` |
| Artifact Registry | ✅ `aida` |

**残りはコード側（Dockerfile / Terraform / CI/CD）である。**

---

## 2. スコープ

### 2.1 実装する

| # | 項目 |
| --- | --- |
| 1 | **Dockerfile**（Next.js standalone ビルド） |
| 2 | **Terraform**（Cloud Run / IAM / Secret Manager の参照） |
| 3 | **GitHub Actions**（lint / typecheck / build） |
| 4 | **Cloud Build**（コンテナのビルドと Cloud Run へのデプロイ） |
| 5 | **Workload Identity 連携**（GitHub Actions → GCP。鍵ファイルを使わない） |
| 6 | シークレットの Secret Manager 登録（OrcaRouter APIキー） |
| 7 | ヘルスチェック用エンドポイント |

### 2.2 実装しない

| 除外 | 理由 |
| --- | --- |
| **prod 環境** | dev のみとする。2環境の維持コストに見合わない |
| Firestore の利用 | S1 で行う。S0 では接続確認まで |
| 監視ダッシュボード・アラート | S14 で行う |
| Cloud Run Jobs（逸脱検知バッチ） | S9 で行う |
| カスタムドメイン | 不要 |
| Vercel の停止 | **モックのレビューが進行中のため残す** |

### 2.3 Vercel との関係

| | |
| --- | --- |
| 現状 | モックが Vercel で公開され、**レビュー依頼中** |
| S0 完了後 | Cloud Run が本番。**Vercel はレビューが終わるまで併存させる** |
| 最終的に | Vercel を停止し、Cloud Run に一本化する |

> **レビュー中のURLを切り替えない。**レビュアーに再度URLを送るのは混乱のもとになる。

---

## 3. 受け入れ条件

- [ ] **AC-01｜Cloud Run の本番URLでモックが表示される**
- [ ] AC-02｜`main` への push で自動デプロイされる
- [ ] AC-03｜CI（lint / typecheck / build）が通らないとデプロイされない
- [ ] AC-04｜**GCPリソースが Terraform で定義され、`terraform apply` で再現できる**
- [ ] AC-05｜**サービスアカウントの鍵ファイルをリポジトリに置いていない**（Workload Identity を使う）
- [ ] AC-06｜OrcaRouter の APIキーが Secret Manager から読まれる（**環境変数に直書きしない**）
- [ ] AC-07｜ヘルスチェックが 200 を返す
- [ ] AC-08｜**最小インスタンス数が 0**（常時稼働コストを持たない）

---

## 4. 制約

| # | 制約 |
| --- | --- |
| K-01 | リージョンは **asia-northeast1**（→ architecture.md §6.3） |
| K-02 | **Cloud Run 最小インスタンス 0。**個人負担のため常時稼働させない |
| K-03 | **Terraform は最小構成に留める。**凝らない |
| K-04 | 環境は **dev のみ** |
| K-05 | シークレットをリポジトリに含めない（`.gitleaks.toml` で検出） |

---

## 5. リスク

| # | リスク | 対応 |
| --- | --- | --- |
| R-01 | Next.js の standalone ビルドが Cloud Run で動かない | **最初にローカルで Docker ビルドと起動を確認**してから Terraform に進む |
| R-02 | Workload Identity の設定が複雑で詰まる | 詰まった場合は**サービスアカウント鍵を使わず、Cloud Build のトリガー連携に切り替える** |
| R-03 | 想定外の課金 | 最小インスタンス0 ＋ **予算アラート**（設定済みか要確認） |
| R-04 | Terraform state の破損 | GCS バケットのバージョニングは有効化済み |

---

## 6. 未確定事項

| # | 内容 |
| --- | --- |
| C-01 | **予算アラートが設定済みか**（コンソール確認が必要） |
| C-02 | Firebase Authentication の有効化（S2 で必要。S0 では不要） |
| C-03 | デプロイ経路を GitHub Actions 主導にするか Cloud Build トリガー主導にするか |

---

## 7. 承認

- [ ] 本要求定義書の内容で design.md に進む
