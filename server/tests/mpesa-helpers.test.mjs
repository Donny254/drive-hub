// Run: node --test tests/
// Covers the pure M-Pesa helpers — phone normalization and callback parsing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL ||= "postgres://localhost:5432/drivehub_test";
const { normalizePhone, parseCallbackItems, parseC2bConfirmation, parsePullRows } = await import(
  "../src/routes/payments.js"
);

test("normalizePhone handles all Kenyan formats incl. new 01x numbers", () => {
  assert.equal(normalizePhone("0712345678"), "254712345678");
  assert.equal(normalizePhone("+254 712 345 678"), "254712345678");
  assert.equal(normalizePhone("712345678"), "254712345678");
  assert.equal(normalizePhone("254712345678"), "254712345678");
  assert.equal(normalizePhone("0110123456"), "254110123456"); // new 01x range
  assert.equal(normalizePhone(""), "");
});

test("parseCallbackItems flattens STK CallbackMetadata.Item", () => {
  const parsed = parseCallbackItems({
    CallbackMetadata: {
      Item: [
        { Name: "Amount", Value: 1.0 },
        { Name: "MpesaReceiptNumber", Value: "TGH2SX81KZ" },
        { Name: "PhoneNumber", Value: 254712345678 },
        { Name: "TransactionDate", Value: "20260823101530" },
      ],
    },
  });
  assert.equal(parsed.amount, 1);
  assert.equal(parsed.mpesaReceiptNumber, "TGH2SX81KZ");
  assert.equal(parsed.phoneNumber, "254712345678");
  assert.equal(parsed.transactionDate, "20260823101530");

  assert.deepEqual(parseCallbackItems({}), {}); // failed callbacks carry no metadata
});

test("secrets: AES-256-GCM roundtrip, wrong key and missing key fail closed", async () => {
  const { encryptSecret, decryptSecret } = await import("../src/utils/secrets.js");

  process.env.SETTINGS_ENCRYPTION_KEY = "test-master-key";
  const enc = encryptSecret("s3cret-passkey");
  assert.ok(enc?.startsWith("v1:"), "ciphertext is versioned");
  assert.ok(!enc.includes("s3cret-passkey"), "plaintext not stored verbatim");
  assert.equal(decryptSecret(enc), "s3cret-passkey");

  process.env.SETTINGS_ENCRYPTION_KEY = "different-key";
  assert.equal(decryptSecret(enc), null, "wrong key decrypts to nothing");

  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(encryptSecret("x"), null, "refuses to encrypt without key");
  assert.equal(decryptSecret(enc), null);
});

