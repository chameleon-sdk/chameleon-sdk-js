import { ChameleonSdkError } from "./errors.js";

const DEFAULT_API_BASE_URL = "https://api.chameleon.dev";

/**
 * Browser-safe Chameleon client. It intentionally accepts a publishable key
 * and Chameleon session proof only; marketplace and application secrets stay
 * in Chameleon-hosted services.
 */
export class ChameleonClient {
  #apiBaseUrl;
  #fetch;
  #getSessionToken;
  #navigate;
  #publishableKey;

  constructor(options) {
    if (!options || typeof options !== "object") {
      throw new Error("Chameleon SDK options are required.");
    }
    if ("secretKey" in options) {
      throw new Error("Chameleon SDK is browser-safe and does not accept a Secret Key.");
    }
    if (typeof options.publishableKey !== "string" || options.publishableKey.trim() === "") {
      throw new Error("A Chameleon Publishable Key is required.");
    }
    if (typeof options.getSessionToken !== "function") {
      throw new Error("getSessionToken must return the current Chameleon session proof.");
    }
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Error("A fetch implementation is required.");
    }

    this.#apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
    this.#fetch = fetchImplementation;
    this.#getSessionToken = options.getSessionToken;
    this.#navigate = options.navigate ?? defaultNavigate;
    this.#publishableKey = options.publishableKey;
  }

  /** One call for a Connect button: creates a connection attempt and opens Hosted Connect. */
  async connect(input) {
    const session = await this.createConnectSession(input);
    this.#navigate(session.connectUrl);
    return session;
  }

  async createConnectSession(input) {
    assertConnectInput(input);
    return this.#request("POST", "/v1/frontend/connect_sessions", input);
  }

  async getConnection(connectionId) {
    return this.#request("GET", `/v1/frontend/connections/${encodeURIComponent(requiredId(connectionId, "connectionId"))}`);
  }

  async getAttempt(attemptId) {
    return this.#request("GET", `/v1/frontend/connection_attempts/${encodeURIComponent(requiredId(attemptId, "attemptId"))}`);
  }

  async selectResources(connectionId, resourceIds) {
    if (!Array.isArray(resourceIds) || resourceIds.length === 0 || resourceIds.some((id) => typeof id !== "string" || id === "")) {
      throw new Error("resourceIds must contain at least one resource ID.");
    }
    return this.#request("POST", `/v1/frontend/connections/${encodeURIComponent(requiredId(connectionId, "connectionId"))}/resources`, {
      resourceIds,
    });
  }

  async reconnect(connectionId) {
    const session = await this.#request(
      "POST",
      `/v1/frontend/connections/${encodeURIComponent(requiredId(connectionId, "connectionId"))}/reconnect`,
    );
    this.#navigate(session.connectUrl);
    return session;
  }

  async disconnect(connectionId) {
    return this.#request("POST", `/v1/frontend/connections/${encodeURIComponent(requiredId(connectionId, "connectionId"))}/disconnect`);
  }

  async cancelAttempt(attemptId) {
    return this.#request("POST", `/v1/frontend/connection_attempts/${encodeURIComponent(requiredId(attemptId, "attemptId"))}/cancel`);
  }

  /** Reads the safe values returned to the customer return URL after Hosted Connect. */
  getConnectResult(url = globalThis.location?.href) {
    if (!url) {
      return { connectionId: null, connectionStatus: null, attemptId: null };
    }
    const params = new URL(url).searchParams;
    return {
      connectionId: params.get("connection_id"),
      connectionStatus: params.get("connection_status"),
      attemptId: params.get("attempt_id"),
    };
  }

  async #request(method, path, body) {
    const sessionToken = await this.#getSessionToken();
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      throw new ChameleonSdkError({
        status: 401,
        code: "CHAMELEON_SESSION_MISSING",
        message: "A signed-in Chameleon session is required.",
      });
    }
    const headers = {
      accept: "application/json",
      authorization: `Bearer ${this.#publishableKey}`,
      "x-chameleon-session": sessionToken,
      "x-chameleon-sdk": "@chameleon/sdk-js/0.1.0",
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      headers["idempotency-key"] = randomIdempotencyKey();
    }
    const response = await this.#fetch(`${this.#apiBaseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const rawBody = await response.text();
    const parsed = parseJson(rawBody);
    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.ok) {
      throw new ChameleonSdkError({
        status: response.status,
        code: typeof parsed?.code === "string" ? parsed.code : "CHAMELEON_API_ERROR",
        message: typeof parsed?.message === "string" ? parsed.message : "Chameleon request failed.",
        requestId,
      });
    }
    if (!parsed) {
      throw new ChameleonSdkError({
        status: response.status,
        code: "CHAMELEON_API_INVALID_RESPONSE",
        message: "Chameleon returned invalid JSON.",
        requestId,
      });
    }
    return parsed;
  }
}

export function createChameleonClient(options) {
  return new ChameleonClient(options);
}

function assertConnectInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Connection options are required.");
  }
  if (input.provider !== "amazon") {
    throw new Error("This SDK build currently supports provider: amazon only.");
  }
  requiredId(input.organizationId, "organizationId");
  if (typeof input.returnUrl !== "string" || input.returnUrl.length === 0) {
    throw new Error("returnUrl is required.");
  }
}

function requiredId(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function randomIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `sdk_${globalThis.crypto.randomUUID()}`;
  }
  return `sdk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultNavigate(url) {
  if (!globalThis.location?.assign) {
    throw new Error("A navigate function is required outside a browser.");
  }
  globalThis.location.assign(url);
}
