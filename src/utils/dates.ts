/**
 * 日期工具函数
 * 注意：全部使用本地时间（用户日历），不使用 UTC，符合本地化需求
 */

/** 获取今天的日期字符串，格式 "YYYY-MM-DD" */
export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 判断日期是否逾期（due_date < 今天）
 * @param dueDate "YYYY-MM-DD" 或 null
 */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < todayString();
}

/** 判断日期是否在今天之后一周内（不含今天） */
export function isWithinWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = todayString();
  if (dueDate <= today) return false;
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + 7);
  const weekLater = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return dueDate <= weekLater;
}

/**
 * 判断日期是否为今天或已过期（今日聚焦视图的过滤条件）
 * @param dueDate "YYYY-MM-DD" 或 null
 */
export function isTodayOrOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate <= todayString();
}

/**
 * 计算两个日期之间的天数差（正数=已等待天数，负数=还有几天）
 * @param fromDate "YYYY-MM-DD"
 */
export function daysSince(fromDate: string): number {
  const from = new Date(fromDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** 将存储格式 "YYYY-MM-DD" 转换为显示格式 "YYYY/MM/DD" */
export function formatDateDisplay(date: string | null | undefined): string {
  if (!date) return "";
  return date.replace(/-/g, "/");
}
