import { todayString } from "./dates";

/** 解析日期快捷语法：今天/td/明天/tmr/mm-dd/yyyy-mm-dd */
export function parseDateShortcut(s: string): string | null {
  const today = todayString();
  const lower = s.toLowerCase();
  if (lower === "今天" || lower === "td") return today;
  if (lower === "明天" || lower === "tmr") {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const normalized = s.replace(/\//g, "-");
  const parts = normalized.split("-").map(Number);
  let yr: number, mo: number, da: number;
  if (parts.length === 3 && parts[0] > 999) {
    [yr, mo, da] = parts;
  } else if (parts.length === 2) {
    yr = new Date().getFullYear();
    [mo, da] = parts;
  } else {
    return null;
  }
  if ([yr, mo, da].some(isNaN) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${yr}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

/**
 * 解析快捷语法：--等待人  //日期
 * 例：`Buy milk --张三 //4/10` → { title: "Buy milk", waitingFor: "张三", dueDate: "2026-04-10" }
 */
export function parseQuickInput(raw: string): {
  title: string;
  waitingFor: string | null;
  dueDate: string | null;
} {
  let text = raw;
  let waitingFor: string | null = null;
  let dueDate: string | null = null;

  // --等待人
  text = text.replace(/(^|\s)--(\S+)/g, (_match, pre: string, name: string) => {
    waitingFor = name;
    return pre;
  });

  // //日期
  text = text.replace(/(^|\s)\/\/(\S+)/g, (_match, pre: string, dateStr: string) => {
    dueDate = parseDateShortcut(dateStr);
    return pre;
  });

  return { title: text.trim(), waitingFor: waitingFor ?? null, dueDate: dueDate ?? null };
}
