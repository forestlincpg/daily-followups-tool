import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FollowUpItem } from "../../types";
import { FollowUpItem as FollowUpItemComponent } from "./FollowUpItem";
import { useItemStore } from "../../stores/useItemStore";

interface DraggableListProps {
  items: FollowUpItem[];
  ariaLabel?: string;
  /** 仅因子任务匹配而显示的父任务 ID 集合（半透明展示） */
  ghostParentIds?: Set<number>;
}

/**
 * DraggableList — 可拖拽排序的列表容器（Story 4.3）
 *
 * 拖拽手柄：FollowUpItem 内的 ⠿ 图标
 * 排序完成后通过 reorderItem 更新 sort_order（取前后相邻项中间值）
 */
export function DraggableList({ items, ariaLabel = "跟进项列表", ghostParentIds }: DraggableListProps) {
  const reorderItem = useItemStore((s) => s.reorderItem);
  const [subtaskFocusTriggers, setSubtaskFocusTriggers] = useState<Record<number, number>>({});

  function handleRowEnter(id: number) {
    setSubtaskFocusTriggers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const prev = reordered[newIndex - 1];
    const next = reordered[newIndex + 1];
    const prevOrder = prev ? prev.sortOrder : 0;
    const nextOrder = next ? next.sortOrder : items[items.length - 1].sortOrder + 1000;
    await reorderItem(Number(active.id), (prevOrder + nextOrder) / 2);
  }

  async function handleKeyMove(id: number, dir: 1 | -1) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1 || items.length <= 1) return;
    // 头尾循环：首条向上 → 置底；末条向下 → 置顶
    const newIdx = (idx + dir + items.length) % items.length;
    const reordered = arrayMove(items, idx, newIdx);

    let newSortOrder: number;
    const prev = reordered[newIdx - 1];
    const next = reordered[newIdx + 1];

    if (!prev) {
      // 置顶：小于当前最小值 1000
      const minOrder = Math.min(...items.map((i) => i.sortOrder));
      newSortOrder = minOrder - 1000;
    } else if (!next) {
      // 置底：大于当前最大值 1000
      const maxOrder = Math.max(...items.map((i) => i.sortOrder));
      newSortOrder = maxOrder + 1000;
    } else {
      newSortOrder = (prev.sortOrder + next.sortOrder) / 2;
    }

    await reorderItem(id, newSortOrder);
  }

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={itemIds}
        strategy={verticalListSortingStrategy}
      >
        <ul role="list" aria-label={ariaLabel} className="flex-1 overflow-auto">
          {items.map((item) => (
            <SortableFollowUpItem
              key={item.id}
              item={item}
              onKeyMove={handleKeyMove}
              onRowEnter={handleRowEnter}
              externalFocusTrigger={subtaskFocusTriggers[item.id] ?? 0}
              isGhostParent={ghostParentIds?.has(item.id) ?? false}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/**
 * SortableFollowUpItem — 可拖拽的 FollowUpItem 包装器
 *
 * 拖拽激活时整行有轻微 opacity 提升效果
 * 键盘 ArrowUp/ArrowDown 可调整顺序
 */
function SortableFollowUpItem({
  item,
  onKeyMove,
  onRowEnter,
  externalFocusTrigger,
  isGhostParent,
}: {
  item: FollowUpItem;
  onKeyMove: (id: number, dir: 1 | -1) => void;
  onRowEnter: (id: number) => void;
  externalFocusTrigger: number;
  isGhostParent?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  // 只保留 translate，去掉 dnd-kit 默认的 scaleX/scaleY 压缩
  const cleanTransform = transform
    ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 })
    : undefined;

  const style: React.CSSProperties = {
    transform: cleanTransform,
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' as const : undefined,
    boxShadow: isDragging
      ? '0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.10)'
      : undefined,
    borderRadius: isDragging ? 8 : undefined,
    background: isDragging ? 'var(--colorNeutralBackground1, #fff)' : undefined,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-describedby={attributes['aria-describedby']}
      tabIndex={-1}
      role="presentation"
      className="outline-none"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onRowEnter(item.id);
        }
      }}
    >
      <FollowUpItemComponent
        item={item}
        dragHandleRef={setActivatorNodeRef}
        dragHandleListeners={listeners}
        isDragging={isDragging}
        externalFocusTrigger={externalFocusTrigger}
        onKeyMove={onKeyMove}
        isGhostParent={isGhostParent}
      />
    </div>
  );
}
