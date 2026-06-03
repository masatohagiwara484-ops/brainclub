# BrainClub — プロジェクト全体サマリー

> Gemini等への引き継ぎ用。プロジェクトの本質・技術スタック・アーキテクチャ・実装済みゲーム・設計判断を網羅。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|---|---|
| **プロダクト名** | BrainClub（作業名。確定前） |
| **コンセプト** | 世界の脳トレ・知育ゲームを統合したWebプラットフォーム |
| **参照モデル** | 「Clubhouse Games（世界のアソビ大全51）」× 「NYT Games / Wordle」のWeb版 |
| **ターゲット** | 英語圏ファースト（北米が脳トレ市場の36.4%） |
| **特徴** | インストール不要・ログイン不要・無料・PWA対応 |
| **戦略の骨格** | 「毎日の習慣（デイリー・リチュアル）」を作る — 長期目標はchess.com級 |
| **リポジトリ** | `masatohagiwara484-ops/brainclub` |
| **デプロイ先** | Vercel |

### ブランド候補（未確定）
MindArcade / Cortex Club / Puzzlr / Clevora / BrainClub

変更が必要な箇所: `index.html`, `vite.config.ts`（PWA manifest）, `src/i18n/*.json`

---

## 2. 技術スタック

### フロントエンド

| カテゴリ | 技術・バージョン |
|---|---|
| UIフレームワーク | React 18 |
| ビルドツール | Vite |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS v3 |
| 3D描画 | Three.js（Rubik's Cubeのみ） |
| 2D描画 | `<canvas>`（その他ゲーム） |
| ルーティング | React Router DOM |
| 多言語対応 | i18next（英語 `en.json` / 日本語 `ja.json`） |
| PWA | vite-plugin-pwa（Service Worker・オフライン対応・インストール可） |
| バックエンド | **なし**（全クライアントサイド・静的デプロイ） |
| ストレージ | `localStorage`（ゲーム記録・ストリーク・設定） |

### Tailwind カスタムトークン

```js
colors: {
  ink:       '#0f172a', // メインテキスト
  panel:     '#ffffff', // カード・モーダル背景
  brand:     '#2563eb', // メインブルー（ボタン・ボーダー）
  brandDark: '#1d4ed8',
  accent:    '#16a34a', // 成功・ストリーク緑
}
```

### フォント
- `DotGothic16`（ドット調・サイバー見出し）— `.font-dot`, `.font-cyber`
- システムフォント fallback

---

## 3. ディレクトリ構成

```
brainclub/
├── src/
│   ├── App.tsx                     BrowserRouter + Routes
│   ├── main.tsx                    エントリーポイント
│   ├── styles/index.css            グローバルCSS（アニメ含む）
│   ├── games/
│   │   ├── registry.ts             ゲームカタログ（全ゲームの定義・フラグ管理）
│   │   ├── types.ts                GameProps型（difficulty?: Difficulty）
│   │   ├── cube/
│   │   │   ├── cubeEngine.ts       Three.js本体＋バグ修正済みスナップロジック
│   │   │   └── CubeGame.tsx        Rubik's Cube React UI
│   │   ├── sudoku/
│   │   │   ├── sudokuGen.ts        パズル自動生成（難易度別・解唯一保証）
│   │   │   └── SudokuGame.tsx      数独 React UI
│   │   ├── solitaire/
│   │   │   ├── klondike.ts         クロンダイク ゲームロジック
│   │   │   └── SolitaireGame.tsx   ソリティア React UI
│   │   ├── watersort/
│   │   │   ├── waterSort.ts        水色ソート ゲームロジック
│   │   │   └── WaterSortGame.tsx   水色ソート React UI
│   │   ├── gomoku/
│   │   │   ├── gomokuAI.ts         五目並べ AIロジック
│   │   │   └── GomokuGame.tsx      五目並べ React UI
│   │   └── wordle/
│   │       ├── wordGuess.ts        単語リスト・採点・難易度設定
│   │       └── WordleGame.tsx      Word Guess React UI
│   ├── components/
│   │   ├── Layout.tsx              全画面共通レイアウト（ヘッダー・ナビ）
│   │   ├── GameCard.tsx            ホーム画面のゲームカード
│   │   ├── DifficultyScreen.tsx    難易度選択画面（EASY〜EXPERT）
│   │   └── GameArt.tsx             各ゲームのインラインSVGアイコン
│   ├── pages/
│   │   ├── Home.tsx                ゲームグリッド（ハブ）
│   │   └── GamePage.tsx            ゲーム起動・難易度ルーティング
│   ├── lib/
│   │   ├── difficulty.ts           Difficulty型・4段階スタイル定義
│   │   ├── daily.ts                デイリーseed（dayNumber・dailySeed・makeRng）
│   │   ├── haptics.ts              振動フィードバック（Android対応・iOS非対応）
│   │   ├── share.ts                Web Share API / クリップボード fallback
│   │   └── storage.ts              localStorage wrapper（ベスト記録・ストリーク）
│   └── i18n/
│       ├── index.ts                i18next初期化
│       ├── en.json                 英語（デフォルト）
│       └── ja.json                 日本語
├── scripts/
│   ├── verify-cube.mjs             キューブスナップロジック自動検証
│   └── verify-wordle.mjs           Word Guess単語リスト＆採点検証
├── public/                         静的アセット（アイコン等）
├── index.html
├── vite.config.ts                  Vite + PWA設定
├── tailwind.config.js
├── tsconfig.json
└── vercel.json                     SPA用リライト設定
```

