import React from "react";
import { Badge, tokens } from "@fluentui/react-components";
import { StarFilled, StarRegular, CheckmarkRegular, CalendarFilled } from "@fluentui/react-icons";
import { arrayMove } from "@dnd-kit/sortable";
import type { FollowUpItem, UpdateItemInput } from "../../types";
import { formatDateDisplay } from "../../utils/dates";
import { parseQuickInput } from "../../utils/parseQuickInput";
import { focusFallbackAfterRemove as focusFallbackAfterRemoveShared, getVisibleNavTargets, getDateUrgency } from "../../utils/focusManager";
import { StatusBadge } from "../controls/StatusBadge";
import type { StatusBadgeHandle } from "../controls/StatusBadge";
import { useItemStore, selectChildren } from "../../stores/useItemStore";
import { InlineEditor } from "../inputs/InlineEditor";
import { DatePicker } from "../controls/DatePicker";
import { StatusHistoryPopover } from "../panels/StatusHistoryPopover";

interface SubtaskItemProps {
  item: FollowUpItem;
  /** 按 Enter 时请求聚焦到同级子任务输入框 */
  onRequestSiblingFocus?: () => void;
  /** 按 → 时请求聚焦到本展开区域底部输入框 */
  onRequestInputFocus?: () => void;
  /** Ctrl+上下键重排序，由父级提供 */
  onKeyMove?: (id: number, dir: 1 | -1) => void;
  /** Ctrl+Shift+↑ 将子任务提升为主任务 */
  onPromote?: () => void;
}



/**
 * SubtaskItem — 子任务行（缩进，布局同 FollowUpItem 去掉拖拽手柄）
 *
 * 已完成子任务：灰色 + 删除线
 * hover：bg-surface-hover
 */
