import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  selectTodayItems,
  selectLongTermItems,
  selectAllItems,
  selectChildren,
  useItemStore,
} from "./useItemStore";
import type { FollowUpItem } from "../types";
import { todayString } from "../utils/dates";

// ── Mock Tauri invoke ─────────────────────────────────────────────────────

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// 类型便利
const mockInvoke = vi.mocked(invoke);

// ── Test helpers ──────────────────────────────────────────────────────────

/** 构建最小 FollowUpItem，只需传入 id 和要覆盖的字段 */
function makeItem(overrides: Partial<FollowUpItem> & { id: number }): FollowUpItem {
  return {
    parentId: null,
    title: "Test item",
    status: "todo",
    waitingFor: null,
    waitingSince: null,
    owner: null,
    dueDate: null,
    links: "[]",
    isEmphasized: false,
    sortOrder: overrides.id,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

/** 初始 Store 状态（每个 action test 前 reset 用） */
const INITIAL_STATE = {
  items: [] as FollowUpItem[],
  activeTab: "today" as const,
  detailPanelItemId: null,
  expandedItemIds: new Set<number>(),
  isLoading: false,
  error: null,
};

// ── Selector：selectTodayItems ────────────────────────────────────────────

describe("selectTodayItems", () => {
  it("includes todo with null dueDate", () => {
    expect(selectTodayItems([makeItem({ id: 1, status: "todo", dueDate: null })])).toHaveLength(1);
  });

  it("includes waiting with null dueDate", () => {
    expect(selectTodayItems([makeItem({ id: 1, status: "waiting", dueDate: null })])).toHaveLength(1);
  });

  it("includes item due today", () => {
    expect(selectTodayItems([makeItem({ id: 1, dueDate: todayString() })])).toHaveLength(1);
  });

  it("includes overdue item (past date)", () => {
    expect(selectTodayItems([makeItem({ id: 1, dueDate: "2020-01-01" })])).toHaveLength(1);
  });

  it("excludes item due in the future", () => {
    expect(selectTodayItems([makeItem({ id: 1, dueDate: "2099-12-31" })])).toHaveLength(0);
  });

  it("excludes done items", () => {
    expect(selectTodayItems([makeItem({ id: 1, status: "done" })])).toHaveLength(0);
  });

  it("excludes long_term items", () => {
    expect(selectTodayItems([makeItem({ id: 1, status: "long_term" })])).toHaveLength(0);
  });

  it("excludes child items (parentId !== null)", () => {
    expect(
      selectTodayItems([makeItem({ id: 1, status: "todo", parentId: 99 })])
    ).toHaveLength(0);
  });

  it("returns multiple matching items", () => {
    const items = [
      makeItem({ id: 1, status: "todo" }),
      makeItem({ id: 2, status: "waiting" }),
      makeItem({ id: 3, status: "done" }),
    ];
    expect(selectTodayItems(items)).toHaveLength(2);
  });
});

// ── Selector：selectLongTermItems ─────────────────────────────────────────

describe("selectLongTermItems", () => {
  it("returns only long_term top-level items", () => {
    const items = [
      makeItem({ id: 1, status: "long_term" }),
      makeItem({ id: 2, status: "todo" }),
      makeItem({ id: 3, status: "long_term", parentId: 1 }),
    ];
    const result = selectLongTermItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns empty when no long_term items", () => {
    const items = [makeItem({ id: 1, status: "todo" })];
    expect(selectLongTermItems(items)).toHaveLength(0);
  });
});

// ── Selector：selectAllItems ──────────────────────────────────────────────

describe("selectAllItems", () => {
  it("returns only top-level items (parentId === null)", () => {
    const items = [
      makeItem({ id: 1 }),
      makeItem({ id: 2 }),
      makeItem({ id: 3, parentId: 1 }),
    ];
    expect(selectAllItems(items)).toHaveLength(2);
  });

  it("returns all statuses", () => {
    const items = [
      makeItem({ id: 1, status: "todo" }),
      makeItem({ id: 2, status: "done" }),
      makeItem({ id: 3, status: "long_term" }),
    ];
    expect(selectAllItems(items)).toHaveLength(3);
  });
});

// ── Selector：selectChildren ──────────────────────────────────────────────

describe("selectChildren", () => {
  it("returns children of the specified parent", () => {
    const items = [
      makeItem({ id: 1 }),
      makeItem({ id: 2, parentId: 1 }),
      makeItem({ id: 3, parentId: 1 }),
      makeItem({ id: 4, parentId: 99 }),
    ];
    const result = selectChildren(items, 1);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual([2, 3]);
  });

  it("returns empty array when no children", () => {
    expect(selectChildren([makeItem({ id: 1 })], 1)).toHaveLength(0);
  });
});

// ── Store actions ─────────────────────────────────────────────────────────

describe("useItemStore actions", () => {
  beforeEach(() => {
    useItemStore.setState({ ...INITIAL_STATE, expandedItemIds: new Set() });
  });

  // ── toggleDetailPanel ──

  describe("toggleDetailPanel", () => {
    it("opens panel with given ID", () => {
      useItemStore.getState().toggleDetailPanel(42);
      expect(useItemStore.getState().detailPanelItemId).toBe(42);
    });

    it("closes panel when toggling the same ID", () => {
      useItemStore.setState({ detailPanelItemId: 42 });
      useItemStore.getState().toggleDetailPanel(42);
      expect(useItemStore.getState().detailPanelItemId).toBeNull();
    });

    it("closes panel when called with undefined", () => {
      useItemStore.setState({ detailPanelItemId: 42 });
      useItemStore.getState().toggleDetailPanel(undefined);
      expect(useItemStore.getState().detailPanelItemId).toBeNull();
    });

    it("switches to a different item ID", () => {
      useItemStore.setState({ detailPanelItemId: 1 });
      useItemStore.getState().toggleDetailPanel(2);
      expect(useItemStore.getState().detailPanelItemId).toBe(2);
    });
  });

  // ── toggleExpandItem ──

  describe("toggleExpandItem", () => {
    it("adds item to expandedItemIds", () => {
      useItemStore.getState().toggleExpandItem(5);
      expect(useItemStore.getState().expandedItemIds.has(5)).toBe(true);
    });

    it("removes item when already expanded", () => {
      useItemStore.setState({ expandedItemIds: new Set([5]) });
      useItemStore.getState().toggleExpandItem(5);
      expect(useItemStore.getState().expandedItemIds.has(5)).toBe(false);
    });

    it("does not affect other items in set", () => {
      useItemStore.setState({ expandedItemIds: new Set([1, 2]) });
      useItemStore.getState().toggleExpandItem(1);
      expect(useItemStore.getState().expandedItemIds.has(2)).toBe(true);
    });
  });

  // ── switchTab ──

  describe("switchTab", () => {
    it("switches to the given tab", () => {
      useItemStore.getState().switchTab("all");
      expect(useItemStore.getState().activeTab).toBe("all");
    });

    it("can switch back to today", () => {
      useItemStore.setState({ activeTab: "all" });
      useItemStore.getState().switchTab("today");
      expect(useItemStore.getState().activeTab).toBe("today");
    });
  });

  // ── deleteItem (optimistic) ──

  describe("deleteItem — optimistic update", () => {
    beforeEach(() => {
      // invoke 返回永不 resolve 的 Promise，仅测试同步乐观更新
      mockInvoke.mockReturnValue(new Promise(() => {}));
    });

    it("removes the item immediately", () => {
      useItemStore.setState({
        items: [makeItem({ id: 1 }), makeItem({ id: 2 })],
      });
      useItemStore.getState().deleteItem(1);
      const { items } = useItemStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(2);
    });

    it("also removes child items", () => {
      useItemStore.setState({
        items: [
          makeItem({ id: 1 }),
          makeItem({ id: 2, parentId: 1 }),
          makeItem({ id: 3 }),
        ],
      });
      useItemStore.getState().deleteItem(1);
      const { items } = useItemStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(3);
    });

    it("clears detailPanelItemId when deleting the open item", () => {
      useItemStore.setState({
        items: [makeItem({ id: 1 })],
        detailPanelItemId: 1,
      });
      useItemStore.getState().deleteItem(1);
      expect(useItemStore.getState().detailPanelItemId).toBeNull();
    });

    it("keeps detailPanelItemId when deleting a different item", () => {
      useItemStore.setState({
        items: [makeItem({ id: 1 }), makeItem({ id: 2 })],
        detailPanelItemId: 2,
      });
      useItemStore.getState().deleteItem(1);
      expect(useItemStore.getState().detailPanelItemId).toBe(2);
    });
  });

  // ── createItem (optimistic) ──

  describe("createItem — optimistic update", () => {
    it("adds optimistic item with negative temp ID immediately", () => {
      mockInvoke.mockReturnValue(new Promise(() => {}));

      useItemStore.getState().createItem("New task");

      const { items } = useItemStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("New task");
      expect(items[0].id).toBeLessThan(0); // 临时负数 ID
      expect(items[0].status).toBe("todo");
      expect(items[0].parentId).toBeNull();
    });

    it("replaces temp item with real item on success", async () => {
      const realItem = makeItem({ id: 100, title: "New task" });
      mockInvoke.mockResolvedValue(realItem);

      await useItemStore.getState().createItem("New task");

      const { items } = useItemStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(100);
    });

    it("rolls back on failure", async () => {
      mockInvoke.mockRejectedValue(new Error("DB error"));

      await useItemStore.getState().createItem("Bad task");

      expect(useItemStore.getState().items).toHaveLength(0);
      expect(useItemStore.getState().error).toContain("DB error");
    });

    it("updates detailPanelItemId to real ID after success", async () => {
      const realItem = makeItem({ id: 200, title: "Task" });
      mockInvoke.mockResolvedValue(realItem);

      // 先启动 createItem，在替换前面板打开了临时 ID（模拟）
      const createPromise = useItemStore.getState().createItem("Task");
      // 乐观条目已在 store 中，获取 temp ID 并打开面板
      const tempId = useItemStore.getState().items[0].id;
      useItemStore.setState({ detailPanelItemId: tempId });
      await createPromise;

      // 面板 ID 应已更新为真实 ID
      expect(useItemStore.getState().detailPanelItemId).toBe(200);
    });
  });
});
