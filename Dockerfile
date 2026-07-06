# FoundRuu CLI をコンテナで実行するためのイメージ。
# ローカルに Node.js を用意せず `foundruu` を CI などで動かすのに使えます。
#
#   docker build -t foundruu .
#   docker run --rm -v "$PWD:/work" -w /work foundruu doctor
#
FROM node:22-slim

WORKDIR /app

# 依存関係のインストール（レイヤーキャッシュのため先に manifest だけコピー）
COPY package.json package-lock.json ./
RUN npm ci

# ソースをコピーしてビルド
COPY . .
RUN npm run build

# グローバルコマンド `foundruu` として利用可能にする
RUN npm link

# 診断対象リポジトリをマウントする作業ディレクトリ
WORKDIR /work

ENTRYPOINT ["foundruu"]
CMD ["--help"]
