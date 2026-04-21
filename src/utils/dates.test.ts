import { describe, it, expect } from "vitest";
import { todayString, isOverdue, isTodayOrOverdue, daysSince } from "./dates";

// 辅助：生成距今 N 天的日期字符串（N > 0 = 过去，N < 0 = 未来）
function relativeDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── todayString ────────────────────────────────────────────────────────────

describe("todayString", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches current local date", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(todayString()).toBe(expected);
  });
});

// ── isOverdue ──────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  it("returns false for null", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("returns false for today", () => {
    expect(isOverdue(todayString())).toBe(false);
  });

  it("returns false for future date", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("returns true for a past date", () => {
    expect(isOverdue("2020-01-01")).toBe(true);
  });

  it("returns true for yesterday", () => {
    expect(isOverdue(relativeDate(-1))).toBe(true);
  });
});

// ── isTodayOrOverdue ───────────────────────────────────────────────────────

describe("isTodayOrOverdue", () => {
  it("returns false for null", () => {
    expect(isTodayOrOverdue(null)).toBe(false);
  });

  it("returns true for today", () => {
    expect(isTodayOrOverdue(todayString())).toBe(true);
  });

  it("returns true for past date", () => {
    expect(isTodayOrOverdue("2020-01-01")).toBe(true);
  });

  it("returns true for yesterday", () => {
    expect(isTodayOrOverdue(relativeDate(-1))).toBe(true);
  });

  it("returns false for future date", () => {
    expect(isTodayOrOverdue("2099-12-31")).toBe(false);
  });

  it("returns false for tomorrow", () => {
    expect(isTodayOrOverdue(relativeDate(1))).toBe(false);
  });
});

// ── daysSince ──────────────────────────────────────────────────────────────

describe("daysSince", () => {
  it("returns 0 for today", () => {
    expect(daysSince(todayString())).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince(relativeDate(-1))).toBe(1);
  });

  it("returns positive number for past date", () => {
    expect(daysSince("2020-01-01")).toBeGreaterThan(0);
  });

  it("returns negative number for future date", () => {
    expect(daysSince("2099-12-31")).toBeLessThan(0);
  });

  it("returns -1 for tomorrow", () => {
    expect(daysSince(relativeDate(1))).toBe(-1);
  });
});
