import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Badge,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from "@fluentui/react-components";
import { CheckmarkRegular } from "@fluentui/react-icons";
import type { FollowUpItem, ItemStatus } from "../../types";
import { daysSince } from "../../utils/dates";
import { useItemStore } from "../../stores/useItemStore";
import { getVisibleRows, focusAfterStatusChange } from "../../utils/focusManager";

export interface StatusBadgeHandle {
  openPicker: () => void;
}

interface StatusBadgeProps {
  item: FollowUpItem;
}

const STATUS_OPTIONS: {
  status: ItemStatus;
  label: string;
  badgeColor: "brand" | "informative" | "warning" | "success" | "important";
}[] = [
  { status: "todo", label: "待办", badgeColor: "brand" },
  { status: "waiting", label: "等待他人", badgeColor: "warning" },
  { status: "long_term", label: "长期跟进", badgeColor: "important" },
  { status: "done", label: "已完成", badgeColor: "success" },
];

function getBadgeContent(item: FollowUpItem): {
  label: string;
  color: "brand" | "informative" | "warning" | "success" | "important";
} {
  switch (item.status) {
    case "todo":
      return { label: "待办", color: "brand" };
    case "waiting": {
      const person = item.waitingFor || "";
      const since = item.waitingSince;
      const days = since ? daysSince(since) : null;
      const label =
        person
          ? `等待：${person}${days !== null ? ` · ${days}天` : ""}`
          : "等待他人";
      return { label, color: "warning" };
    }
    case "done":
      return { label: "已完成", color: "success" };
    case "long_term":
      return { label: "长期跟进", color: "important" };
  }
}

/**
 * StatusBadge — 状态标签 + Fluent Menu 下拉选择器
 *
 * 点击 Badge 或 Ctrl+S → 打开 Menu
 * 选"等待他人" → 直接更新状态
 * 选"已完成" → 今日聚焦视图中隐藏
 */
export const StatusBadge = forwardRef<StatusBadgeHandle, StatusBadgeProps>(
  function StatusBadge({ item }, ref) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const updateItem = useItemStore((s) => s.updateItem);

  useImperativeHandle(ref, () => ({
    openPicker() {
      setOpen(true);
    },
  }));

  const handleStatusSelect = useCallback(
    (status: ItemStatus) => {
      setOpen(false);

      // 状态变更前，记住当前 item ID 和前一个 item ID（用于焦点管理）
      const allRows = getVisibleRows();
      // 查找包含当前组件的行
      const thisRow = allRows.find((el) => {
        const badges = el.querySelectorAll('[data-status-badge]');
        for (const b of badges) {
          if (b.getAttribute('data-item-id') === String(item.id)) return true;
        }
        return false;
      });
      const thisIdx = thisRow ? allRows.indexOf(thisRow) : -1;
      const prevRow = thisIdx > 0 ? allRows[thisIdx - 1] : thisIdx === 0 ? allRows[1] : null;
      const currentItemId = String(item.id);
      const fallbackItemId = prevRow?.dataset?.itemId;

      if (status === "waiting") {
        const today = new Date().toISOString().split("T")[0];
        updateItem({ id: item.id, status: "waiting", waitingSince: today });
      } else if (status === "done") {
        const now = new Date().toISOString();
        updateItem({ id: item.id, status: "done", completedAt: now });
      } else {
        updateItem({ id: item.id, status });
      }

      focusAfterStatusChange(currentItemId, fallbackItemId);
    },
    [item.id, updateItem]
  );

  const { label, color } = getBadgeContent(item);

  return (
    <div className="shrink-0" data-status-badge data-item-id={item.id}>
      <Menu
        open={open}
        onOpenChange={(_, data) => setOpen(data.open)}
        positioning="below-start"
      >
        <MenuTrigger disableButtonEnhancement>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`当前状态：${label}，点击修改`}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Badge
              appearance="filled"
              color={color}
              size="medium"
              shape="rounded"
            >
              {label}
            </Badge>
          </button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {STATUS_OPTIONS.map(({ status, label: optLabel, badgeColor }) => (
              <MenuItem
                key={status}
                onClick={() => handleStatusSelect(status)}
                icon={
                  status === item.status
                    ? <CheckmarkRegular />
                    : <span style={{ width: 20 }} />
                }
              >
                <Badge
                  appearance="filled"
                  color={badgeColor}
                  size="small"
                  style={{ marginRight: 4 }}
                />
                <span style={{ fontWeight: status === item.status ? 600 : 400 }}>
                  {optLabel}
                </span>
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
});

