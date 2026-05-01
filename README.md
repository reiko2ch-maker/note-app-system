# Note Forge X Pro v4

DB不要・環境変数不要・GitHub Pagesで動く静的Webアプリです。

## 特徴

- Gemini APIキーは sessionStorage のみ保持
- 履歴は localStorage に保存
- 8桁コードごとに履歴を分離
- スマホ向け4ステップUI
- リサーチ / 構成 / 導入CTA / 本文生成
- Claude / GPT-5.4 向け外部生成プロンプト出力
- 自動再試行、タイムアウト、途中切れ補完
- Markdown / HTML出力

## GitHub Pages 公開手順

1. このZIPを解凍
2. 中身をGitHubリポジトリのルートへアップロード
3. `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `.nojekyll` がルートにあることを確認
4. GitHubの Settings → Pages
5. Branch を `main` / root に設定
6. 数分待って公開URLを開く

## 初回利用

1. 8桁コードを入力
2. Gemini APIキーを入力
3. 記事設計を入力
4. リサーチ、構成、導入CTA、本文の順に生成

## 安定運用の推奨設定

- 安定優先：ON
- 自動再試行：ON
- Web参照：OFF
- モデル：gemini-2.5-flash

Geminiが混雑する場合は、Claude用プロンプトまたはGPT-5.4用プロンプトを出力し、外部AIで本文生成してください。

## 注意

- 8桁コードは本格ログイン認証ではありません。
- 履歴はブラウザ内保存です。端末変更・ブラウザ変更・サイトデータ削除で消えます。
- APIキーは永続保存しません。
- Gemini側の503混雑は完全には防げません。
- 超長文は章ごと生成または外部AIプロンプト利用を推奨します。
