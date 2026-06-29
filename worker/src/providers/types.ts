import { Page } from "playwright";

export interface VisionStep {
  stepNum: number;
  thought: string;
  action: string;
  details: string;
}

export interface VisionResult {
  success: boolean;
  steps: VisionStep[];
  failReason?: string;
  summary?: string;
  verificationStatus?: "approved" | "pending";
  reviewReason?: string;
  totalTokens?: number;
}

export interface RunControl {
  isCancelled: () => boolean;
  isPaused: () => boolean;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface VisionProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  runAgent(
    page: Page,
    task: string,
    maxSteps: number,
    onStep?: (step: VisionStep) => void,
    control?: RunControl
  ): Promise<VisionResult>;
  getLastUsage(): ProviderUsage | null;
}

export interface ProviderConfig {
  type: "claude" | "gemini";
  priority: number;
  apiKey: string;
  enabled?: boolean;
}
