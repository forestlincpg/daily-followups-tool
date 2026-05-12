import React from "react";
import {
  Badge,
  tokens,
} from "@fluentui/react-components";
import {
  StarFilled,
  StarRegular,
  DismissRegular,
  ChevronRightRegular,
  CheckmarkRegular,
  CalendarFilled,
} from "@fluentui/react-icons";
import type { FollowUpItem as FollowUpItemType, UpdateItemInput } from "../../types";
import { formatDateDisplay } from "../../utils/dates";
import { parseQuickInput } from "../../utils/parseQuickInput";
import { focusFallbackAfterRemove, getVisibleNavTargets, getDateUrgency, SEL_FOCUSABLE_ROW } from "../../utils/focusManager";
import { StatusBadge } from "../controls/StatusBadge";
import type { StatusBadgeHandle } from "../controls/StatusBadge";
import { useItemStore, selectChildren } from "../../stores/useItemStore";
import { InlineEditor } from "../inputs/InlineEditor";
import { DatePicker } from "../controls/DatePicker";
import { SubtaskExpandArea } from "./SubtaskExpandArea";
import { StatusHistoryPopover } from "../panels/StatusHistoryPopover";

interface FollowUpItemProps {
  item: FollowUpItemType;
  dragHandleRef?: (node: HTMLElement | null) => void;
  dragHandleListeners?: Record<string, unknown>;
  isDragging?: boolean;
  externalFocusTrigger?: number;
  /** Ctrl+上下键移动排序，由列表容器提供 */
  onKeyMove?: (id: number, dir: 1 | -1) => void;
  /** 幽灵父任务：仅因子任务匹配而显示，主行半透明 */
  isGhostParent?: boolean;
}