---

## 4. ゲームカタログ（registry.ts）

| ID | 表示名 | 難易度 | 状態 | 備考 |
|---|---|---|---|---|
| `cube` | Rubik's Cube 3D | なし（サイズ選択） | ✅ 稼働 | 2×2〜5×5、Three.js |
| `sudoku` | Sudoku | 4段階 | ✅ 稼働 | 無限自動生成 |
| `solitaire` | Solitaire | 4段階 | ✅ 稼働 | Klondike |
| `watersort` | Water Sort | 4段階 | ✅ 稼働 | 色水ソート |
| `gomoku` | Gomoku | 4段階 | ✅ 稼働 | AI対戦 |
| `wordle` | Word Guess | 4段階 | ✅ 稼働 | Wordle互換・デイリー＋練習 |
| `chess` | Chess | — | ❌ Coming soon | — |
| `memory` | Memory Match | — | ❌ Coming soon | — |

### ルーティング構造
```
/                       → Home（ゲームグリッド）
/play/:id               → GamePage（hasDifficulty=trueなら難易度選択画面へ）
/play/:id/:difficulty   → ゲーム本体（difficulty = easy|medium|hard|expert）
```

---

## 5. 共通設計パターン

### 難易度システム（`lib/difficulty.ts`）
```ts
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
// easy=★1緑 / medium=★2黄 / hard=★3青 / expert=★4赤
```
全ての難易度対応ゲームが `GameProps = { difficulty?: Difficulty }` を受け取る。

### デイリーシステム（`lib/daily.ts`）
```ts
dayNumber()              // UTC日番号（エポックからの日数）
dailySeed(gameId)        // (gameId + 日番号) のハッシュ → シード整数
makeRng(seed)            // Mulberry32 PRNG → () => [0,1)
```
デイリー難易度ごとに `dailySeed('wordle-medium')` などで全プレイヤー共通出題。

### ストレージ（`lib/storage.ts`）
```ts
getBest(gameId, variant) / saveBest(...)   // ゲームごとのベスト記録
getStreak() / bumpStreak()                 // デイリーストリーク
getSetting(key, fallback) / setSetting()   // 汎用設定
```
キーは全て `bc.` プレフィックス。

### シェア（`lib/share.ts`）
Web Share API → クリップボード fallback の順で試行。

### ハプティクス（`lib/haptics.ts`）
```ts
haptics.tick()      // 軽いタップ（入力時）
haptics.bump()      // 少し強め（スナップ・エラー）
haptics.success()   // 完成パターン [24,40,24,40,60]ms
```
`navigator.vibrate` が存在しない環境（iOS Safari）では無音・エラーなし。

---

## 6. Word Guess 詳細設計

### 難易度＝文字数
| Difficulty | 文字数 | 試行回数 |
|---|---|---|
| EASY | 4文字 | 6回 |
| MEDIUM | 5文字（王道Wordle） | 6回 |
| HARD | 6文字 | 7回 |
| EXPERT | 7文字 | 7回 |

