// ── Tab 导航类型 ────────────────────────────────────────────────────────

/** 应用的视图 Tab */
export type TabId = "all" | "today" | "long_term" | "done" | "export" | "shortcuts";

export interface TabConfig {
  id: TabId;
  label: string;
  /** 无障碍描述 */
  ariaLabel: string;
  /** 标记为工具按钮（右侧图标形式） */
  isUtility?: boolean;
}

export const TABS: TabConfig[] = [
  { id: "all", label: "全部", ariaLabel: "全部跟进项" },
  { id: "today", label: "今日聚焦", ariaLabel: "今日聚焦视图" },
  { id: "long_term", label: "长期跟进", ariaLabel: "长期跟进视图" },
  { id: "done", label: "已完成", ariaLabel: "已完成跟进项" },
  { id: "export", label: "导出", ariaLabel: "导出跟进项", isUtility: true },
  { id: "shortcuts", label: "快捷键", ariaLabel: "键盘快捷键说明", isUtility: true },
];

/** 仅导航标签（非工具按钮），用于 Ctrl+Tab 循环切换 */
export const NAV_TAB_IDS: TabId[] = TABS.filter(t => !t.isUtility).map(t => t.id);

// ── 跟进项数据类型 ────────────────────────────────────────────────────────

/** 跟进项状态，与 Rust 侧 CHECK 约束一致 */
export type ItemStatus = "todo" | "waiting" | "done" | "long_term";

/** 超链接结构 */
export interface ItemLink {
  url: string;
  label: string;
}

/** 跟进项数据模型（与 Rust FollowUpItem 对应） */
export interface FollowUpItem {
  id: number;
  parentId: number | null;
  title: string;
  status: ItemStatus;
  waitingFor: string | null;
  waitingSince: string | null;
  owner: string | null;
  dueDate: string | null;
  /** JSON 字符串，反序列化为 ItemLink[] */
  links: string;
  isEmphasized: boolean;
  sortOrder: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** 创建跟进项的输入参数 */
export interface CreateItemInput {
  title: string;
  parentId?: number | null;
  owner?: string | null;
  dueDate?: string | null;
}

/** 更新跟进项的输入参数（所有字段可选） */
export interface UpdateItemInput {
  id: number;
  title?: string;
  status?: ItemStatus;
  waitingFor?: string | null;
  waitingSince?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  links?: string;
  isEmphasized?: boolean;
  notes?: string | null;
  completedAt?: string | null;
}

/** 查询跟进项的过滤条件 */
export interface GetItemsFilter {
  status?: ItemStatus;
  parentId?: number | null;
  dueDateBefore?: string;
  includeChildren?: boolean;
}

/** 状态变更历史记录 */
export interface StatusHistoryEntry {
  id: number;
  itemId: number;
  oldStatus: ItemStatus | null;
  newStatus: ItemStatus;
  changedAt: string;
}
