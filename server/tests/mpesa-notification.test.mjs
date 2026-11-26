import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sendEventTicketChannelMessage,
} from "../src/notifications.js";

test("SMS sends only through the SMS channel", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.MESSAGING_WEBHOOK_URL;

  process.env.MESSAGING_WEBHOOK_URL = "https://test.invalid/webhook";

  const calls = [];

  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));

    return new Response(
      JSON.stringify({ accepted: true }),
      { status: 200 }
    );
  };

  try {
    const result = await sendEventTicketChannelMessage({
      channel: "sms",
      phone: "0712345678",
      attendeeName: "Test Customer",
      eventTitle: "Test Event",
      ticketCodes: ["EVT-ABC123"],
    });

    assert.deepEqual(result, {
      accepted: true,
      channel: "sms",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].channel, "sms");
    assert.equal(calls[0].to, "254712345678");
    assert.match(calls[0].message, /EVT-ABC123/);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.MESSAGING_WEBHOOK_URL;
    } else {
      process.env.MESSAGING_WEBHOOK_URL = originalUrl;
    }
  }
});

test("WhatsApp sends only through the WhatsApp channel", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.MESSAGING_WEBHOOK_URL;

  process.env.MESSAGING_WEBHOOK_URL = "https://test.invalid/webhook";

  const calls = [];

  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Response("{}", { status: 200 });
  };

  try {
    const result = await sendEventTicketChannelMessage({
      channel: "whatsapp",
      phone: "+254712345678",
      attendeeName: "Test Customer",
      eventTitle: "Test Event",
      ticketCodes: ["EVT-XYZ123"],
    });

    assert.equal(result.accepted, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].channel, "whatsapp");
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.MESSAGING_WEBHOOK_URL;
    } else {
      process.env.MESSAGING_WEBHOOK_URL = originalUrl;
    }
  }
});

test("failed provider response is not treated as accepted", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.MESSAGING_WEBHOOK_URL;

  process.env.MESSAGING_WEBHOOK_URL = "https://test.invalid/webhook";

  globalThis.fetch = async () =>
    new Response("Provider unavailable", { status: 503 });

  try {
    await assert.rejects(
      sendEventTicketChannelMessage({
        channel: "sms",
        phone: "0712345678",
        attendeeName: "Test Customer",
        eventTitle: "Test Event",
      }),
      /SMS provider did not accept/
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.MESSAGING_WEBHOOK_URL;
    } else {
      process.env.MESSAGING_WEBHOOK_URL = originalUrl;
    }
  }
});

test("missing messaging configuration is not treated as success", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.MESSAGING_WEBHOOK_URL;

  delete process.env.MESSAGING_WEBHOOK_URL;

  let called = false;

  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };

  try {
    await assert.rejects(
      sendEventTicketChannelMessage({
        channel: "sms",
        phone: "0712345678",
        attendeeName: "Test Customer",
        eventTitle: "Test Event",
      }),
      /SMS provider did not accept/
    );

    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.MESSAGING_WEBHOOK_URL;
    } else {
      process.env.MESSAGING_WEBHOOK_URL = originalUrl;
    }
  }
});

test("unsupported notification channel is rejected", async () => {
  await assert.rejects(
    sendEventTicketChannelMessage({
      channel: "telegram",
      phone: "0712345678",
      eventTitle: "Test Event",
    }),
    /Unsupported notification channel/
  );
});
