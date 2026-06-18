# Node.js + Chromium 사전 탑재 공식 이미지
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Railway는 repo 루트를 빌드 컨텍스트로 사용 → worker/ 경로로 참조
COPY worker/package*.json ./
RUN npm ci

COPY worker/tsconfig.json ./
COPY worker/src ./src
COPY worker/ui_dictionary.yaml ./

RUN npm run build

ENV PORT=8001
ENV HEADLESS=true
ENV NODE_ENV=production

EXPOSE 8001
CMD ["node", "dist/main.js"]
