# 실시간 대결 서버 (Fly.io 등 Docker 로 올리는 곳에서 써요)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js config.json ./
COPY public ./public
EXPOSE 8080
CMD ["node", "server.js"]
