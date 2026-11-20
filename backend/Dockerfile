FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY ai ./ai
COPY gateway ./gateway
RUN mkdir -p logs
EXPOSE 3000
CMD ["node", "src/server.js"]
