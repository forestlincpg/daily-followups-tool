import React from "react";
import {
  MenuList,
  MenuItem,
  Badge,
} from "@fluentui/react-components";
import {
  CheckmarkRegular,
} from "@fluentui/react-icons";
import type { ItemStatus } from "../../types";

interface StatusOption {
  status: ItemStatus;
  label: string;
  badgeColor: "informative" | "warning" | "success" | "important";
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    status: "todo",
    label: "待办",
    badgeColor: "informative",
  },
  {
    status: "waiting",
    label: "等待他人",
    badgeColor: "warning",
  },
  {
    status: "long_term",
    label: "长期跟进",
    badgeColor: "important",
  },
  {
    status: "done",
    label: "已完成",
    badgeColor: "success",
  },
];

interface StatusPickerProps {
  currentStatus: ItemStatus;
  onSelect: (status: ItemStatus) => void;
}

/**
 * StatusPicker — 状态选择下拉列表（Fluent MenuList）
 */
export function StatusPicker({ currentStatus, onSelect }: StatusPickerProps) {
  const [focusedIdx, setFocusedIdx] = React.useState(
    Math.max(0, STATUS_OPTIONS.findIndex((o) => o.status === currentStatus))
  );
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setFocusedIdx((i) => (i + 1) % STATUS_OPTIONS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setFocusedIdx((i) => (i - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onSelect(STATUS_OPTIONS[focusedIdx].status);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      onSelect(currentStatus);
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="outline-none"
    >
      <MenuList>
        {STATUS_OPTIONS.map(({ status, label, badgeColor }, idx) => (
          <MenuItem
            key={status}
            onClick={() => onSelect(status)}
            onMouseEnter={() => setFocusedIdx(idx)}
            icon={status === currentStatus ? <CheckmarkRegular /> : <span style={{ width: 20 }} />}
            style={{
              backgroundColor: focusedIdx === idx ? "var(--colorNeutralBackground1Hover)" : undefined,
            }}
          >
            <Badge
              appearance="filled"
              color={badgeColor}
              size="small"
              style={{ marginRight: 4 }}
            />
            <span style={{ fontWeight: status === currentStatus ? 600 : 400 }}>
              {label}
            </span>
          </MenuItem>
        ))}
      </MenuList>
    </div>
  );
}
