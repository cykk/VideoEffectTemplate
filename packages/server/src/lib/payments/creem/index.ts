import { getEnv } from "@markless/shared/src/lib/config/env";

type CreemEnv = "test" | "production";

type CreemCheckoutResponse = {
  id: string;
  status: string;
  checkout_url?: string;
  request_id?: string;
};

type CreemUpgradeResponse = {
  id: string;
  status: string;
  product: Record<string, unknown>;
  current_period_start_date: string;
  current_period_end_date: string;
};

type CreemCancelResponse = {
  id: string;
  status: string;
};

type CreemResumeResponse = {
  id: string;
  status: string;
};

export class CreemClient {
  private config: {
    apiKey: string;
    env: CreemEnv;
  };

  private static normalizeEnv(value?: string): CreemEnv {
    const normalized = (value || "").toLowerCase();

    if (normalized.startsWith("prod")) {
      return "production";
    }

    if (
      normalized === "sandbox" ||
      normalized.startsWith("test") ||
      normalized.startsWith("dev")
    ) {
      return "test";
    }

    return getEnv("NODE_ENV") === "production" ? "production" : "test";
  }

  constructor({
    apiKey,
    env,
  }: {
    apiKey?: string;
    env?: CreemEnv | string;
  }) {
    const resolvedApiKey = apiKey || getEnv("CREEM_API_KEY");

    if (!resolvedApiKey) {
      throw new Error("CREEM_API_KEY is not set");
    }

    this.config = {
      apiKey: resolvedApiKey,
      env: CreemClient.normalizeEnv(env || getEnv("CREEM_ENV")),
    };
  }

  apiKey() {
    return this.config.apiKey;
  }

  env() {
    return this.config.env;
  }

  async createCheckout({
    requestId,
    productId,
    customerEmail,
    successUrl,
    metadata,
  }: {
    requestId?: string;
    productId: string;
    customerEmail: string;
    successUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreemCheckoutResponse> {
    return this.post<CreemCheckoutResponse>("/v1/checkouts", {
      request_id: requestId,
      product_id: productId,
      customer: {
        email: customerEmail,
      },
      success_url: successUrl,
      metadata: metadata || {},
    }, "checkout creation");
  }

  async upgradeSubscription({
    subscriptionId,
    newProductId,
    updateBehavior = "proration-charge-immediately",
  }: {
    subscriptionId: string;
    newProductId: string;
    updateBehavior?: "proration-charge-immediately" | "proration-charge" | "proration-none";
  }): Promise<CreemUpgradeResponse> {
    return this.post<CreemUpgradeResponse>(`/v1/subscriptions/${subscriptionId}/upgrade`, {
      product_id: newProductId,
      update_behavior: updateBehavior,
    }, "subscription upgrade");
  }

  async cancelSubscription({
    subscriptionId,
    immediate = false,
  }: {
    subscriptionId: string;
    immediate?: boolean;
  }): Promise<CreemCancelResponse> {
    return this.post<CreemCancelResponse>(`/v1/subscriptions/${subscriptionId}/cancel`, {
      mode: immediate ? "immediate" : "scheduled",
    }, "subscription cancel");
  }

  async resumeSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<CreemResumeResponse> {
    return this.post<CreemResumeResponse>(
      `/v1/subscriptions/${subscriptionId}/resume`,
      {},
      "subscription resume"
    );
  }

  private getBaseUrl() {
    return this.config.env === "production"
      ? "https://api.creem.io"
      : "https://test-api.creem.io";
  }

  private async post<TResponse>(
    path: string,
    payload: Record<string, unknown>,
    action: string,
  ): Promise<TResponse> {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Creem ${action} failed: ${response.status} ${await this.readError(response)}`);
    }

    return (await response.json()) as TResponse;
  }

  private async readError(response: Response) {
    const text = await response.text();

    if (!text) {
      return "Unknown error";
    }

    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      return payload.message || payload.error || text;
    } catch {
      return text;
    }
  }
}

export function newCreemClient({
  apiKey,
  env,
}: {
  apiKey?: string;
  env?: CreemEnv;
} = {}) {
  return new CreemClient({ apiKey, env });
}
