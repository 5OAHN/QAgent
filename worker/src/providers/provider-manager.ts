import { Page } from "playwright";
import { VisionProvider, VisionResult, VisionStep, RunControl, ProviderConfig } from "./types";
import { ClaudeProvider } from "./claude-provider";
import { GeminiProvider } from "./gemini-provider";

export class ProviderManager {
  private providers: VisionProvider[] = [];
  private configs: ProviderConfig[] = [];
  private currentProviderIndex = 0;

  constructor(configs: ProviderConfig[]) {
    this.configs = configs.sort((a, b) => a.priority - b.priority);
    this.initializeProviders();
  }

  private initializeProviders() {
    for (const config of this.configs) {
      if (!config.enabled) continue;

      let provider: VisionProvider | null = null;

      if (config.type === "claude") {
        provider = new ClaudeProvider(config.apiKey);
      } else if (config.type === "gemini") {
        provider = new GeminiProvider(config.apiKey);
      }

      if (provider) {
        this.providers.push(provider);
      }
    }

    if (this.providers.length === 0) {
      throw new Error("No enabled vision providers configured");
    }
  }

  async runAgent(
    page: Page,
    task: string,
    maxSteps = 20,
    onStep?: (step: VisionStep) => void,
    control?: RunControl
  ): Promise<VisionResult> {
    let lastError: Error | null = null;
    let totalTokens = 0;

    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[this.currentProviderIndex];
      const isAvailable = await provider.isAvailable();

      if (!isAvailable) {
        console.warn(`Provider "${provider.name}" is not available, switching to next provider`);
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
        continue;
      }

      try {
        console.log(`Using provider: ${provider.name}`);
        const result = await provider.runAgent(page, task, maxSteps, onStep, control);

        // 토큰 사용량 누적
        if (result.totalTokens) {
          totalTokens += result.totalTokens;
        }

        // 성공 시 반환
        if (result.success) {
          return { ...result, totalTokens };
        }

        // 실패했지만 폴백 시도
        console.warn(`Provider "${provider.name}" failed: ${result.failReason}`);

        // 크레딧 부족 에러 확인
        if (result.failReason?.includes("insufficient_credits") || result.failReason?.includes("GEMINI_QUOTA_EXCEEDED")) {
          console.log(`Provider "${provider.name}" exhausted, switching to next provider`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          continue;
        }

        // 다른 에러는 폴백 시도
        lastError = new Error(result.failReason);
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
        continue;
      } catch (err: any) {
        console.error(`Provider "${provider.name}" error:`, err.message);

        // 크레딧 부족 에러 확인
        if (err.message?.includes("insufficient_credits") || err.message?.includes("GEMINI_QUOTA_EXCEEDED") || err.message === "GEMINI_QUOTA_EXCEEDED") {
          console.log(`Provider "${provider.name}" exhausted, switching to next provider`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          lastError = err;
          continue;
        }

        // 인증 에러
        if (err.message?.includes("401") || err.message?.includes("403")) {
          console.log(`Provider "${provider.name}" auth failed, switching to next provider`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          lastError = err;
          continue;
        }

        // 기타 에러도 폴백 시도
        lastError = err;
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
        continue;
      }
    }

    // 모든 provider 실패
    return {
      success: false,
      steps: [],
      failReason: `All providers failed. Last error: ${lastError?.message || "Unknown error"}`,
      totalTokens,
    };
  }

  getLastUsage() {
    if (this.providers.length === 0) return null;
    return this.providers[this.currentProviderIndex].getLastUsage();
  }

  getCurrentProviderName(): string {
    if (this.providers.length === 0) return "none";
    return this.providers[this.currentProviderIndex].name;
  }
}
