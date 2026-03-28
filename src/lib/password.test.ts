import { describe, expect, it } from "vitest";
import { getPasswordChecks, getPasswordValidationMessage } from "@/lib/password";

describe("password helpers", () => {
  it("returns the expected checklist flags", () => {
    expect(getPasswordChecks("Abcd1234")).toEqual({
      minLength: true,
      uppercase: true,
      lowercase: true,
      number: true,
    });
  });

  it("returns the first failing validation message", () => {
    expect(getPasswordValidationMessage("abc")).toBe("Password must be at least 8 characters.");
    expect(getPasswordValidationMessage("abcdefgh")).toBe(
      "Password must include at least one uppercase letter.",
    );
    expect(getPasswordValidationMessage("ABCDEFGH")).toBe(
      "Password must include at least one lowercase letter.",
    );
    expect(getPasswordValidationMessage("Abcdefgh")).toBe(
      "Password must include at least one number.",
    );
    expect(getPasswordValidationMessage("Abcd1234")).toBeNull();
  });
});
