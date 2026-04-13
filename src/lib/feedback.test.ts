import { describe, expect, it } from "vitest";
import { feedbackText, getApiErrorMessage } from "@/lib/feedback";

describe("feedback helpers", () => {
  it("formats common success messages consistently", () => {
    expect(feedbackText.created("event")).toBe("Event created.");
    expect(feedbackText.updated("listing")).toBe("Listing updated.");
    expect(feedbackText.deleted("product")).toBe("Product deleted.");
    expect(feedbackText.cancelled("booking")).toBe("Booking cancelled.");
    expect(feedbackText.uploaded()).toBe("Image uploaded.");
    expect(feedbackText.added("image")).toBe("Image added.");
    expect(feedbackText.removed("image")).toBe("Image removed.");
    expect(feedbackText.imported("event", 1)).toBe("Imported 1 event.");
    expect(feedbackText.imported("event", 3)).toBe("Imported 3 events.");
    expect(feedbackText.printingOpened("ticket")).toBe("Ticket opened for printing.");
    expect(feedbackText.downloaded("receipt")).toBe("Receipt downloaded.");
  });

  it("extracts API error messages and falls back safely", async () => {
    const errorResp = new Response(JSON.stringify({ error: "Email already in use" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
    await expect(getApiErrorMessage(errorResp, "Registration failed")).resolves.toBe("Email already in use");

    const emptyResp = new Response(null, { status: 500 });
    await expect(getApiErrorMessage(emptyResp, "Upload failed")).resolves.toBe("Upload failed");
  });
});