### モード
- **Daily（デイリー）**: 難易度ごとに `dailySeed('wordle-{difficulty}')` で全員共通のお題。1日1回。進捗をlocalStorageに保存し、再読込でも復元。
- **Practice（練習）**: ランダム出題。何度でもプレイ可能。

### 採点ロジック（Wordle互換）
```
1. Pass 1: 完全一致（緑）から先に処理 → 文字カウントを消費
2. Pass 2: 残りのカウントで「含むが位置違い」（黄）を割り当て
→ 重複文字も正しく処理（Wordle公式と同じ）
```

### 単語プール
| 文字数 | 語数 | 説明 |
|---|---|---|
| 4文字 | 598語 | 基礎英単語 |
| 5文字 | 579語 | Wordle相当の一般語 |
| 6文字 | 561語 | やや高度な一般語 |
| 7文字 | 463語 | 上級語 |

モジュール読み込み時に `sanitize()` でフィルタ（小文字・a–z のみ・正確な文字数・重複除去）。誤ったトークンが混入しても安全に除去される。

### UIの特徴
- オンスクリーンキーボード（既知ヒントで色が変化）
- 物理キーボード対応（Enter / Backspace / a-z）
- アニメーション: タイプ時ポップ・提出時フリップ・不正入力でシェイク・クリア時バウンス
- 絵文字シェアグリッド（🟩🟨⬛）ネタバレなし
- デイリーのみ: 統計（プレイ数・勝率・連勝・最高連勝・正解回数分布）

---

## 7. 解決済みバグ（Rubik's Cube）

旧実装で 2×2/4×4 が必ず、5×5 が時々崩れていた問題を修正済み。

| バグ | 原因 | 修正 |
|---|---|---|
| 偶数キューブ崩壊 | `Math.round(pos/STEP)*STEP` が半ステップ位置で破綻 | `idx = round(pos/STEP + offset); pos = (idx-offset)*STEP` |
| 5×5 不定崩壊 | Euler角の軸別独立丸めが複合3D回転で不正 | 回転行列の基底ベクトルを最寄り軸にスナップ後、再正規直交化（`snapRotation`） |

検証: `node scripts/verify-cube.mjs` で全サイズPASS確認済み。

---

## 8. 開発コマンド

```bash
# ローカル起動
npm install && npm run dev

# スマホから（同一Wi-Fi）
npm run dev -- --host

# 本番ビルド確認
npm run build && npm run preview

# 自動検証
node scripts/verify-cube.mjs
node scripts/verify-wordle.mjs
```

### Vercelデプロイ
GitHubリポをimport → Framework「Vite」自動検出 → Deploy。
`vercel.json` にSPA用リライト設定済み。

---

## 9. ロードマップ

### 0.1→1（〜2週間・今ここ）
安定・公開・計測・シェアできる土台の確立
- [x] キューブバグ修正
- [x] Sudoku実装
- [x] Solitaire実装
- [x] Water Sort実装
- [x] Gomoku実装
- [x] Word Guess実装
- [ ] Vercelデプロイ（公開URL作成）
- [ ] 計測（GA等）
- [ ] X / Substack 発信開始

### 1→10（〜2-3ヶ月）
- デイリー習慣の強化
- ストリーク・実績システム
- リワード広告・広告除去IAP・コスメ
- 全ゲームにシェアグリッド統一
- 初収益

### 10→100（〜12ヶ月+）
- サブスク（$9.99〜）
- A/Bテスト基盤
- オンライン対戦（バックエンド必要）
- 本格多言語（スペイン語・仏語等）
- B2B（EdTech・企業ウェルネス）
- IP提携
- 月$1,500+

---

## 10. 未解決の設計判断

| 項目 | 現状 | 検討ポイント |
|---|---|---|
| Word Guess 不正語チェック | 文字数が合えば何でも受理 | 大辞書で「辞書にない語はシェイク」にするか |
| Word Guess 言語 | 英語のみ（UIは日英切替） | 日本語版（ひらがな・カタカナ等）を別途設けるか |
| Word Guess ハードモード | 未実装 | 判明ヒントの強制使用ルールを難易度軸に追加するか |
| 色覚アクセシビリティ | 標準緑/黄/灰 | ハイコントラスト（青/橙）トグルを追加するか |
| ブランド名 | BrainClub（仮） | ドメイン・商標チェック後に確定 |
| バックエンド | なし | ランキング・オンライン対戦時に必要 |

---

*最終更新: 2026-06-03*
