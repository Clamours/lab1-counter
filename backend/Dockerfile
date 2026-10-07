FROM node:20.18-alpine3.20

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
# 建表脚本来自仓库根目录的 database/，通过 compose 的 additional_contexts 传入
COPY --from=database init.sql ./database/init.sql

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
