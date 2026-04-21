import type { ItemStatus } from "../types";
import { isOverdue, isWithinWeek, todayString } from "./dates";

// ── DOM 选择器常量 ──────────────────────────────────────────────
export const SEL_FOCUSABLE_ROW = '[role="listitem"][tabindex="0"]';
export const SEL_SECTION_HEADER = '[data-section-header]';
export const SEL_NAV_TARGETS = `${SEL_FOCUSABLE_ROW}, ${SEL_SECTION_HEADER}`;

/** 根据 data-item-id 定位可聚焦行  */
function selRowById(id: string) {
  return `${SEL_FOCUSABLE_ROW}[data-item-id="${CSS.escape(id)}"]`;
}

/** 在 NodeList 中找到第一个可见元素 */
function firstVisible(selector: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(selector);
  for (const el of all) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

/** 查询所有可见的可聚焦行 */
export function getVisibleRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(SEL_FOCUSABLE_ROW),
  ).filter((el) => el.offsetParent !== null);
}

/** 查询所有可见的导航目标（行 + section header） */
export function getVisibleNavTargets(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(SEL_NAV_TARGETS),
  ).filter((el) => el.offsetParent !== null);
}

/**
 * 通用焦点回退链 —— 删除/状态变更后调用
 *
 * 回退顺序：
 *  1. 如果 fallbackItemId 指定的行仍可见 → 聚焦
 *  2. 任意可见行 → 聚焦
 *  3. 任意可见 section-header → 聚焦
 *  4. 任意可见 input → 聚焦
 */
export function focusFallbackChain(fallbackItemId?: string | null): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (fallbackItemId) {
        const el = firstVisible(selRowById(fallbackItemId));
        if (el) { el.focus(); return; }
      }
      const anyRow = firstVisible(SEL_FOCUSABLE_ROW);
      if (anyRow) { anyRow.focus(); return; }
      const header = firstVisible(SEL_SECTION_HEADER);
      if (header) { header.focus(); return; }
      const input = firstVisible("input");
      if (input) input.focus();
    });
  });
}

/**
 * 删除项之前调用——自动计算应聚焦哪行，然后执行回退链
 *
 * @param currentEl 当前即将删除的行元素
 */
export function focusFallbackAfterRemove(currentEl: HTMLElement | null): void {
  const allRows = getVisibleRows();
  const thisIdx = currentEl ? allRows.indexOf(currentEl) : -1;
  const fallback = thisIdx > 0 ? allRows[thisIdx - 1] : thisIdx === 0 ? allRows[1] : null;
  focusFallbackChain(fallback?.dataset?.itemId);
}

/**
 * 状态变更后聚焦 —— 先尝试同行，再回退
 *
 * @param currentItemId 当前 item.id
 * @param fallbackItemId 上/下一行的 data-item-id
 */
export function focusAfterStatusChange(currentItemId: string, fallbackItemId?: string | null): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const sameRow = firstVisible(selRowById(currentItemId));
      if (sameRow) { sameRow.focus(); return; }
      if (fallbackItemId) {
        const prev = firstVisible(selRowById(fallbackItemId));
        if (prev) { prev.focus(); return; }
      }
      const anyRow = firstVisible(SEL_FOCUSABLE_ROW);
      if (anyRow) { anyRow.focus(); return; }
      const header = firstVisible(SEL_SECTION_HEADER);
      if (header) { header.focus(); return; }
      const input = firstVisible("input");
      if (input) input.focus();
    });
  });
}

// ── 日期紧急度计算 ──────────────────────────────────────────────
export type DateUrgency = "normal" | "danger" | "warning";

export function getDateUrgency(status: ItemStatus, dueDate: string | null): DateUrgency {
  if (status === "done") return "normal";
  const overdue = isOverdue(dueDate);
  const isToday = dueDate === todayString();
  if (overdue || isToday) return "danger";
  if (isWithinWeek(dueDate)) return "warning";
  return "normal";
}
