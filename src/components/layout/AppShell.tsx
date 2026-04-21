import { useEffect, useMemo } from "react";
import { Body1, tokens } from "@fluentui/react-components";
import { TABS, NAV_TAB_IDS } from "../../types";
import { useItemStore, selectTodayFocusData } from "../../stores/useItemStore";
import { SEL_NAV_TARGETS } from "../../utils/focusManager";
import { TopTabBar } from "./TopTabBar";
import { QuickCreateInput } from "../inputs/QuickCreateInput";
import { DraggableList } from "../items/DraggableList";
import { LongTermView } from "../views/LongTermView";
import { AllItemsView } from "../views/AllItemsView";
import { DoneView } from "../views/DoneView";
import { ExportView } from "../views/ExportView";
import { KeyboardShortcutsView } from "../views/KeyboardShortcutsView";

/**
 * AppShell — 应用主框架
 *
 * 布局结构：
 * ┌─ TopTabBar ────────────────────────────────┐
 * │ [今日聚焦]  [全部]  [长期跟进]    [导出]     │
 * ├────────────────────────────────────────────┤
 * │                                            │
 * │            视图内容区（占满剩余高度）         │
 * │                                            │
 * └────────────────────────────────────────────┘
 */
export function AppShell() {
  const activeTab = useItemStore((s) => s.activeTab);
  const switchTab = useItemStore((s) => s.switchTab);
  const loadItems = useItemStore((s) => s.loadItems);
  const createItem = useItemStore((s) => s.createItem);
  const isLoading = useItemStore((s) => s.isLoading);
  const items = useItemStore((s) => s.items);
  const triggerQuickCreate = useItemStore((s) => s.triggerQuickCreate);
  const undo = useItemStore((s) => s.undo);
  // 今日聚焦：待办+等待他人，截止日期为今天或未设置；含因子任务匹配纳入的幽灵父任务
  const { items: todayItems, ghostParentIds } = useMemo(() => selectTodayFocusData(items), [items]);

  // 应用启动时加载全部跟进项
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 切换 Tab 或首次加载完成后，自动聚焦当前视图的第一条跟进项
  useEffect(() => {
    if (isLoading) return;
    if (activeTab === "export" || activeTab === "shortcuts") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const panel = document.getElementById(`tabpanel-${activeTab}`);
        if (!panel) return;
        const firstItem = panel.querySelector<HTMLElement>(SEL_NAV_TARGETS);
        if (firstItem) { firstItem.focus(); return; }
        const input = panel.querySelector<HTMLElement>('input');
        if (input) input.focus();
      });
    });
  }, [activeTab, isLoading]);

  // 全局 Ctrl+C：聚焦到当前视图的快速创建输入框
  // 全局快捷键：Ctrl+Tab 切换视图（在捕获阶段拦截，避免被 WebView2 吃掉）
  // 全局 Ctrl+S：阻止 WebView2 默认的"保存网页"行为，让事件继续传播到 React onKeyDown
  useEffect(() => {
    function tabHandler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const currentTab = useItemStore.getState().activeTab;
        const idx = NAV_TAB_IDS.indexOf(currentTab);
        const next = idx === -1 ? 0 : (idx + 1) % NAV_TAB_IDS.length;
        switchTab(NAV_TAB_IDS[next]);
      }
      // Ctrl+S：仅 preventDefault 阻止浏览器保存，不 stopPropagation，让 React 组件处理
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", tabHandler, true);
    return () => window.removeEventListener("keydown", tabHandler, true);
  }, [switchTab]);

  // 全局 Ctrl+Z：撤回上一步操作
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey) return;

      if (e.key === "z") {
        const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        undo();
        return;
      }

      if (e.key !== "c") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable;
      // 有文字选中时保留浏览器复制行为
      if (isEditable || (document.getSelection()?.toString() ?? "") !== "") return;
      e.preventDefault();
      triggerQuickCreate();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [triggerQuickCreate, undo]);

  return (
    <div className="flex flex-col h-screen bg-surface-bg overflow-hidden">
      {/* 顶栏 Tab 导航 */}
      <TopTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={switchTab}
      />

      {/* 视图主体内容区 */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">
        {/* 今日聚焦 */}
        <div
          role="tabpanel"
          id="tabpanel-today"
          aria-labelledby="tab-today"
          className={activeTab === "today" ? "h-full flex flex-col" : "hidden"}
        >
          {/* 快速创建输入框 */}
          <QuickCreateInput
            onCreate={(title, waitingFor, dueDate) => createItem(title, null, null, dueDate, waitingFor)}
            disabled={isLoading}
          />

          {todayItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
                没有待办事项 — 享受你的一天
              </Body1>
            </div>
          ) : (
            <DraggableList
              items={todayItems}
              ariaLabel="今日聚焦跟进项列表"
              ghostParentIds={ghostParentIds}
            />
          )}
        </div>

        {/* 全部 */}
        <div
          role="tabpanel"
          id="tabpanel-all"
          aria-labelledby="tab-all"
          className={activeTab === "all" ? "h-full overflow-auto" : "hidden"}
        >
          <AllItemsView />
        </div>

        {/* 长期跟进 */}
        <div
          role="tabpanel"
          id="tabpanel-long_term"
          aria-labelledby="tab-long_term"
          className={activeTab === "long_term" ? "h-full" : "hidden"}
        >
          <LongTermView />
        </div>

        {/* 已完成 */}
        <div
          role="tabpanel"
          id="tabpanel-done"
          aria-labelledby="tab-done"
          className={activeTab === "done" ? "h-full" : "hidden"}
        >
          <DoneView />
        </div>

        {/* 导出 */}
        <div
          role="tabpanel"
          id="tabpanel-export"
          aria-labelledby="tab-export"
          className={activeTab === "export" ? "h-full" : "hidden"}
        >
          <ExportView />
        </div>

        {/* 快捷键 */}
        <div
          role="tabpanel"
          id="tabpanel-shortcuts"
          aria-labelledby="tab-shortcuts"
          className={activeTab === "shortcuts" ? "h-full overflow-auto" : "hidden"}
        >
          <KeyboardShortcutsView />
        </div>
      </main>
      </div>
    </div>
  );
}
