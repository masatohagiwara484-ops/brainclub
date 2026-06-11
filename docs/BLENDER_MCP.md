# Blender MCP 連携パイプライン（将来の3Dアセット制作用）

> 現状のチェス駒/盤デザインは `src/games/chess/chessArt.ts` のベクターアート
> （Path2D）です。Blender製の本格3Dアセットに差し替えたくなったら、この手順で
> ローカルPCのBlenderとClaudeを接続して制作 → 本リポジトリに取り込みます。
> **Blender MCPはローカルのBlenderを操作する仕組みのため、クラウド実行環境
> （Claude Code on the web）からは使えません。デスクトップ版Claude/Claude Code
> CLIをあなたのPCで起動して使います。**

## 1. セットアップ（ローカルPC）
1. Blender 4.x をインストール。
2. Blender MCP アドオンを導入（例: `ahujasid/blender-mcp`）:
   - リポジトリの `addon.py` を Blender の Add-ons にインストールして有効化。
   - Blender内でMCPサーバーを起動（サイドバー → BlenderMCP → Connect）。
3. Claude側にMCPサーバーを登録（`claude mcp add` または `claude_desktop_config.json`）:
   ```json
   { "mcpServers": { "blender": { "command": "uvx", "args": ["blender-mcp"] } } }
   ```
4. 新しいClaudeセッションで「チェス駒セットをモデリングして」と指示すると、
   Claudeがシーン作成・モデリング・マテリアル・ライティングを直接操作できます。

## 2. 制作ガイドライン（このアプリ用）
- **駒**: 6種（P/N/B/R/Q/K）×1セット。ローポリ（各〜2k tris）、原点=底面中心、
  高さ比はポーン1.0に対してキング1.8程度。色はマテリアル1枚（バーテックスカラー
  またはベースカラーのみ）にして、アプリ側でテーマ色を差し込めるようにする。
- **盤**: 1ユニット=1マス。装飾（サイバーパンクの回路など）はエミッシブ
  テクスチャ1枚（1024px）に焼き込み。
- **エクスポート**: glTF (.glb / Draco圧縮ON) → `public/models/chess/<theme>.glb`。

## 3. アプリへの取り込み
- 3D盤ビューを作る場合: R3F(`@react-three/fiber`)+`useGLTF`(drei)でロードし、
  `ChessGame` に「2D/3D表示切替」を追加（2D canvasは現行のまま残す）。
- 2Dのまま品質を上げる場合: Blenderで駒を**正面斜め45°からレンダリング**した
  PNGスプライトシートを書き出し、`chessArt.drawPiece` をスプライト描画に差替え。
- どちらの場合も配色テーマは `lib/gameSkins.ts` の `BoardTheme` を正とし、
  シェーダー/タイントで適用する（テーマごとにモデルを作らない）。

## 4. 検証
- `npm run build` が通ること（glbは`public/`なのでバンドル影響なし）。
- 駒のドラッグ/タップ判定はロジック側（セル座標）なので3D化しても変更不要。