export const FollowUpItem = React.memo(function FollowUpItem({
  item,
  dragHandleRef,
  dragHandleListeners,
  isDragging = false,
  externalFocusTrigger = 0,
  onKeyMove,
  isGhostParent = false,
}: FollowUpItemProps) {
  const deleteItem = useItemStore((s) => s.deleteItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const toggleExpandItem = useItemStore((s) => s.toggleExpandItem);
  const expandedItemIds = useItemStore((s) => s.expandedItemIds);
  const items = useItemStore((s) => s.items);
  const [focusSubtask, setFocusSubtask] = React.useState(0);
  const [titleFocusTrigger, setTitleFocusTrigger] = React.useState(0);
  const [selected, setSelected] = React.useState(false);
  const rowRef = React.useRef<HTMLLIElement>(null);
  const statusBadgeRef = React.useRef<StatusBadgeHandle>(null);
  const [historyPopover, setHistoryPopover] = React.useState<{ x: number; y: number } | null>(null);
  const lastCreatedItemId = useItemStore((s) => s.lastCreatedItemId);
  const clearLastCreated = useItemStore((s) => s.clearLastCreated);

  // 自动聚焦新创建的跟进项
  React.useEffect(() => {
    if (lastCreatedItemId === item.id && rowRef.current) {
      rowRef.current.focus();
      setSelected(true);
      clearLastCreated();
    }
  }, [lastCreatedItemId, item.id, clearLastCreated]);

  // 外部触发展开子任务输入
  const prevExtTrigger = React.useRef(0);
  React.useEffect(() => {
    if (externalFocusTrigger > prevExtTrigger.current) {
      prevExtTrigger.current = externalFocusTrigger;
      if (!expandedItemIds.has(item.id)) toggleExpandItem(item.id);
      setFocusSubtask((n) => n + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFocusTrigger]);

  // 幽灵父任务自动展开子任务区域
  React.useEffect(() => {
    if (isGhostParent && !expandedItemIds.has(item.id)) {
      toggleExpandItem(item.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGhostParent]);

  // 键盘快捷键处理函数（在 li onKeyDown 中调用）
  function handleItemKeyDown(e: React.KeyboardEvent) {
    const targetEl = e.target as HTMLElement;
    // 忽略来自嵌套子任务行的事件（子任务有自己的处理逻辑）
    const closestListItem = targetEl.closest('[role="listitem"][tabindex="0"]');
    if (closestListItem !== rowRef.current) return;
    // 当焦点在input/textarea里时不触发行快捷键
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    // 焦点在 menu（如 StatusPicker）上则不处理
    if ((document.activeElement as HTMLElement)?.closest('[role="menu"]')) return;

    // ── Ctrl 组合键：焦点在行内任意子元素时都应响应 ──

    if (e.ctrlKey) {
      // Ctrl+S: 打开状态选择器
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        statusBadgeRef.current?.openPicker();
        return;
      }
      // Ctrl+B: 切换强调
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        updateItem({ id: item.id, isEmphasized: !item.isEmphasized });
        return;
      }
      // Ctrl+上下键：在当前列表中循环移动排序
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        onKeyMove?.(item.id, e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      // Ctrl+Backspace: 删除项目
      if (e.key === "Backspace") {
        e.preventDefault();
        focusFallbackAfterRemove(rowRef.current);
        deleteItem(item.id);
        return;
      }
    }

    // ── 以下非组合键，仅在焦点直接在 li 上时响应 ──
    if (targetEl !== rowRef.current) return;

    if (e.key === "Escape") {
      setSelected(false);
      return;
    }

    // Enter：进入标题编辑模式
    if (e.key === "Enter") {
      e.preventDefault();
      setTitleFocusTrigger((n) => n + 1);
      return;
    }

    // 上下键导航：在所有可见 listitem 之间切换（不依赖事件冒泡）
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const allTargets = getVisibleNavTargets();
      const idx = allTargets.findIndex((el) => el === rowRef.current);
      const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const wrapped = (next + allTargets.length) % allTargets.length;
      allTargets[wrapped].focus();
      return;
    }

    if (!selected) return;

    if (e.key === "Tab" && expandedItemIds.has(item.id)) {
      e.preventDefault();
      setFocusSubtask((n) => n + 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!expandedItemIds.has(item.id)) {
        toggleExpandItem(item.id);
        requestAnimationFrame(() => {
          const firstSubtask = rowRef.current?.querySelector<HTMLElement>(SEL_FOCUSABLE_ROW);
          if (firstSubtask) firstSubtask.focus();
          else setFocusSubtask((n) => n + 1);
        });
      } else {
        const firstSubtask = rowRef.current?.querySelector<HTMLElement>(SEL_FOCUSABLE_ROW);
        if (firstSubtask) firstSubtask.focus();
        else setFocusSubtask((n) => n + 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (expandedItemIds.has(item.id)) {
        toggleExpandItem(item.id);
        requestAnimationFrame(() => rowRef.current?.focus());
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      focusFallbackAfterRemove(rowRef.current);
      deleteItem(item.id);
    }
  }

  const dateUrgency = getDateUrgency(item.status, item.dueDate);
  const isExpanded = expandedItemIds.has(item.id);
  const children = React.useMemo(() => selectChildren(items, item.id), [items, item.id]);
  const subtaskCount = children.length;
  const subtaskSummaries = React.useMemo(
    () =>
      [
        {
          key: "todo",
          count: children.filter((child) => child.status === "todo").length,
          badgeColor: "brand" as const,
        },
        {
          key: "waiting",
          count: children.filter((child) => child.status === "waiting").length,
          badgeColor: "warning" as const,
        },
        {
          key: "done",
          count: children.filter((child) => child.status === "done").length,
          badgeColor: "success" as const,
        },
        {
          key: "long_term",
          count: children.filter((child) => child.status === "long_term").length,
          badgeColor: "important" as const,
        },
      ].filter((summary) => summary.count > 0),
    [children]
  );
  const rowBg = item.isEmphasized ? "bg-emphasis" : "";

  return (
    <li
      ref={rowRef}
      role="listitem"
      tabIndex={0}
      data-item-id={item.id}
      onClick={(e) => {
        // 只有直接点击主任务行才选中，子任务点击不冒泡到此
        if ((e.target as HTMLElement).closest('[role="listitem"][tabindex="0"]') === rowRef.current) {
          setSelected(true);
        }
      }}
      onFocus={(e) => {
        // 只有焦点直接落到本 li 时才选中（子任务聚焦不触发父选中）
        if (e.target === rowRef.current) setSelected(true);
      }}
      onBlur={(e) => {
        const related = e.relatedTarget as HTMLElement | null;
        // 焦点移到 StatusPicker portal（role="menu"）上时不取消选中
        if (related?.closest('[role="menu"]')) return;
        // 焦点离开整行 → 取消选中
        if (!rowRef.current?.contains(related)) { setSelected(false); return; }
        // 焦点移到行内另一个 listitem（子任务）→ 也取消父选中
        if (related?.closest('[role="listitem"][tabindex="0"]') !== rowRef.current) {
          setSelected(false);
        }
      }}
      onKeyDown={handleItemKeyDown}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setHistoryPopover({ x: e.clientX, y: e.clientY }); }}

      className={[
        "group flex flex-col gap-0 px-lg py-0",
        "border-b border-surface-border",
        "cursor-default select-none outline-none",
      ]
        .filter(Boolean)
        .join(" ")}
    >
        {/* 主行 */}
        <div
          className={[
            "flex items-center gap-sm py-sm",
            selected ? "-mx-lg px-lg rounded" : "",
            rowBg,
          ].filter(Boolean).join(" ")}
          style={{
            ...(selected ? { background: tokens.colorNeutralBackground1Selected } : undefined),
            ...(isGhostParent ? { opacity: 0.45 } : undefined),
          }}
        >
          {/* 拖拽手柄 */}
          <span
            ref={dragHandleRef ?? undefined}
            aria-hidden="true"
            className={[
              "text-content-secondary opacity-30 shrink-0 text-sm leading-none",
              dragHandleListeners ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isDragging ? "opacity-60" : "",
            ].join(" ")}
            title="拖拽排序"
            {...(dragHandleListeners as React.HTMLAttributes<HTMLSpanElement> ?? {})}
          >
            ⠿
          </span>

          {/* 强调星标 — 状态标签左侧 */}
          <button
            type="button"
            aria-label={item.isEmphasized ? "取消强调" : "标记为重要"}
            onClick={(e) => {
              e.stopPropagation();
              updateItem({ id: item.id, isEmphasized: !item.isEmphasized });
            }}
            className="shrink-0 transition-colors hover:scale-110 active:scale-95"
            style={{ color: item.isEmphasized ? tokens.colorPaletteYellowForeground1 : tokens.colorNeutralForeground4 }}
          >
            {item.isEmphasized ? <StarFilled fontSize={16} /> : <StarRegular fontSize={16} />}
          </button>

          {/* 状态标签 */}
          <StatusBadge ref={statusBadgeRef} item={item} />

          {/* 展开/收起按钮 */}
          <button
            type="button"
            aria-label={isExpanded ? "收起子任务" : "展开子任务"}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandItem(item.id);
            }}
            className="flex items-center justify-center w-4 h-4 shrink-0 transition-transform"
            style={{
              color: subtaskCount > 0 || isExpanded ? tokens.colorNeutralForeground3 : "transparent",
              cursor: subtaskCount > 0 || isExpanded ? "pointer" : "default",
              transform: isExpanded ? "rotate(90deg)" : "none",
            }}
          >
            <ChevronRightRegular fontSize={12} />
          </button>

          {/* 标题 + 子任务统计 */}
          <div className="flex min-w-0 flex-1 items-center gap-xs">
            <InlineEditor
              value={item.title}
              onSave={(newTitle) => {
                const { title, waitingFor, dueDate } = parseQuickInput(newTitle);
                const updates: UpdateItemInput = { id: item.id, title: title || newTitle };
                if (waitingFor) {
                  updates.waitingFor = waitingFor;
                }
                if (dueDate) updates.dueDate = dueDate;
                updateItem(updates);
              }}
              ariaLabel="编辑跟进项标题"
              focusTrigger={titleFocusTrigger}
              onTab={() => {
                if (!expandedItemIds.has(item.id)) toggleExpandItem(item.id);
                setFocusSubtask((n) => n + 1);
              }}
              className={[
                "inline-block min-w-0 max-w-full truncate text-body text-content-primary",
                item.isEmphasized ? "font-semibold" : "font-normal",
                item.status === "done" ? "text-content-secondary" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />

            {subtaskCount > 0 && (
              <div
                className="flex items-center gap-xs shrink-0"
                aria-label={`共有 ${subtaskCount} 个子任务`}
              >
                {subtaskSummaries.map((summary) => (
                  <Badge
                    key={summary.key}
                    appearance="filled"
                    color={summary.badgeColor}
                    size="small"
                    shape="rounded"
                  >
                    {summary.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 备注（行内，支持换行，不弹框） */}
          <InlineEditor
            value={item.notes ?? ""}
            onSave={(val) => updateItem({ id: item.id, notes: val.trim() })}
            ariaLabel="备注"
            allowClear
            multiline
            placeholder="备注…"
            className={[
              "flex-1 min-w-0 text-body overflow-hidden whitespace-pre-wrap break-words",
              item.notes ? "text-content-secondary" : "text-content-secondary opacity-30",
            ].join(" ")}
          />

          {/* 等待谁 */}
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
            allowClear
            placeholder="等待谁"

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
              onSelect={(date) => updateItem({ id: item.id, dueDate: date })}

            />
          )}

          {/* 删除按钮 */}
          <button
            type="button"
            aria-label={`删除「${item.title}」`}
            onClick={(e) => { e.stopPropagation(); focusFallbackAfterRemove(rowRef.current); deleteItem(item.id); }}
            className="invisible group-hover:visible flex items-center justify-center w-5 h-5 rounded shrink-0 transition-colors"
            style={{ color: tokens.colorNeutralForeground3 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.colorPaletteRedForeground1; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = tokens.colorNeutralForeground3; }}
          >
            <DismissRegular fontSize={14} />
          </button>
        </div>

      {/* 展开的子任务区域 */}
      {isExpanded && <SubtaskExpandArea parentId={item.id} focusInput={focusSubtask} ghostFilter={isGhostParent} />}

      {historyPopover && (
        <StatusHistoryPopover
          itemId={item.id}
          itemTitle={item.title}
          anchorX={historyPopover.x}
          anchorY={historyPopover.y}
          onClose={() => setHistoryPopover(null)}
        />
      )}
    </li>
  );
});



