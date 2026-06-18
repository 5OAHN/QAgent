# Node.js + Chromium 사전 탑재 공식 이미지
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY worker/package*.json ./
RUN npm ci

COPY worker/tsconfig.json ./
COPY worker/src ./src
COPY worker/ui_dictionary.yaml ./

RUN npm run build

ENV HEADLESS=true
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "dist/main.js"]
