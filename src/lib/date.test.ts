import { describe, expect, it, vi } from "vitest";
import {
  formatDateButtonLabel,
  getTodayDateValue,
  isEndBeforeStart,
  isPastDateTimeLocalValue,
  isPastDateValue,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/date";

describe("date helpers", () => {
  it("formats and parses date input values consistently", () => {
    const date = new Date("2026-04-05T09:15:00");
    expect(toDateInputValue(date)).toBe("2026-04-05");
    const parsed = parseDateInputValue("2026-04-05");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(5);
    expect(formatDateButtonLabel("2026-04-05")).not.toBe("Select date");
  });

  it("detects end dates before start dates", () => {
    expect(isEndBeforeStart("2026-04-05", "2026-04-04")).toBe(true);
    expect(isEndBeforeStart("2026-04-05", "2026-04-05")).toBe(false);
    expect(isEndBeforeStart("2026-04-05", "2026-04-06")).toBe(false);
  });

  it("detects past date values relative to today", () => {
    vi.setSystemTime(new Date("2026-04-10T10:00:00"));

    expect(getTodayDateValue()).toBe("2026-04-10");
    expect(isPastDateValue("2026-04-09")).toBe(true);
    expect(isPastDateValue("2026-04-10")).toBe(false);
    expect(isPastDateValue("2026-04-11")).toBe(false);
    expect(isPastDateTimeLocalValue("2026-04-10T09:30")).toBe(true);
    expect(isPastDateTimeLocalValue("2026-04-10T10:30")).toBe(false);

    vi.useRealTimers();
  });
});
