import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import type {
  CreateItemInput,
  FollowUpItem,
  GetItemsFilter,
  TabId,
  UpdateItemInput,
} from "../types";
import { todayString } from "../utils/dates";

// ── Store 接口定义 ────────────────────────────────────────────────────────

interface ItemStoreState {
  /** 所有跟进项（顶级 + 含子任务）。首次加载后缓存，乐观更新直接修改 */
  items: FollowUpItem[];
  /** 当前激活的 Tab */
  activeTab: TabId;
  /** 右侧详情面板当前打开的跟进项 ID，null 表示面板关闭 */
  detailPanelItemId: number | null;
  /** 已展开子任务的父任务 ID 集合 */
  expandedItemIds: Set<number>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 全局快速创建输入框聚焦触发器（每次 +1 表示触发一次聚焦） */
  quickCreateFocusTrigger: number;
  /** 最近创建的跟进项真实 ID，用于自动聚焦 */
  lastCreatedItemId: number | null;
}

interface ItemStoreActions {
  /** 从 SQLite 加载全部顶级跟进项 */
  loadItems: (filter?: GetItemsFilter) => Promise<void>;
  /** 创建新跟进项（乐观更新） */
  createItem: (title: string, parentId?: number | null, owner?: string | null, dueDate?: string | null, waitingFor?: string | null) => Promise<void>;
  /** 更新跟进项（乐观更新） */
  updateItem: (input: UpdateItemInput) => Promise<void>;
  /** 删除跟进项（乐观更新） */
  deleteItem: (id: number) => Promise<void>;
  /** 更新排序位置（乐观更新） */
  reorderItem: (id: number, newSortOrder: number) => Promise<void>;
  /** 切换 Tab */
  switchTab: (tab: TabId) => void;
  /** 开启/关闭详情面板 */
  toggleDetailPanel: (itemId?: number | null) => void;
  /** 展开/收起子任务列表 */
  toggleExpandItem: (itemId: number) => void;
  /** 触发全局快速创建输入框聚焦 */
  triggerQuickCreate: () => void;
  /** 清除 lastCreatedItemId */
  clearLastCreated: () => void;
  /** 将子任务提升为主任务（Ctrl+Shift+↑） */
  promoteSubtask: (id: number) => Promise<void>;
  /** 将子任务移动到另一个父任务下 */
  moveSubtaskToParent: (subtaskId: number, newParentId: number) => Promise<void>;
  /** 撤回上一步操作（最多 10 步） */
  undo: () => Promise<void>;
  /** 是否有可撤回的操作 */
  canUndo: () => boolean;
}

// ── Computed selectors（在组件中调用，不放进 store 避免无谓重渲染）──────

/** 判断 item 是否匹配今日聚焦条件：活跃状态 + 无日期或今天或已过期 */
function isTodayFocusMatch(item: FollowUpItem): boolean {
  return (
    (item.status === "todo" || item.status === "waiting") &&
    (item.dueDate === null || item.dueDate <= todayString())
  );
}

