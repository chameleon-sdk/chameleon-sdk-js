export interface ChameleonClientOptions {
  publishableKey: string;
  getSessionToken: () => string | Promise<string>;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  navigate?: (url: string) => void;
}

export interface ConnectMarketplaceInput {
  provider: "amazon";
  organizationId: string;
  returnUrl: string;
}

export interface ConnectSession {
  id: string;
  attemptId: string;
  connectionId: string;
  connectUrl: string;
  expiresAt: string;
  state: string;
  nextAction: string;
}

export interface ConnectionResult {
  connectionId: string | null;
  connectionStatus: string | null;
  attemptId: string | null;
}

export class ChameleonSdkError extends Error {
  status: number;
  code: string;
  requestId?: string;
}

export class ChameleonClient {
  constructor(options: ChameleonClientOptions);
  connect(input: ConnectMarketplaceInput): Promise<ConnectSession>;
  createConnectSession(input: ConnectMarketplaceInput): Promise<ConnectSession>;
  getConnection(connectionId: string): Promise<Record<string, unknown>>;
  getAttempt(attemptId: string): Promise<Record<string, unknown>>;
  selectResources(connectionId: string, resourceIds: string[]): Promise<Record<string, unknown>>;
  reconnect(connectionId: string): Promise<ConnectSession>;
  disconnect(connectionId: string): Promise<Record<string, unknown>>;
  cancelAttempt(attemptId: string): Promise<Record<string, unknown>>;
  getConnectResult(url?: string): ConnectionResult;
}

export function createChameleonClient(options: ChameleonClientOptions): ChameleonClient;