export const SubtaskItem = React.memo(function SubtaskItem({ item, onRequestInputFocus, onKeyMove, onPromote }: SubtaskItemProps) {
  const updateItem = useItemStore((s) => s.updateItem);
  const deleteItem = useItemStore((s) => s.deleteItem);
  const toggleExpandItem = useItemStore((s) => s.toggleExpandItem);
  const lastCreatedItemId = useItemStore((s) => s.lastCreatedItemId);
  const clearLastCreated = useItemStore((s) => s.clearLastCreated);
  const dateUrgency = getDateUrgency(item.status, item.dueDate);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const statusBadgeRef = React.useRef<StatusBadgeHandle>(null);
  const [titleFocusTrigger, setTitleFocusTrigger] = React.useState(0);
  const [historyPopover, setHistoryPopover] = React.useState<{ x: number; y: number } | null>(null);

  // 自动聚焦新创建的子任务，或状态切换后重新聚焦
  React.useEffect(() => {
    if (lastCreatedItemId === item.id && rowRef.current) {
      rowRef.current.focus();
      clearLastCreated();
    }
  }, [lastCreatedItemId, item.id, clearLastCreated]);

  // ── Pointer-based 子任务拖拽（同父排序 + 跨父移动）──────────────
  const handleDragHandlePointerDown = (e: React.PointerEvent) => {
    if (!item.parentId) return;
    e.preventDefault(); // 防止 text selection
    e.stopPropagation(); // 防止冒泡到父级
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let ghost: HTMLElement | null = null;
    let currentHighlight: HTMLElement | null = null;
    let dropTarget: { type: 'parent'; id: number } | { type: 'sibling'; id: number; dir: 'before' | 'after' } | null = null;

    const clearHighlight = () => {
      if (currentHighlight) {
        currentHighlight.style.outline = '';
        currentHighlight.style.outlineOffset = '';
        currentHighlight.style.borderRadius = '';
        currentHighlight.style.background = '';
        currentHighlight.style.borderTop = '';
        currentHighlight.style.borderBottom = '';
        currentHighlight = null;
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy < 25) return; // 5px 阈值
        active = true;
        ghost = document.createElement('div');
        const label = item.title.length > 30 ? item.title.slice(0, 30) + '…' : item.title;
        ghost.textContent = `↗ ${label}`;
        ghost.style.cssText = [
          'position:fixed;z-index:9999;pointer-events:none',
          'padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500',
          `background:${tokens.colorNeutralBackground1}`,
          `color:${tokens.colorNeutralForeground1}`,
          `border:1px solid ${tokens.colorNeutralStroke1}`,
          'box-shadow:0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.10)',
          'white-space:nowrap;transform:translate(12px,-50%)',
        ].join(';');
        document.body.appendChild(ghost);
        if (rowRef.current) {
          rowRef.current.style.opacity = '0.4';
          rowRef.current.style.background = tokens.colorNeutralBackground3;
          rowRef.current.style.borderRadius = '4px';
        }
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }

      const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!elUnder) { clearHighlight(); dropTarget = null; return; }

      // 1) 检测是否拖到同父兄弟子任务上（div[data-item-id]，排除自身）
      const siblingDiv = elUnder.closest('div[data-item-id]') as HTMLElement | null;
      if (siblingDiv && siblingDiv !== rowRef.current) {
        const sibId = Number(siblingDiv.dataset.itemId);
        const sibItem = useItemStore.getState().items.find(i => i.id === sibId);
        if (sibItem && sibItem.parentId === item.parentId) {
          const rect = siblingDiv.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dir = ev.clientY < midY ? 'before' : 'after';
          if (currentHighlight !== siblingDiv) {
            clearHighlight();
            currentHighlight = siblingDiv;
          }
          siblingDiv.style.outline = '';
          siblingDiv.style.background = '';
          siblingDiv.style.borderTop = dir === 'before' ? `2px solid ${tokens.colorBrandStroke1}` : '';
          siblingDiv.style.borderBottom = dir === 'after' ? `2px solid ${tokens.colorBrandStroke1}` : '';
          dropTarget = { type: 'sibling', id: sibId, dir };
          return;
        }
      }

      // 2) 检测是否拖到另一个主任务行上（li[data-item-id]）
      const targetLi = elUnder.closest('li[data-item-id]') as HTMLElement | null;
      if (targetLi) {
        const targetId = Number(targetLi.dataset.itemId);
        if (targetId !== item.parentId) {
          if (currentHighlight !== targetLi) {
            clearHighlight();
            targetLi.style.outline = `2px solid ${tokens.colorBrandStroke1}`;
            targetLi.style.outlineOffset = '-2px';
            targetLi.style.borderRadius = '4px';
            targetLi.style.background = tokens.colorBrandBackground2;
            currentHighlight = targetLi;
          }
          dropTarget = { type: 'parent', id: targetId };
          return;
        }
      }

      clearHighlight();
      dropTarget = null;
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', safeOnMove);
      document.removeEventListener('pointerup', handleUp);
      if (ghost) ghost.remove();
      if (rowRef.current) {
        rowRef.current.style.opacity = '';
        rowRef.current.style.background = '';
        rowRef.current.style.borderRadius = '';
      }
      clearHighlight();
    };

    const handleUp = () => {
      cleanup();
      if (active && dropTarget) {
        const store = useItemStore.getState();
        if (dropTarget.type === 'parent') {
          store.moveSubtaskToParent(item.id, dropTarget.id);
        } else if (dropTarget.type === 'sibling') {
          const siblings = selectChildren(store.items, item.parentId!);
          const targetIdx = siblings.findIndex(s => s.id === dropTarget!.id);
          if (targetIdx === -1) return;
          const selfIdx = siblings.findIndex(s => s.id === item.id);
          if (selfIdx === targetIdx) return;

          let insertIdx = dropTarget.dir === 'before' ? targetIdx : targetIdx + 1;
          if (selfIdx < insertIdx) insertIdx--;
          if (insertIdx === selfIdx) return;

          const reordered = arrayMove(siblings, selfIdx, insertIdx);
          const prev = reordered[insertIdx - 1];
          const next = reordered[insertIdx + 1];
          let newSortOrder: number;
          if (!prev) {
            newSortOrder = Math.min(...siblings.map(s => s.sortOrder)) - 1000;
          } else if (!next) {
            newSortOrder = Math.max(...siblings.map(s => s.sortOrder)) + 1000;
          } else {
            newSortOrder = (prev.sortOrder + next.sortOrder) / 2;
          }
          store.reorderItem(item.id, newSortOrder);
        }
      }
    };

    const safeOnMove = (ev: PointerEvent) => {
      try {
        onMove(ev);
      } catch {
        cleanup();
      }
    };

    // 使用 document 级别 pointermove/pointerup（与 pointerdown 匹配）
    document.addEventListener('pointermove', safeOnMove);
    document.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      ref={rowRef}
      role="listitem"
      tabIndex={0}
      data-item-id={item.id}
      onKeyDown={(e) => {
        // 当焦点在 input/textarea 里时，只允许 Ctrl 组合键通过
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if ((tag === "INPUT" || tag === "TEXTAREA") && !e.ctrlKey) return;

        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          setTitleFocusTrigger((n) => n + 1);
        }
        // Ctrl+上下点：在同级子任务中循环重排序
        if (e.ctrlKey && e.key === "ArrowUp") {
          // Ctrl+Shift+ArrowUp: 提升子任务为主任务
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onPromote?.();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          onKeyMove?.(item.id, -1);
          return;
        }
        if (e.ctrlKey && e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          onKeyMove?.(item.id, 1);
          return;
        }
        // Ctrl+B: 切换强调（阶止冒泡到父任务）
        if (e.ctrlKey && e.key.toLowerCase() === "b") {
          e.preventDefault();
          e.stopPropagation();
          updateItem({ id: item.id, isEmphasized: !item.isEmphasized });
          return;
        }        // Ctrl+S: 打开状态选择器
        if (e.ctrlKey && e.key.toLowerCase() === "s") {
          e.preventDefault();
          e.stopPropagation();
          statusBadgeRef.current?.openPicker();
          return;
        }
        // Ctrl+Backspace: 删除子任务
        if (e.ctrlKey && e.key === "Backspace") {
          e.preventDefault();
          e.stopPropagation();
          focusFallbackAfterRemoveShared(e.currentTarget as HTMLElement);
          deleteItem(item.id);
          return;
        }
        // 右箭头：直接跳到本父任务的子任务输入框
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          onRequestInputFocus?.();
          return;
        }
        // 左箭头：折叠子任务区域，焦点回到父任务
        if (e.key === "ArrowLeft" && item.parentId) {
          e.preventDefault();
          e.stopPropagation();
          toggleExpandItem(item.parentId);
          const parentLi = (e.currentTarget as HTMLElement).closest('li[role="listitem"]');
          if (parentLi instanceof HTMLElement) {
            requestAnimationFrame(() => parentLi.focus());
          }
          return;
        }
        // 上下键导航：在所有可见的 listitem 之间切换
        if (!e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          const tag = (document.activeElement as HTMLElement)?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          e.preventDefault();
          e.stopPropagation();
          const allRows = getVisibleNavTargets();
          let idx = allRows.findIndex((el) => el === document.activeElement);
          if (idx === -1) {
            // findLastIndex 不在 ES2020，改用倒序查找
            for (let i = allRows.length - 1; i >= 0; i--) {
              if (allRows[i].contains(document.activeElement)) { idx = i; break; }
            }
          }
          const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
          const wrapped = (next + allRows.length) % allRows.length;
          allRows[wrapped].focus();
        }
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setHistoryPopover({ x: e.clientX, y: e.clientY }); }}
      className={[
        "group flex items-center gap-sm pl-lg py-sm",
        "border-b border-surface-border last:border-0",
        "cursor-default select-none",
        item.isEmphasized ? "bg-emphasis" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        outline: "none",
      }}
      onMouseEnter={(e) => {
        if (!e.currentTarget.matches(':focus')) {
          e.currentTarget.style.background = tokens.colorNeutralBackground1Hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.matches(':focus')) {
          e.currentTarget.style.background = item.isEmphasized ? '' : '';
        }
      }}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.style.background = tokens.colorNeutralBackground1Selected;
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.background = '';
      }}
    >
      {/* 拖拽手柄：pointer-based 跨父拖拽 */}
      <span
        aria-hidden="true"
        className="text-content-secondary opacity-0 group-hover:opacity-30 shrink-0 text-xs leading-none cursor-grab active:cursor-grabbing touch-none"
        title="拖拽到其他任务"
        onPointerDown={handleDragHandlePointerDown}
      >
        ⠿
      </span>

      {/* 状态标签（最左） */}
      <StatusBadge ref={statusBadgeRef} item={item} />

      {/* 强调星标 */}
      <button
        type="button"
        aria-label={item.isEmphasized ? "取消强调" : "标记为重要"}
        onClick={() =>
          updateItem({ id: item.id, isEmphasized: !item.isEmphasized })
        }
        className="shrink-0 transition-colors"
        style={{ color: item.isEmphasized ? tokens.colorPaletteYellowForeground1 : tokens.colorNeutralForeground4 }}
      >
        {item.isEmphasized ? <StarFilled fontSize={14} /> : <StarRegular fontSize={14} />}
      </button>

      {/* 标题 */}
      <InlineEditor
        value={item.title}
        onSave={(t) => {
          const { title, waitingFor, dueDate } = parseQuickInput(t);
          const updates: UpdateItemInput = { id: item.id, title: title || t };
          if (waitingFor) {
            updates.waitingFor = waitingFor;
          }
          if (dueDate) updates.dueDate = dueDate;
          updateItem(updates);
        }}
        ariaLabel="编辑子任务标题"
        focusTrigger={titleFocusTrigger}
        className={[
          "flex-1 min-w-0 truncate text-body text-content-primary",
          item.isEmphasized ? "font-semibold" : "font-normal",
          item.status === "done" ? "text-content-secondary" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {/* 备注（行内，支持换行） */}
      <InlineEditor
        value={item.notes ?? ""}
        onSave={(val) => updateItem({ id: item.id, notes: val.trim() })}
        ariaLabel="备注"
        allowClear
        multiline
        placeholder="备注…"
        className={[
          "flex-1 min-w-0 text-body overflow-hidden truncate",
          item.notes ? "text-content-secondary" : "text-content-secondary opacity-30",
        ].join(" ")}
      />

      {/* 等待谁（直接行内填写，填入后自动切为 waiting） */}
      <InlineEditor
        value={item.waitingFor ?? ""}
        onSave={(val) => {
          const trimmed = val.trim();
          if (trimmed) {
            updateItem({
              id: item.id,
              waitingFor: trimmed,
            });
          } else {
            updateItem({
              id: item.id,
              waitingFor: null,
            });
          }
        }}
        ariaLabel="等待谁"
        placeholder="等待谁"
        allowClear

        className={[
          "shrink-0 text-body w-[80px] truncate text-left",
          item.waitingFor ? "font-bold text-content-primary" : "text-content-secondary opacity-30",
        ].join(" ")}
      />

      {/* 已完成：显示完成日期 Badge；否则：截止日期选择器 */}
      {item.status === "done" ? (
        <span className="shrink-0 w-[80px]">
          <Badge
            appearance="tint"
            color="success"
            size="medium"
            shape="rounded"
            icon={item.completedAt ? <CheckmarkRegular /> : <CalendarFilled />}
          >
            {item.completedAt
              ? formatDateDisplay(item.completedAt.slice(0, 10))
              : "—"}
          </Badge>
        </span>
      ) : (
        <DatePicker
          value={item.dueDate}
          dateUrgency={dateUrgency}
          onSelect={(d) => updateItem({ id: item.id, dueDate: d })}

        />
      )}


      {/* 删除按钮 */}
      <button
        type="button"
        aria-label={`删除子任务「${item.title}」`}
        onClick={() => { if (rowRef.current) focusFallbackAfterRemoveShared(rowRef.current); deleteItem(item.id); }}
        className="invisible group-hover:visible flex items-center justify-center w-5 h-5 rounded shrink-0 transition-colors"
        style={{ color: tokens.colorNeutralForeground3 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.colorPaletteRedForeground1; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.colorNeutralForeground3; }}
      >
        ✕
      </button>

      {historyPopover && (
        <StatusHistoryPopover
          itemId={item.id}
          itemTitle={item.title}
          anchorX={historyPopover.x}
          anchorY={historyPopover.y}
          onClose={() => setHistoryPopover(null)}
        />
      )}
    </div>
  );
});
