# Node.js + Chromium 사전 탑재 공식 이미지 — 빌드 시 브라우저 다운로드 없음
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# 의존성 레이어 분리 (package.json 변경 시에만 재설치)
COPY package*.json ./
RUN npm ci

# TypeScript 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ui_dictionary는 런타임에 필요
COPY ui_dictionary.yaml ./

ENV PORT=8001
ENV HEADLESS=true
ENV NODE_ENV=production

EXPOSE 8001
CMD ["node", "dist/main.js"]
