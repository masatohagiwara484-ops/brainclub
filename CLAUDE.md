# CLAUDE.md — BrainClub プロジェクト引き継ぎ

> このファイルは新しいセッションのClaudeが**最初に読む**ための引き継ぎ資料です。
> プロジェクトの全体像・決定事項・現状・次の一手をここに集約しています。

## 🎯 プロジェクトの本質
**BrainClub** = 世界の脳トレ・知育ゲームを統合したWebプラットフォーム。
コンセプトは『世界のアソビ大全51（Clubhouse Games）』×『NYT Games』のWeb版。
**英語圏ファースト**（北米が脳トレ市場の36.4%）。インストール不要・ログイン不要。

戦略の背骨: 単なるゲーム詰め合わせ✗ → **「毎日の習慣（デイリー・リチュアル）」**を作る（NYT/Wordleモデル）。
長期目標: chess.com級。短期方針: **1本ずつ完璧に**仕上げて回す（30本同時開発は禁物）。

> 詳細な事業構想書（市場規模・収益化・バイラル戦略・30ゲームのポートフォリオ）は
> ユーザーが別途docxで保有。必要なら再共有を依頼すること。

## 🛠 技術スタック（確定）
- **React + Vite + TypeScript + Tailwind CSS**
- ゲームは `<canvas>` 描画（キューブはThree.js）
- PWA対応（インストール可・オフライン）
- バックエンドなし（現状は全てクライアントサイド＝静的デプロイ）
- デプロイ先: **Vercel**

## 📐 アーキテクチャ
```
src/
  games/registry.ts      ゲームカタログ（cube/sudoku/solitaire/watersort/gomoku/wordle が稼働、他はavailable:falseで"Coming soon"）
  games/cube/            cubeEngine.ts（Three.js本体＋バグ修正）＋ CubeGame.tsx（React UI）
  games/wordle/          wordGuess.ts（単語リスト/採点ロジック）＋ WordleGame.tsx（Word Guess本体・難易度＝文字数4〜7・デイリー＋練習）
  components/            Layout（全画面共通の枠＝ユニバーサルレイアウト）, GameCard
  pages/                 Home（ハブのゲームグリッド）, GamePage
  lib/                   haptics（振動）, storage（ベスト記録/ストリーク）, daily（日替わりseed）, share（Wordle型シェア）
  i18n/                  en.json（デフォルト）, ja.json
scripts/verify-cube.mjs    キューブ崩壊バグの自動検証（node scripts/verify-cube.mjs）
scripts/verify-wordle.mjs  Word Guessの単語リスト＆採点ロジック検証（node scripts/verify-wordle.mjs）
```

## ✅ 決定事項（ユーザーとの合意）
1. 技術土台: React+Vite+TS+Tailwind
2. ブランド名: **作業名「BrainClub」**（未確定。候補: MindArcade / Cortex Club / Puzzlr / Clevora）
   - 変更箇所: `index.html`, `vite.config.ts`(PWA manifest), `src/i18n/*.json`
3. 発信: build in public を英語中心で（X / Substack）。初日コンテンツは `CONTENT_buildinpublic.md`
4. リポジトリ: 新規 `masatohagiwara484-ops/brainclub`（rubuk_cube_game_play とは別物）

## 🐛 解決済みのキューブのバグ（重要・再発注意）
旧版（単一HTML）で 2×2/4×4 が必ず、5×5が時々崩れていた。原因と修正:
1. **位置スナップ**: `Math.round(pos/STEP)*STEP` は偶数キューブで破綻（半ステップ位置 + JSの`Math.round(-0.5)===0`）。
   → 修正: `idx = round(pos/STEP + offset); pos = (idx-offset)*STEP`（offset=(N-1)/2）
2. **向きスナップ**: Euler角の軸別独立丸めは複合3D回転で不正 → 5×5が時々崩れた。
   → 修正: 回転行列の各基底ベクトルを最寄り軸にスナップ→再正規直交化（`cubeEngine.ts` の `snapRotation`）。
`node scripts/verify-cube.mjs` で全サイズPASSを確認済み（旧ロジックは同テストでFAIL）。

## 📳 スマホ振動（ハプティクス）
`lib/haptics.ts`。回転時tick / 完成時パターン。
✅ Android作動 / ❌ iOS Safariは`navigator.vibrate`非対応で無音（エラーなし・仕様）。

## 🗺 ロードマップ（0.1→1→10→100）
- **0.1→1（〜2週間）**: 安定・公開・計測・シェアできる土台。キューブ修正済み✅／Vercelデプロイ／PWA／計測／X・Substack開始。← **今ここ**
- **1→10（〜2-3ヶ月）**: デイリー習慣＋必須ゲーム追加（軽い順: 五目→ナンプレ→ソリティア→色水ソート→単語当て）＋ストリーク/実績＋リワード広告/広告除去/コスメ＋全ゲームにシェアグリッド。初収益。
- **10→100（〜12ヶ月+）**: サブスク($9.99〜)＋コスメ拡充＋A/B＋オンライン対戦(要バックエンド)＋本格多言語＋B2B(EdTech/企業ウェルネス)＋IP提携。月$1,500+。

## ▶️ 次の一手（候補）
1. **Vercelデプロイ**で公開URLを作る（最優先）
2. デイリー・チャレンジ＋シェアの作り込み
3. **ナンプレ実装**（必須カテゴリ・自動生成・低アセット）＝2本目のゲーム
4. ブランド名の確定（ドメイン/商標チェック後）

## 🚀 起動・デプロイ
```bash
npm install && npm run dev          # ローカル（http://localhost:5173）
npm run dev -- --host               # スマホから（同一Wi-Fi）
npm run build && npm run preview     # 本番ビルド確認
node scripts/verify-cube.mjs         # キューブ安定性テスト
```
Vercel: GitHubリポをimport → Framework「Vite」自動検出 → Deploy。
```
```
