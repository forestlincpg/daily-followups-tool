import { useState, useMemo } from "react";
import { ChevronRightRegular } from "@fluentui/react-icons";
import { useItemStore, selectAllItems } from "../../stores/useItemStore";
import { DraggableList } from "../items/DraggableList";
import { QuickCreateInput } from "../inputs/QuickCreateInput";
import { getVisibleNavTargets } from "../../utils/focusManager";
import type { FollowUpItem } from "../../types";

interface SectionProps {
  title: string;
  items: FollowUpItem[];
  ariaLabel: string;
  defaultExpanded?: boolean;
}

function StatusSection({ title, items, ariaLabel, defaultExpanded = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!expanded) setExpanded(true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (expanded) setExpanded(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const allRows = getVisibleNavTargets();
      const idx = allRows.findIndex((el) => el === e.currentTarget);
      const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const wrapped = (next + allRows.length) % allRows.length;
      allRows[wrapped].focus();
    }
  }

  return (
    <>
      <button
        type="button"
        data-section-header
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-sm px-xl py-[5px] border-t border-surface-border text-body font-medium text-content-secondary hover:bg-surface-hover focus:bg-surface-hover transition-colors w-full sticky top-0 bg-surface-bg z-10"
      >
        <span className="transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "none" }}>
          <ChevronRightRegular fontSize={12} />
        </span>
        {title}（{items.length}）
      </button>
      {expanded && (
        items.length === 0
          ? <p className="px-xl py-xs text-body text-content-secondary opacity-40">暂无</p>
          : <DraggableList items={items} ariaLabel={ariaLabel} />
      )}
    </>
  );
}

/**
 * AllItemsView — 全部视图
 * 按状态分组展示：待办 → 等待他人 → 长期跟进 → 已完成（默认折叠）
 */
export function AllItemsView() {
  const items = useItemStore((s) => s.items);
  const createItem = useItemStore((s) => s.createItem);
  const isLoading = useItemStore((s) => s.isLoading);
  const allItems = selectAllItems(items);

  const todoItems = useMemo(() => allItems.filter((i) => i.status === "todo"), [allItems]);
  const waitingItems = useMemo(() => allItems.filter((i) => i.status === "waiting"), [allItems]);
  const longTermItems = useMemo(() => allItems.filter((i) => i.status === "long_term"), [allItems]);
  const doneItems = useMemo(() => allItems.filter((i) => i.status === "done"), [allItems]);

  return (
    <div>
      <QuickCreateInput
        onCreate={(title, waitingFor, dueDate) => createItem(title, null, null, dueDate, waitingFor)}
        disabled={isLoading}
      />

      {allItems.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-body text-content-secondary">还没有跟进项 — 顶部输入框创建第一个</p>
        </div>
      ) : (
        <>
          <StatusSection title="待办" items={todoItems} ariaLabel="待办跟进项" defaultExpanded={true} />
          <StatusSection title="等待他人" items={waitingItems} ariaLabel="等待他人跟进项" defaultExpanded={true} />
          <StatusSection title="长期跟进" items={longTermItems} ariaLabel="长期跟进项" defaultExpanded={true} />
          <StatusSection title="已完成" items={doneItems} ariaLabel="已完成跟进项" defaultExpanded={false} />
        </>
      )}
    </div>
  );
}
