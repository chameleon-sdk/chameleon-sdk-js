import assert from "node:assert/strict";
import test from "node:test";

import { ChameleonSdkError, createChameleonClient } from "../src/index.js";

test("connect opens Hosted Connect through Chameleon private frontend gateway", async () => {
  const requests = [];
  let openedUrl = "";
  const client = createChameleonClient({
    publishableKey: "pk_test_public",
    getSessionToken: async () => "session-proof",
    apiBaseUrl: "https://api.chameleon.test",
    navigate: (url) => {
      openedUrl = url;
    },
    fetch: async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({
        id: "cs_123",
        attemptId: "attempt_123",
        connectionId: "conn_123",
        connectUrl: "https://connect.chameleon.test/connect/amazon?connect_session=temporary",
        expiresAt: "2026-09-04T12:10:00.000Z",
        state: "awaiting_authorization",
        nextAction: "redirect",
      }, { status: 201 });
    },
  });

  const session = await client.connect({
    provider: "amazon",
    organizationId: "org_123",
    returnUrl: "https://app.example.com/integrations",
  });

  assert.equal(openedUrl, session.connectUrl);
  assert.equal(requests[0].url, "https://api.chameleon.test/v1/frontend/connect_sessions");
  assert.equal(requests[0].headers.get("authorization"), "Bearer pk_test_public");
  assert.equal(requests[0].headers.get("x-chameleon-session"), "session-proof");
  assert.equal((await requests[0].text()).includes("secretKey"), false);
});

test("SDK returns structured gateway errors and never navigates on failure", async () => {
  let navigated = false;
  const client = createChameleonClient({
    publishableKey: "pk_test_public",
    getSessionToken: () => "session-proof",
    navigate: () => {
      navigated = true;
    },
    fetch: async () => Response.json({ code: "AMAZON_AUTHORIZATION_DENIED", message: "Workspace access is denied." }, { status: 403 }),
  });

  await assert.rejects(
    () => client.connect({ provider: "amazon", organizationId: "org_123", returnUrl: "https://app.example.com/integrations" }),
    (error) => error instanceof ChameleonSdkError && error.status === 403 && error.code === "AMAZON_AUTHORIZATION_DENIED",
  );
  assert.equal(navigated, false);
});

test("SDK can parse only safe values from the return URL", () => {
  const client = createChameleonClient({
    publishableKey: "pk_test_public",
    getSessionToken: () => "session-proof",
    navigate: () => {},
    fetch: async () => Response.json({}),
  });
  assert.deepEqual(
    client.getConnectResult("https://app.example.com/integrations?connection_id=conn_123&connection_status=connected&attempt_id=attempt_123"),
    { connectionId: "conn_123", connectionStatus: "connected", attemptId: "attempt_123" },
  );
});

test("SDK rejects Secret Key configuration", () => {
  assert.throws(
    () => createChameleonClient({ secretKey: "sk_test_secret", publishableKey: "pk_test_public", getSessionToken: () => "session" }),
    /does not accept a Secret Key/,
  );
});
