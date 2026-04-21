import { useState, useEffect, useRef, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useItemStore, selectChildren } from "../../stores/useItemStore";
import { SubtaskItem } from "./SubtaskItem";
import { InlineSubtaskInput } from "../inputs/InlineSubtaskInput";
import { tokens } from "@fluentui/react-components";
import { todayString } from "../../utils/dates";

interface SubtaskExpandAreaProps {
  parentId: number;
  /** 自增计数器，如果大于 0 则自动聚焦子任务输入框 */
  focusInput?: number;
  /** 幽灵父任务模式：仅显示匹配今日聚焦条件的子任务 */
  ghostFilter?: boolean;
}

/**
 * SubtaskExpandArea — 子任务展开区域
 *
 * 结构：
 *   父任务行
 *   └── SubtaskExpandArea（缩进 pl-8）
 *       ├── SubtaskItem 1
 *       ├── SubtaskItem 2
 *       └── InlineSubtaskInput（底部创建框）
 *
 * 展开状态：由 store.expandedItemIds 维护（切 Tab 不丢失状态）
 */
export function SubtaskExpandArea({ parentId, focusInput = 0, ghostFilter = false }: SubtaskExpandAreaProps) {
  const items = useItemStore((s) => s.items);
  const reorderItem = useItemStore((s) => s.reorderItem);
  const promoteSubtask = useItemStore((s) => s.promoteSubtask);
  const allSubtasks = useMemo(() => selectChildren(items, parentId), [items, parentId]);
  // 幽灵父任务模式：仅显示匹配今日聚焦的子任务
  const today = useMemo(() => todayString(), []);
  const subtasks = useMemo(
    () =>
      ghostFilter
        ? allSubtasks.filter(
            (s) =>
              (s.status === "todo" || s.status === "waiting") &&
              (s.dueDate === null || s.dueDate <= today)
          )
        : allSubtasks,
    [allSubtasks, ghostFilter, today]
  );

  async function handleKeyMove(id: number, dir: 1 | -1) {
    const idx = subtasks.findIndex((s) => s.id === id);
    if (idx === -1 || subtasks.length <= 1) return;
    const newIdx = (idx + dir + subtasks.length) % subtasks.length;
    const reordered = arrayMove(subtasks, idx, newIdx);

    let newSortOrder: number;
    const prev = reordered[newIdx - 1];
    const next = reordered[newIdx + 1];

    if (!prev) {
      // 截止日期置顶：小于当前最小值 1000
      const minOrder = Math.min(...subtasks.map((s) => s.sortOrder));
      newSortOrder = minOrder - 1000;
    } else if (!next) {
      // 循环到尾部：大于当前最大值 1000
      const maxOrder = Math.max(...subtasks.map((s) => s.sortOrder));
      newSortOrder = maxOrder + 1000;
    } else {
      newSortOrder = (prev.sortOrder + next.sortOrder) / 2;
    }

    await reorderItem(id, newSortOrder);
  }

  // 合并焦点触发来源：父任务 Tab → focusInput 自增 | 子任务行 Enter → sibling focus
  const [internalFocus, setInternalFocus] = useState(0);
  const prevFocusInputRef = useRef(focusInput);
  useEffect(() => {
    if (focusInput !== prevFocusInputRef.current) {
      prevFocusInputRef.current = focusInput;
      setInternalFocus((c) => c + 1);
    }
  }, [focusInput]);

  return (
    <div
      role="list"
      aria-label="子任务列表"
      className="ml-6 pl-4 border-l"
      style={{ borderColor: tokens.colorBrandStroke1, opacity: 0.85 }}
    >
      {/* 子任务列表 */}
      {subtasks.map((sub) => (
        <SubtaskItem
          key={sub.id}
          item={sub}
          onRequestSiblingFocus={() => setInternalFocus((c) => c + 1)}
          onRequestInputFocus={() => setInternalFocus((c) => c + 1)}
          onKeyMove={handleKeyMove}
          onPromote={() => promoteSubtask(sub.id)}
        />
      ))}

      {/* 内联创建框 */}
      <InlineSubtaskInput parentId={parentId} autoFocus={internalFocus} />
    </div>
  );
}
