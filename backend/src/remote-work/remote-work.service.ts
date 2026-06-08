import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lastValueFrom } from "rxjs";

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

type HFZeroShotResponse = {
  labels?: string[];
  scores?: number[];
};

@Injectable()
export class RemoteWorkService {
  private readonly logger = new Logger(RemoteWorkService.name);
  private readonly cache = new Map<string, CacheEntry>();

  private readonly remoteKeywords = [
    "remote",
    "remoto",
    "teletrabalho",
    "teletravail",
    "hybrid",
    "hybride",
    "hybrido",
    "a distance",
    "distance",
    "work from home",
    "home office",
    "wfh",
    "full remote",
    "fully remote",
    "100 remote",
    "100% remote",
    "remote friendly",
  ];

  private readonly contextKeywords = [
    "onsite",
    "on-site",
    "office",
    "bureau",
    "presentiel",
    "presencial",
    "sur site",
    "in office",
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async detectRemoteWorkFromParts(
    title?: string | null,
    description?: string | null,
    location?: string | null,
  ): Promise<boolean> {
    const content = this.normalizeText(
      `${title || ""} ${description || ""} ${location || ""}`,
    );
    return this.detectRemoteWork(content);
  }

  async detectRemoteWork(content: string): Promise<boolean> {
    const normalized = this.normalizeText(content);
    if (!normalized) return false;

    if (this.remoteKeywords.some((term) => normalized.includes(term))) {
      return true;
    }

    if (!this.contextKeywords.some((term) => normalized.includes(term))) {
      return false;
    }

    const aiResult = await this.detectRemoteWorkAI(normalized);
    return aiResult ?? false;
  }

  async detectRemoteWorkAI(content: string): Promise<boolean | null> {
    const apiKey = this.configService.get<string>("HF_API_KEY");
    if (!apiKey) return null;

    const normalized = this.normalizeText(content);
    if (!normalized) return null;

    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const model =
      this.configService.get<string>("HF_MODEL") ||
      "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli";
    const threshold =
      Number(this.configService.get<string>("HF_REMOTE_THRESHOLD")) || 0.6;
    const cacheTtlMs =
      (Number(this.configService.get<string>("HF_REMOTE_CACHE_TTL_SECONDS")) ||
        60 * 60 * 24) * 1000;
    const requestTimeoutMs =
      Number(this.configService.get<string>("HF_REQUEST_TIMEOUT_MS")) || 5000;

    try {
      const response = await lastValueFrom(
        this.httpService.post<HFZeroShotResponse>(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            inputs: normalized,
            parameters: {
              candidate_labels: ["remote work", "hybrid work", "onsite work"],
              multi_label: false,
            },
          },
          {
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
            },
            timeout: requestTimeoutMs,
          },
        ),
      );

      const labels =
        response.data?.labels?.map((item) => item.toLowerCase()) || [];
      const scores = response.data?.scores || [];

      const remoteScore = labels.reduce((acc, label, index) => {
        if (label.includes("remote") || label.includes("hybrid")) {
          return Math.max(acc, scores[index] || 0);
        }
        return acc;
      }, 0);

      const isRemote = remoteScore >= threshold;
      this.cache.set(normalized, {
        value: isRemote,
        expiresAt: Date.now() + cacheTtlMs,
      });
      return isRemote;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.logger.warn(`Hugging Face fallback indisponível: ${message}`);
      return null;
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
