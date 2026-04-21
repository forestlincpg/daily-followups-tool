import { useEffect, useRef, useState } from "react";
import {
  Button,
  Textarea,
  tokens,
  Caption1,
  Subtitle2,
  Divider,
} from "@fluentui/react-components";
import {
  DismissRegular,
  StarRegular,
  StarFilled,
  LinkRegular,
} from "@fluentui/react-icons";
import type { FollowUpItem, StatusHistoryEntry } from "../../types";
import { useItemStore } from "../../stores/useItemStore";
import { InlineEditor } from "../inputs/InlineEditor";
import { StatusBadge } from "../controls/StatusBadge";
import { DatePicker } from "../controls/DatePicker";
import { isWithinWeek, isTodayOrOverdue } from "../../utils/dates";
import { invoke } from "@tauri-apps/api/core";

interface DetailSlidePanelProps {
  item: FollowUpItem;
  onClose: () => void;
}

/**
 * DetailSlidePanel — 右侧 320px 详情面板
 *
 * 触发方式：双击跟进项行（在 FollowUpItem 中实现）
 * 关闭方式：点击 ✕ 按钮 / 点击面板外部 / Escape
 * 零动画：即时显示/消失
 */
export function DetailSlidePanel({ item, onClose }: DetailSlidePanelProps) {
  const updateItem = useItemStore((s) => s.updateItem);
  const panelRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);

  // 加载状态变更历史
  useEffect(() => {
    invoke<StatusHistoryEntry[]>("get_status_history", { itemId: item.id })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [item.id, item.status]);

  // 点击外部关闭
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Escape 关闭
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 解析 links JSON
  let links: { url: string; label: string }[] = [];
  try {
    links = JSON.parse(item.links || "[]");
  } catch {
    links = [];
  }

  async function openLink(url: string) {
    try {
      await invoke("open_external_link", { url });
    } catch {
      // 降级：尝试 window.open（开发环境）
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-label="跟进项详情"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100%",
        width: 320,
        zIndex: 40,
        background: tokens.colorNeutralBackground1,
        borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
        boxShadow: tokens.shadow16,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 头部：标题 + 关闭按钮 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
          background: tokens.colorNeutralBackground2,
        }}
      >
        <Subtitle2 style={{ flex: 1, color: tokens.colorNeutralForeground1 }}>
          详情
        </Subtitle2>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          size="small"
          onClick={onClose}
          aria-label="关闭详情面板"
        />
      </div>

      {/* 字段列表 */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 标题 */}
        <FieldRow label="标题">
          <InlineEditor
            value={item.title}
            onSave={(t) => updateItem({ id: item.id, title: t })}
            ariaLabel="跟进项标题"
            className="flex-1 text-body font-semibold text-content-primary"
          />
        </FieldRow>

        <Divider />

        {/* 状态 */}
        <FieldRow label="状态">
          <StatusBadge item={item} />
        </FieldRow>

        {/* 截止日期 */}
        <FieldRow label="截止日期">
          <DatePicker
            value={item.dueDate}
            dateUrgency={
              isTodayOrOverdue(item.dueDate) ? "danger"
              : isWithinWeek(item.dueDate) ? "warning"
              : "normal"
            }
            onSelect={(d) => updateItem({ id: item.id, dueDate: d })}
          />
        </FieldRow>

        {/* 等待人 */}
        {item.status === "waiting" && (
          <FieldRow label="等待谁">
            <InlineEditor
              value={item.waitingFor ?? ""}
              onSave={(v) =>
                updateItem({ id: item.id, waitingFor: v.trim() || null })
              }
              ariaLabel="等待的人"
              className="text-body text-content-primary"
            />
          </FieldRow>
        )}

        {/* 强调 */}
        <FieldRow label="强调">
          <Button
            appearance="subtle"
            size="small"
            icon={item.isEmphasized ? <StarFilled style={{ color: tokens.colorPaletteYellowForeground1 }} /> : <StarRegular />}
            onClick={() =>
              updateItem({ id: item.id, isEmphasized: !item.isEmphasized })
            }
          >
            {item.isEmphasized ? "已强调" : "未强调"}
          </Button>
        </FieldRow>

        <Divider />

        {/* 链接 */}
        {links.length > 0 && (
          <FieldRow label="链接" vertical>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {links.map((link, i) => (
                <Button
                  key={i}
                  appearance="subtle"
                  size="small"
                  icon={<LinkRegular />}
                  onClick={() => openLink(link.url)}
                  title={link.url}
                  style={{ justifyContent: "flex-start" }}
                >
                  {link.label || link.url}
                </Button>
              ))}
            </div>
          </FieldRow>
        )}

        {/* 备注 */}
        <FieldRow label="备注" vertical>
          <Textarea
            defaultValue={item.notes ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim() || null;
              if (val !== item.notes) {
                updateItem({ id: item.id, notes: val });
              }
            }}
            placeholder="添加备注..."
            rows={4}
            resize="vertical"
            appearance="outline"
            style={{ width: "100%" }}
          />
        </FieldRow>

        {/* 状态变更历史 */}
        {history.length > 0 && (
          <>
            <Divider />
            <FieldRow label="状态历史" vertical>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    <span style={{ flexShrink: 0, fontFamily: "monospace" }}>
                      {formatHistoryTime(entry.changedAt)}
                    </span>
                    <span>
                      {entry.oldStatus ? statusLabel(entry.oldStatus) : "创建"}
                      {" → "}
                      {statusLabel(entry.newStatus)}
                    </span>
                  </div>
                ))}
              </div>
            </FieldRow>
          </>
        )}
      </div>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
  vertical?: boolean;
}

function FieldRow({ label, children, vertical = false }: FieldRowProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: vertical ? "stretch" : "center",
        gap: vertical ? 4 : 8,
      }}
    >
      <Caption1
        style={{
          fontWeight: 500,
          color: tokens.colorNeutralForeground3,
          flexShrink: 0,
          width: vertical ? undefined : 64,
        }}
      >
        {label}
      </Caption1>
      {children}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  waiting: "等待中",
  done: "已完成",
  long_term: "长期跟进",
};
function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

function formatHistoryTime(dt: string): string {
  // dt 格式: "2026-04-15 10:23:45" (SQLite CURRENT_TIMESTAMP, UTC)
  const d = new Date(dt.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return dt;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
