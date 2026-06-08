import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of } from "rxjs";
import { RemoteWorkService } from "./remote-work.service";

describe("RemoteWorkService", () => {
  const createService = (
    hfApiKey: string | undefined = undefined,
    postImpl?: jest.Mock,
  ) => {
    const httpService = {
      post: postImpl || jest.fn(),
    } as unknown as HttpService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "HF_API_KEY") return hfApiKey;
        if (key === "HF_REMOTE_THRESHOLD") return "0.6";
        if (key === "HF_REMOTE_CACHE_TTL_SECONDS") return "3600";
        return undefined;
      }),
    } as unknown as ConfigService;

    return new RemoteWorkService(httpService, configService);
  };

  it("detects french remote keyword without AI", async () => {
    const service = createService();
    await expect(
      service.detectRemoteWorkFromParts(
        "Développeur Full Stack",
        "Poste en télétravail 3 jours par semaine",
        "Paris, France",
      ),
    ).resolves.toBe(true);
  });

  it("uses AI fallback for ambiguous text and caches the result", async () => {
    const post = jest.fn(() =>
      of({
        data: {
          labels: ["onsite work", "hybrid work", "remote work"],
          scores: [0.1, 0.62, 0.28],
        },
      }),
    );
    const service = createService("hf_test_key", post);

    const content = "Role is mainly office based with flexible arrangement";
    await expect(service.detectRemoteWork(content)).resolves.toBe(true);
    await expect(service.detectRemoteWork(content)).resolves.toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