test("M-Pesa credential profile encrypts secrets and preserves configuration", async () => {
  const { buildMpesaCredentialProfile } = await import(
    "../src/routes/payments.js"
  );
  const { decryptSecret } = await import("../src/utils/secrets.js");
  const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

  process.env.SETTINGS_ENCRYPTION_KEY = "profile-test-master-key";

  try {
    const profile = buildMpesaCredentialProfile({
      environment: "sandbox",
      transactionType: "CustomerBuyGoodsOnline",
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "profile-consumer-key",
      consumerSecret: "profile-consumer-secret",
      passkey: "profile-passkey",
      shortcode: "174379",
      partyB: "174379",
      accountReference: "TEST ORDER",
      transactionDesc: "TEST CHECKOUT",
    });

    assert.equal(profile.environment, "sandbox");
    assert.equal(profile.transactionType, "CustomerBuyGoodsOnline");
    assert.equal(profile.shortcode, "174379");
    assert.equal(profile.partyB, "174379");

    assert.notEqual(profile.consumerKey, "profile-consumer-key");
    assert.notEqual(profile.consumerSecret, "profile-consumer-secret");
    assert.notEqual(profile.passkey, "profile-passkey");

    assert.equal(decryptSecret(profile.consumerKey), "profile-consumer-key");
    assert.equal(
      decryptSecret(profile.consumerSecret),
      "profile-consumer-secret"
    );
    assert.equal(decryptSecret(profile.passkey), "profile-passkey");

    assert.equal(profile.accountReference, "TEST ORDER");
    assert.equal(profile.transactionDesc, "TEST CHECKOUT");
  } finally {
    if (previousKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("M-Pesa credential profile refuses incomplete credentials", async () => {
  const { buildMpesaCredentialProfile } = await import(
    "../src/routes/payments.js"
  );
  const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

  process.env.SETTINGS_ENCRYPTION_KEY = "profile-test-master-key";

  try {
    assert.throws(
      () =>
        buildMpesaCredentialProfile({
          environment: "sandbox",
          transactionType: "CustomerPayBillOnline",
          baseUrl: "https://sandbox.safaricom.co.ke",
          consumerKey: "key",
          consumerSecret: "secret",
          passkey: "",
          shortcode: "174379",
        }),
      /passkey is missing/
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("M-Pesa credential profile refuses plaintext storage without encryption key", async () => {
  const { buildMpesaCredentialProfile } = await import(
    "../src/routes/payments.js"
  );
  const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

  delete process.env.SETTINGS_ENCRYPTION_KEY;

  try {
    assert.throws(
      () =>
        buildMpesaCredentialProfile({
          environment: "sandbox",
          transactionType: "CustomerPayBillOnline",
          baseUrl: "https://sandbox.safaricom.co.ke",
          consumerKey: "key",
          consumerSecret: "secret",
          passkey: "passkey",
          shortcode: "174379",
        }),
      /SETTINGS_ENCRYPTION_KEY/
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("C2B confirmation parsing maps Daraja fields to cents", () => {
  const row = parseC2bConfirmation({
    TransID: "TGH2SX81KZ",
    TransactionType: "Pay Bill",
    TransTime: "20260823150700",
    TransAmount: "1500.00",
    BusinessShortCode: "174379",
    BillRefNumber: "ORDER 42",
    MSISDN: "254712345678",
    OrgAccountBalance: "50000.00",
  });
  assert.equal(row.transactionId, "TGH2SX81KZ");
  assert.equal(row.amountCents, 150000);
  assert.equal(row.msisdn, "254712345678");
  assert.equal(row.billRefNumber, "ORDER 42");
  assert.equal(parseC2bConfirmation({}).transactionId, "");
});

test("pull rows flatten nested arrays with loose key casing", () => {
  const rows = parsePullRows([
    [{ transID: "PULL1", TransAmount: "250", msisdn: "254700111222" }],
    [],
    [{ TRANSID: "PULL2", transamount: "99.50" }],
  ]);
  assert.equal(rows.length, 2); // empty group contributes nothing
  assert.equal(rows[0].transactionId, "PULL1");
  assert.equal(rows[0].amountCents, 25000);
  assert.equal(rows[1].transactionId, "PULL2");
  assert.equal(rows[1].amountCents, 9950);
  assert.deepEqual(parsePullRows(undefined), []);
});

test("pull rows parse wrapped objects and key/value items", () => {
  const wrapped = parsePullRows({
    Response: {
      Transactions: {
        Items: [
          {
            Item: [
              { Name: "TransID", Value: "PULL-WRAPPED" },
              { Name: "TransAmount", Value: "125.50" },
              { Name: "MSISDN", Value: "254700123456" },
            ],
          },
        ],
      },
    },
  });
  assert.equal(wrapped.length, 1);
  assert.equal(wrapped[0].transactionId, "PULL-WRAPPED");
  assert.equal(wrapped[0].amountCents, 12550);
  assert.equal(wrapped[0].msisdn, "254700123456");

  const direct = parsePullRows({
    TransactionID: "PULL-DIRECT",
    TransactionAmount: "300",
  });
  assert.equal(direct.length, 1);
  assert.equal(direct[0].transactionId, "PULL-DIRECT");
  assert.equal(direct[0].amountCents, 30000);
});

test("Daraja error catalogue distinguishes known and unknown codes", async () => {
  const {
    describeDarajaCode,
    normalizeDarajaResponse,
  } = await import("../src/utils/darajaErrors.js");

  assert.equal(describeDarajaCode("1032").category, "cancelled");
  assert.equal(describeDarajaCode("999999").known, false);
  assert.equal(normalizeDarajaResponse({
    stage: "stk",
    httpStatus: 200,
    response: { ResultCode: "2029", ResultDesc: "Unresolved" },
  }).category, "unresolved");
});

test("Daraja OAuth uses GET, Basic auth and caches the token", async () => {
  const { getAccessToken } = await import("../src/routes/payments.js");

  const originalFetch = globalThis.fetch;
  let calls = 0;
  let requestedUrl;
  let requestedOptions;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: "test-consumer-key-cache",
    consumerSecret: "test-consumer-secret-cache",
  };

  globalThis.fetch = async (url, options) => {
    calls += 1;
    requestedUrl = url;
    requestedOptions = options;

    return new Response(
      JSON.stringify({
        access_token: "test-daraja-token-cache",
        expires_in: "3599",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  try {
    const first = await getAccessToken(creds);
    const second = await getAccessToken(creds);

    assert.equal(first, "test-daraja-token-cache");
    assert.equal(second, first);
    assert.equal(calls, 1, "second call should reuse cached token");
    assert.equal(
      requestedUrl,
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    );
    assert.equal(requestedOptions.method, "GET");

    const expectedBasic = Buffer.from(
      `${creds.consumerKey}:${creds.consumerSecret}`
    ).toString("base64");

    assert.equal(
      requestedOptions.headers.Authorization,
      `Basic ${expectedBasic}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("concurrent Daraja OAuth calls share one token request", async () => {
  const { getAccessToken } = await import("../src/routes/payments.js");

  const originalFetch = globalThis.fetch;
  let calls = 0;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: "test-consumer-key-concurrent",
    consumerSecret: "test-consumer-secret-concurrent",
  };

  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));

    return new Response(
      JSON.stringify({
        access_token: "test-concurrent-token",
        expires_in: "3599",
      }),
      { status: 200 }
    );
  };

  try {
    const tokens = await Promise.all(
      Array.from({ length: 8 }, () => getAccessToken(creds))
    );

    assert.equal(calls, 1);
    assert.ok(tokens.every((token) => token === "test-concurrent-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja authorized request refreshes once after HTTP 401", async () => {
  const { darajaAuthorizedFetch } = await import("../src/routes/payments.js");

  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let apiCalls = 0;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: "test-consumer-key-401",
    consumerSecret: "test-consumer-secret-401",
  };

  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;

      return new Response(
        JSON.stringify({
          access_token: `test-token-${tokenCalls}`,
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    apiCalls += 1;

    if (options.headers.Authorization === "Bearer test-token-1") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    return new Response(
      JSON.stringify({ ResponseCode: "0" }),
      { status: 200 }
    );
  };

  try {
    const response = await darajaAuthorizedFetch(
      "/test/protected",
      { method: "GET" },
      creds
    );

    assert.equal(response.status, 200);
    assert.equal(tokenCalls, 2);
    assert.equal(apiCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("late 401 reuses a token refreshed by another request", async () => {
  const {
    darajaAuthorizedFetch,
    getAccessToken,
  } = await import("../src/routes/payments.js");

  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let apiCalls = 0;
  let resolveFirstApiRequest;
  let markFirstApiRequestStarted;

  const firstApiRequest = new Promise((resolve) => {
    markFirstApiRequestStarted = resolve;
  });
  const firstApiResponse = new Promise((resolve) => {
    resolveFirstApiRequest = resolve;
  });

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: "test-consumer-key-late-401",
    consumerSecret: "test-consumer-secret-late-401",
  };

  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;

      return new Response(
        JSON.stringify({
          access_token: `test-late-token-${tokenCalls}`,
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    apiCalls += 1;

    if (apiCalls === 1) {
      markFirstApiRequestStarted();
      return firstApiResponse;
    }

    assert.equal(
      options.headers.Authorization,
      "Bearer test-late-token-2"
    );

    return new Response(
      JSON.stringify({ ResponseCode: "0" }),
      { status: 200 }
    );
  };

  try {
    assert.equal(
      await getAccessToken(creds),
      "test-late-token-1"
    );

    const request = darajaAuthorizedFetch(
      "/test/protected",
      { method: "GET" },
      creds
    );

    await firstApiRequest;
    assert.equal(
      await getAccessToken(creds, { forceRefresh: true }),
      "test-late-token-2"
    );

    resolveFirstApiRequest(
      new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      )
    );

    const response = await request;
    assert.equal(response.status, 200);
    assert.equal(tokenCalls, 2);
    assert.equal(apiCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja authorized request does not retry non-401 responses", async () => {
  const { darajaAuthorizedFetch } = await import("../src/routes/payments.js");

  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let apiCalls = 0;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: "test-consumer-key-500",
    consumerSecret: "test-consumer-secret-500",
  };

  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;

      return new Response(
        JSON.stringify({
          access_token: "test-token-500",
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    apiCalls += 1;

    return new Response(
      JSON.stringify({ error: "Provider unavailable" }),
      { status: 503 }
    );
  };

  try {
    const response = await darajaAuthorizedFetch(
      "/test/protected",
      { method: "GET" },
      creds
    );

    assert.equal(response.status, 503);
    assert.equal(tokenCalls, 1);
    assert.equal(apiCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja admin POST refreshes once after an HTTP 401", async () => {
  const { darajaAdminPost } = await import("../src/routes/payments.js");
  const originalFetch = globalThis.fetch;
  const requests = [];
  let tokenCalls = 0;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: `admin-post-key-${randomUUID()}`,
    consumerSecret: `admin-post-secret-${randomUUID()}`,
  };

  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: `admin-post-token-${tokenCalls}`,
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    requests.push({ url: String(url), options });
    if (requests.length === 1) {
      return new Response(
        JSON.stringify({ errorMessage: "Invalid token" }),
        { status: 401 }
      );
    }
    return new Response(JSON.stringify({ ResponseCode: "0" }), {
      status: 200,
    });
  };

  try {
    const result = await darajaAdminPost(
      "/mpesa/c2b/v1/registerurl",
      { ShortCode: "174379" },
      creds
    );

    assert.deepEqual(result, { ResponseCode: "0" });
    assert.equal(tokenCalls, 2);
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].options.headers.Authorization,
      "Bearer admin-post-token-1"
    );
    assert.equal(
      requests[1].options.headers.Authorization,
      "Bearer admin-post-token-2"
    );
    assert.equal(
      requests[0].url,
      "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja admin POST refreshes once for API errorCode 401.003.01", async () => {
  const { darajaAdminPost } = await import("../src/routes/payments.js");
  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let postCalls = 0;

  const creds = {
    environment: "production",
    baseUrl: "https://api.safaricom.co.ke",
    consumerKey: `admin-post-error-code-key-${randomUUID()}`,
    consumerSecret: `admin-post-error-code-secret-${randomUUID()}`,
  };

  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: `admin-post-error-code-token-${tokenCalls}`,
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    postCalls += 1;
    return new Response(
      JSON.stringify(
        postCalls === 1
          ? { errorCode: "401.003.01", errorMessage: "Invalid access token" }
          : { ResponseStatus: "1000" }
      ),
      { status: 200 }
    );
  };

  try {
    const result = await darajaAdminPost(
      "/pulltransactions/v1/register",
      {},
      creds
    );

    assert.deepEqual(result, { ResponseStatus: "1000" });
    assert.equal(tokenCalls, 2);
    assert.equal(postCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja admin POST does not retry more than once", async () => {
  const { darajaAdminPost } = await import("../src/routes/payments.js");
  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let postCalls = 0;

  const creds = {
    environment: "sandbox",
    baseUrl: "https://sandbox.safaricom.co.ke",
    consumerKey: `admin-post-once-key-${randomUUID()}`,
    consumerSecret: `admin-post-once-secret-${randomUUID()}`,
  };

  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth/v1/generate")) {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: `admin-post-once-token-${tokenCalls}`,
          expires_in: "3599",
        }),
        { status: 200 }
      );
    }

    postCalls += 1;
    return new Response(
      JSON.stringify({ errorMessage: "Still unauthorized" }),
      { status: 401 }
    );
  };

  try {
    await assert.rejects(
      darajaAdminPost("/mpesa/test", {}, creds),
      (error) => {
        assert.equal(error.status, 502);
        assert.equal(error.providerStatus, 401);
        assert.equal(error.providerPath, "/mpesa/test");
        return true;
      }
    );
    assert.equal(tokenCalls, 2);
    assert.equal(postCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Daraja HTTP 401 is exposed as an upstream 502", async () => {
  const { createDarajaHttpError } = await import(
    "../src/routes/payments.js"
  );

  const error = createDarajaHttpError(
    "/mpesa/c2b/v1/registerurl",
    401,
    {
      errorCode: "401.003.01",
      errorMessage: "Invalid Access Token",
    }
  );

  assert.equal(error.status, 502);
  assert.equal(error.providerStatus, 401);
  assert.equal(error.providerCode, "401.003.01");
  assert.match(error.message, /Invalid Access Token/);
});

test("Daraja provider failures never use the application's 401 status", async () => {
  const { createDarajaHttpError } = await import(
    "../src/routes/payments.js"
  );

  for (const status of [400, 401, 403, 404, 429, 500]) {
    const error = createDarajaHttpError(
      "/pulltransactions/v1/query",
      status,
      { errorMessage: "Provider rejected request" }
    );

    assert.equal(error.status, 502);
    assert.equal(error.providerStatus, status);
  }
});