/** 选取今日聚焦视图：仅待办 + 等待他人，截止日期 = 今天、已过期或未设日期 */
export function selectTodayItems(items: FollowUpItem[]): FollowUpItem[] {
  return items
    .filter(
      (item) => item.parentId === null && isTodayFocusMatch(item)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 今日聚焦完整数据：包含直接匹配的父任务 + 因子任务匹配而纳入的"幽灵父任务"
 * ghostParentIds: 仅因子任务匹配才显示的父任务 ID 集合（半透明展示）
 */
export function selectTodayFocusData(items: FollowUpItem[]): {
  items: FollowUpItem[];
  ghostParentIds: Set<number>;
} {
  // 1. 直接匹配的顶级任务
  const directParents = items.filter(
    (item) => item.parentId === null && isTodayFocusMatch(item)
  );
  const directParentIds = new Set(directParents.map((p) => p.id));

  // 2. 匹配的子任务 → 找出需要纳入的幽灵父任务
  const ghostParentIds = new Set<number>();
  for (const item of items) {
    if (item.parentId !== null && isTodayFocusMatch(item)) {
      if (!directParentIds.has(item.parentId)) {
        ghostParentIds.add(item.parentId);
      }
    }
  }

  // 3. 合并：直接匹配 + 幽灵父任务
  const ghostParents = ghostParentIds.size > 0
    ? items.filter((item) => ghostParentIds.has(item.id))
    : [];
  const combined = [...directParents, ...ghostParents]
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { items: combined, ghostParentIds };
}

/** 选取长期跟进视图：status = long_term，仅顶级 */
export function selectLongTermItems(items: FollowUpItem[]): FollowUpItem[] {
  return items
    .filter(
      (item) => item.parentId === null && item.status === "long_term"
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 选取全部视图：所有顶级跟进项（含已完成） */
export function selectAllItems(items: FollowUpItem[]): FollowUpItem[] {
  return items
    .filter((item) => item.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 选取某父任务的子任务 */
export function selectChildren(
  items: FollowUpItem[],
  parentId: number
): FollowUpItem[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Undo 栈（store 外部维护，避免每次 set 触发渲染）────────────────────
const MAX_UNDO = 10;
interface UndoEntry {
  items: FollowUpItem[];
  /** 逆向 DB 操作，恢复数据库到操作前状态 */
  reverseDb: () => Promise<void>;
}
const undoStack: UndoEntry[] = [];

function pushUndoEntry(items: FollowUpItem[], reverseDb: () => Promise<void>) {
  undoStack.push({ items: items.map((i) => ({ ...i })), reverseDb });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

// ── Store 实现 ───────────────────────────────────────────────────────────

export const useItemStore = create<ItemStoreState & ItemStoreActions>(
  (set, get) => ({
    // ── 初始状态 ──────────────────────────────────
    items: [],
    activeTab: "all",
    detailPanelItemId: null,
    expandedItemIds: new Set(),
    isLoading: false,
    error: null,
    quickCreateFocusTrigger: 0,
    lastCreatedItemId: null,

    // ── Actions ──────────────────────────────────

    loadItems: async (filter?: GetItemsFilter) => {
      set({ isLoading: true, error: null });
      try {
        // 加载顶级任务
        const topLevel = await invoke<FollowUpItem[]>("get_items", {
          filter: { ...filter, includeChildren: false },
        });
        // 加载所有子任务
        const children = await invoke<FollowUpItem[]>("get_items", {
          filter: { includeChildren: true, status: undefined },
        });
        // 合并（子任务附在 items 数组后，通过 parentId 关联）
        const allItems = [...topLevel];
        const parentIds = new Set<number>();
        for (const child of children) {
          if (child.parentId !== null) {
            allItems.push(child);
            parentIds.add(child.parentId);
          }
        }
        set({ items: allItems, isLoading: false, expandedItemIds: parentIds });
      } catch (err) {
        set({ error: String(err), isLoading: false });
      }
    },

    createItem: async (title: string, parentId?: number | null, owner?: string | null, dueDate?: string | null, waitingFor?: string | null) => {
      const input: CreateItemInput = { title, parentId: parentId ?? null, owner: owner ?? null, dueDate: dueDate ?? null };
      // 乐观更新：先生成临时 ID
      const tempId = -(Date.now());
      const optimisticItem: FollowUpItem = {
        id: tempId,
        parentId: parentId ?? null,
        title,
        status: "todo",
        waitingFor: waitingFor ?? null,
        waitingSince: null,
        owner: owner ?? null,
        dueDate: dueDate ?? null,
        links: "[]",
        isEmphasized: false,
        sortOrder: -(Date.now()),
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      set((state) => ({ items: [...state.items, optimisticItem] }));

      // undo 快照（排除临时项，即操作前的状态）
      const snapshotItems = get().items.filter((i) => i.id !== tempId);
      // reverseDb 在 create 成功后填充（需要真实 ID）
      let createdRealId: number | null = null;
      pushUndoEntry(snapshotItems, async () => {
        if (createdRealId !== null) {
          await invoke("delete_item", { id: createdRealId });
        }
      });

      try {
        const created = await invoke<FollowUpItem>("create_item", { input });
        // 如果有等待人，创建后立即更新状态
        if (waitingFor) {
          await invoke("update_item", { input: { id: created.id, waitingFor } });
          created.waitingFor = waitingFor;
        }
        // 用真实数据替换临时项
        set((state) => ({
          items: state.items.map((item) =>
            item.id === tempId ? created : item
          ),
          detailPanelItemId:
            state.detailPanelItemId === tempId
              ? created.id
              : state.detailPanelItemId,
          lastCreatedItemId: created.id,
        }));
        // 保存真实 ID 供 undo 逆向删除
        createdRealId = created.id;
      } catch (err) {
        // 回滚：移除临时项
        set((state) => ({
          items: state.items.filter((item) => item.id !== tempId),
          error: String(err),
        }));
      }
    },

    updateItem: async (input: UpdateItemInput) => {
      const prev = get().items.find((item) => item.id === input.id);
      if (!prev) return;

      // undo 快照 + 逆向 DB 操作（恢复到旧值）
      pushUndoEntry(get().items, async () => {
        const reverseInput: UpdateItemInput = {
          id: prev.id,
          title: prev.title,
          status: prev.status,
          waitingFor: prev.waitingFor,
          waitingSince: prev.waitingSince,
          owner: prev.owner,
          dueDate: prev.dueDate,
          links: prev.links,
          isEmphasized: prev.isEmphasized,
          notes: prev.notes,
          completedAt: prev.completedAt,
        };
        await invoke("update_item", { input: reverseInput });
      });

      // 乐观更新
      const optimistic: FollowUpItem = {
        ...prev,
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.waitingFor !== undefined && { waitingFor: input.waitingFor }),
        ...(input.waitingSince !== undefined && {
          waitingSince: input.waitingSince,
        }),
        ...(input.owner !== undefined && { owner: input.owner }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.links !== undefined && { links: input.links }),
        ...(input.isEmphasized !== undefined && {
          isEmphasized: input.isEmphasized,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.completedAt !== undefined && {
          completedAt: input.completedAt,
        }),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === input.id ? optimistic : item
        ),
      }));

      try {
        const updated = await invoke<FollowUpItem>("update_item", { input });
        set((state) => ({
          items: state.items.map((item) =>
            item.id === input.id ? updated : item
          ),
        }));
      } catch (err) {
        // 回滚
        set((state) => ({
          items: state.items.map((item) =>
            item.id === input.id ? prev : item
          ),
          error: String(err),
        }));
      }
    },

    deleteItem: async (id: number) => {
      // undo 快照 + 逆向 DB 操作（重新创建删除的项目）
      const removedItems = get().items.filter(
        (item) => item.id === id || item.parentId === id
      );
      pushUndoEntry(get().items, async () => {
        // 先重建父任务，再重建子任务
        const parent = removedItems.find((i) => i.id === id);
        const children = removedItems.filter((i) => i.parentId === id);
        if (parent) {
          const input: CreateItemInput = {
            title: parent.title,
            parentId: parent.parentId,
            owner: parent.owner,
            dueDate: parent.dueDate,
          };
          const restored = await invoke<FollowUpItem>("create_item", { input });
          // 恢复其他字段
          await invoke("update_item", {
            input: {
              id: restored.id,
              status: parent.status,
              waitingFor: parent.waitingFor,
              waitingSince: parent.waitingSince,
              links: parent.links,
              isEmphasized: parent.isEmphasized,
              notes: parent.notes,
              completedAt: parent.completedAt,
            },
          });
          await invoke("reorder_item", { id: restored.id, newSortOrder: parent.sortOrder });
          // 重建子任务
          for (const child of children) {
            const childInput: CreateItemInput = {
              title: child.title,
              parentId: restored.id,
              owner: child.owner,
              dueDate: child.dueDate,
            };
            const restoredChild = await invoke<FollowUpItem>("create_item", { input: childInput });
            await invoke("update_item", {
              input: {
                id: restoredChild.id,
                status: child.status,
                waitingFor: child.waitingFor,
                waitingSince: child.waitingSince,
                links: child.links,
                isEmphasized: child.isEmphasized,
                notes: child.notes,
                completedAt: child.completedAt,
              },
            });
            await invoke("reorder_item", { id: restoredChild.id, newSortOrder: child.sortOrder });
          }
        }
      });

      const removed = get().items.filter(
        (item) => item.id === id || item.parentId === id
      );
      // 乐观更新：同时移除父任务和其所有子任务
      set((state) => ({
        items: state.items.filter(
          (item) => item.id !== id && item.parentId !== id
        ),
        detailPanelItemId:
          state.detailPanelItemId === id ? null : state.detailPanelItemId,
      }));

      try {
        await invoke("delete_item", { id });
      } catch (err) {
        // 回滚：把移除的项重新加回
        set((state) => ({
          items: [...state.items, ...removed],
          error: String(err),
        }));
      }
    },

    reorderItem: async (id: number, newSortOrder: number) => {
      const prev = get().items.find((item) => item.id === id);
      if (!prev) return;

      // undo 快照 + 逆向 DB 操作（恢复旧排序）
      const oldSortOrder = prev.sortOrder;
      pushUndoEntry(get().items, async () => {
        await invoke("reorder_item", { id, newSortOrder: oldSortOrder });
      });

      // 乐观更新
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, sortOrder: newSortOrder } : item
        ),
      }));

      try {
        await invoke("reorder_item", { id, newSortOrder });
      } catch (err) {
        // 回滚
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? prev : item
          ),
          error: String(err),
        }));
      }
    },

    switchTab: (tab: TabId) => {
      set({ activeTab: tab });
    },

    toggleDetailPanel: (itemId?: number | null) => {
      set((state) => ({
        detailPanelItemId:
          itemId === undefined || itemId === state.detailPanelItemId
            ? null
            : itemId,
      }));
    },

    toggleExpandItem: (itemId: number) => {
      set((state) => {
        const next = new Set(state.expandedItemIds);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return { expandedItemIds: next };
      });
    },

    promoteSubtask: async (id: number) => {
      const prev = get().items.find((item) => item.id === id);
      if (!prev || prev.parentId === null) return;
      const oldParentId = prev.parentId;
      const oldStatus = prev.status;

      // undo 快照：逆向操作是把 parentId 和 status 都恢复原值
      pushUndoEntry(get().items, async () => {
        await invoke("set_item_parent", { id, newParentId: oldParentId });
        if (oldStatus !== "todo") {
          await invoke("update_item", { input: { id, status: oldStatus } });
        }
      });

      // 计算排在第一条的 sortOrder
      const topItems = get().items.filter((item) => item.parentId === null);
      const minOrder = topItems.length > 0 ? Math.min(...topItems.map((i) => i.sortOrder)) : 0;
      const newSortOrder = minOrder - 1000;

      // 乐观更新：parentId → null，status → "todo"，sortOrder → 第一条，lastCreatedItemId → id（触发 FollowUpItem 自动聚焦+selected）
      set((state) => {
        const newItems = state.items.map((item) =>
          item.id === id ? { ...item, parentId: null, status: "todo" as const, sortOrder: newSortOrder } : item
        );
        // 若原父任务已无子任务，从 expandedItemIds 中移除
        const hasRemainingChildren = newItems.some(
          (item) => item.parentId === oldParentId
        );
        const nextExpanded = new Set(state.expandedItemIds);
        if (!hasRemainingChildren) nextExpanded.delete(oldParentId);
        return { items: newItems, expandedItemIds: nextExpanded, lastCreatedItemId: id };
      });

      try {
        await invoke<FollowUpItem>("set_item_parent", { id, newParentId: null });
        const finalItem = await invoke<FollowUpItem>("update_item", { input: { id, status: "todo" } });
        await invoke("reorder_item", { id, newSortOrder });
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...finalItem, sortOrder: newSortOrder } : item)),
        }));
      } catch (err) {
        // 回滚
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? prev : item)),
          expandedItemIds: new Set([...state.expandedItemIds, oldParentId]),
          lastCreatedItemId: null,
          error: String(err),
        }));
      }
    },

    moveSubtaskToParent: async (subtaskId: number, newParentId: number) => {
      const prev = get().items.find((item) => item.id === subtaskId);
      if (!prev || prev.parentId === null) return;
      const oldParentId = prev.parentId;
      if (oldParentId === newParentId) return;

      // undo 快照
      pushUndoEntry(get().items, async () => {
        await invoke("set_item_parent", { id: subtaskId, newParentId: oldParentId });
      });

      // 乐观更新
      set((state) => {
        const newItems = state.items.map((item) =>
          item.id === subtaskId ? { ...item, parentId: newParentId } : item
        );
        const hasRemainingChildren = newItems.some(
          (item) => item.parentId === oldParentId
        );
        const nextExpanded = new Set(state.expandedItemIds);
        if (!hasRemainingChildren) nextExpanded.delete(oldParentId);
        nextExpanded.add(newParentId);
        return { items: newItems, expandedItemIds: nextExpanded };
      });

      try {
        await invoke<FollowUpItem>("set_item_parent", { id: subtaskId, newParentId });
      } catch (err) {
        // 回滚
        set((state) => ({
          items: state.items.map((item) => (item.id === subtaskId ? prev : item)),
          expandedItemIds: new Set([...state.expandedItemIds, oldParentId]),
          error: String(err),
        }));
      }
    },

    triggerQuickCreate: () =>
      set((s) => ({ quickCreateFocusTrigger: s.quickCreateFocusTrigger + 1 })),

    clearLastCreated: () => set({ lastCreatedItemId: null }),

    undo: async () => {
      const entry = undoStack.pop();
      if (!entry) return;
      // 保留当前折叠状态，避免 loadItems 重置
      const savedExpanded = new Set(get().expandedItemIds);
      // 恢复前端状态
      set({ items: entry.items });
      // 逆向 DB 操作，保持数据库同步
      try {
        await entry.reverseDb();
        // 从 DB 重新加载以确保 ID 等字段一致
        await get().loadItems();
        // 恢复折叠状态
        set({ expandedItemIds: savedExpanded });
      } catch {
        // reverseDb 失败时仍保留前端快照状态
      }
    },

    canUndo: () => undoStack.length > 0,
  })
);
