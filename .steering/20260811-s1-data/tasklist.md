# タスクリスト — S1：データ基盤・マスタ

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s1-data` |
| 作成日 | 2026-08-11 |
| 前提 | [requirements.md](requirements.md) |

---

## 完了

### T1｜Firestore ルール（L0）✅

- [x] `firestore/firestore.rules` — **default deny**（全コレクションに `allow ... if false`）
- [x] `firestore/firestore.indexes.json`
- [x] `firebase.json` / `.firebaserc`（エミュレータ構成）

> **Admin SDK はルールをバイパスする**ため、サーバー側の動作には影響しない。
> この deny が効くのは「クライアントが直接叩いてきた」最悪ケースである。

### T2｜ドメイン層 ✅

- [x] `src/domain/agreement/topics.ts` — 8論点の enum、表示名、**受益者の区分**
- [x] `src/domain/agreement/stateMachine.ts` — 状態・イベント・遷移表
- [x] `src/domain/adjustment/effect.ts` — **`ONE_TIME` / `PERMANENT` の分岐**

> `domain/` は Next.js・Firestore SDK・LLM SDK に依存しない（→ development-guidelines.md §2.4）。
> そのためモックなしでテストできる。

### T3｜マスタ seed ✅

| ファイル | 件数 |
| --- | --- |
| `topicCategories.json` | 4 |
| `scenarios.json` | 17（FORMAL 2 / ADJUSTMENT 12 / NOTIFICATION 3） |
| `payloadSchemas.json` | 2（養育費・面会交流） |
| `clauseTemplates.json` | 2 |

- [x] `scripts/seed-firestore.ts`（冪等。エミュレータ／本番の両対応）
- [x] **本番（`aida-505206`）への投入を確認**

### T4｜テスト ✅ 81件

| テスト | 件数 | 内容 |
| --- | --- | --- |
| `stateMachine.test.ts` | 59 | **状態6 × イベント9 = 54組み合わせを全網羅**。到達可能性・終端状態 |
| `adjustmentEffect.test.ts` | 12 | **`ONE_TIME` が合意を変えないこと**、入力検証 |
| `clausePlaceholder.test.ts` | 6 | **G-3**（プレースホルダ ⊆ スキーマのキー）、G-4 |
| `seeds.test.ts` | 5 | マスタの参照整合、FORMAL の制約 |
| `denyClientAccess.test.ts` | — | **L0**（CI で実行。ローカルは Java が必要） |

### T5｜CI ✅

- [x] typecheck / lint / **ドメインテスト** / **ルールテスト** / build
- [x] `actions/setup-java`（Firestore エミュレータ用）
- [x] ESLint の対象から `design/`・`infra/`・`public/` を除外

---

## 受け入れ条件

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **ルールがクライアントの全アクセスを拒否する** | ✅ テスト作成（CI で実行） |
| AC-02 | エミュレータで seed を投入できる | ⬜ **ローカルに Java が必要** |
| AC-03 | 本番に seed を投入できる | ✅ 実行確認済み |
| AC-04 | **状態遷移が全パス網羅でテストされている** | ✅ **54組み合わせ** |
| AC-05 | 不正な遷移が拒否される | ✅ 45件の拒否を検証 |
| AC-06 | **G-3：プレースホルダ ⊆ スキーマのキー** | ✅ |
| AC-07 | `ONE_TIME` / `PERMANENT` の分岐 | ✅ |
| AC-08 | CI でテストが実行される | ✅ |

---

## 残タスク

### T6｜ローカルのエミュレータ 〔任意〕

- [ ] **Java をインストールする**（Firestore エミュレータに必要）
      `brew install openjdk`
- [ ] `pnpm emulator` で起動
- [ ] `pnpm test:rules` でルールテストを実行

> **CI では動く**ため、必須ではない。ローカルでルールを触るときにあると便利。

---

## 設計上の記録

### 状態機械のテスト設計

**「正しい遷移が動く」だけでは不十分**と考え、次の3層で検証した。

| 層 | 内容 |
| --- | --- |
| 1 | 仕様上あるべき9遷移が期待どおり動く |
| 2 | **残り45組み合わせがすべて拒否される**（状態6×イベント9＝54を全網羅） |
| 3 | `NOT_STARTED` から**全状態に到達できる**（幅優先探索） |

3が効く。到達できない状態が定義に残っていると、**仕様と実装がずれている兆候**になる。

### ONE_TIME の扱い

`outcomeOf("ONE_TIME")` は `revisesAgreement: false` を返す。**これが C3 の核心**であり、
ここが `true` になると一時的な融通のたびに法的文書の基準が書き換わる。

テストで `ONE_TIME` の4つの帰結すべてを個別に検証している。

### seed の投入先

マスタは `masters/{種別}/items/{id}` というサブコレクション構成にした。
`masters` 直下をコレクションにすると、種別ごとの一覧取得ができないため。
