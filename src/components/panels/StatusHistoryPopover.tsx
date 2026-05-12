import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  tokens,
  Caption1,
  Subtitle2,
  Spinner,
  Badge,
  FluentProvider,
} from "@fluentui/react-components";
import {
  HistoryRegular,
  AddRegular,
  ArrowRightRegular,
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import type { StatusHistoryEntry } from "../../types";
import { dftTheme } from "../../theme";

interface StatusHistoryPopoverProps {
  itemId: number;
  itemTitle: string;
  /** 右键点击的屏幕坐标 */
  anchorX: number;
  anchorY: number;
  onClose: () => void;
}

/* ── 与 StatusBadge 保持一致的状态映射 ── */
const STATUS_MAP: Record<string, {
  label: string;
  badgeColor: "brand" | "warning" | "success" | "important";
  dotColor: string;
}> = {
  todo:      { label: "待办",     badgeColor: "brand",     dotColor: tokens.colorBrandBackground },
  waiting:   { label: "等待他人", badgeColor: "warning",   dotColor: tokens.colorPaletteYellowBackground2 },
  done:      { label: "已完成",   badgeColor: "success",   dotColor: tokens.colorPaletteGreenBackground3 },
  long_term: { label: "长期跟进", badgeColor: "important", dotColor: tokens.colorNeutralForeground1 },
};

function statusLabel(s: string) {
  return STATUS_MAP[s]?.label ?? s;
}
function badgeColor(s: string): "brand" | "warning" | "success" | "important" {
  return STATUS_MAP[s]?.badgeColor ?? "brand";
}
function dotColor(s: string) {
  return STATUS_MAP[s]?.dotColor ?? tokens.colorNeutralForeground3;
}

function formatTime(dt: string): string {
  const d = new Date(dt.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return dt;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd}  ${hh}:${mi}`;
}

/**
 * StatusHistoryPopover — 右键弹出的状态变更时间线
 *
 * Fluent Design 合规：
 * - tokens 色彩 / 圆角 / 阴影 / 字体
 * - 与 StatusBadge 一致的 badgeColor 映射
 * - Motion: 150ms scale + opacity 入场
 * - Acrylic: 轻微 backdrop-filter
 * - 左侧时间线 + 状态节点
 */
export function StatusHistoryPopover({
  itemId,
  itemTitle,
  anchorX,
  anchorY,
  onClose,
}: StatusHistoryPopoverProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[] | null>(null);
  const [visible, setVisible] = useState(false);          // 入场动画控制
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // 记录打开前的焦点元素，关闭时恢复
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    invoke<StatusHistoryEntry[]>("get_status_history", { itemId })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [itemId]);

  // 入场动画：挂载后下一帧触发
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const id = setTimeout(() => window.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(id); window.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Escape 关闭
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 定位：确保不超出视口
  const computePosition = useCallback(() => {
    const w = 520;
    const maxH = 480;
    let x = anchorX;
    let y = anchorY;
    if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
    if (y + maxH > window.innerHeight - 12) y = Math.max(12, window.innerHeight - maxH - 12);
    if (x < 12) x = 12;
    if (y < 12) y = 12;
    return { x, y };
  }, [anchorX, anchorY]);

  const pos = computePosition();

  return createPortal(
    <FluentProvider theme={dftTheme} style={{ display: "contents" }}>
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 520,
        maxHeight: 480,
        zIndex: 1000000,
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusXLarge,
        boxShadow: tokens.shadow16,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        /* Fluent Motion: 150ms ease-out scale + fade */
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.96)",
        transformOrigin: "top left",
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
      }}
    >
      {/* ── 标题栏 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 20px 12px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        }}
      >
        <HistoryRegular
          fontSize={20}
          style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }}
        />
        <Subtitle2
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: tokens.lineHeightBase300,
            color: tokens.colorNeutralForeground1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {itemTitle}
        </Subtitle2>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0, fontSize: 12 }}>
          状态历史
        </Caption1>
      </div>

      {/* ── 时间线内容区 ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 20px 16px" }}>
        {history === null ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
            <Spinner size="tiny" label="加载中..." />
          </div>
        ) : history.length === 0 ? (
          <Caption1
            style={{
              color: tokens.colorNeutralForeground3,
              display: "block",
              textAlign: "center",
              padding: 20,
            }}
          >
            暂无状态变更记录
          </Caption1>
        ) : (
          <div style={{ position: "relative", paddingLeft: 22 }}>
            {/* 时间线竖条 */}
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 7,
                bottom: 7,
                width: 2,
                background: tokens.colorNeutralStroke2,
                borderRadius: tokens.borderRadiusCircular,
              }}
            />

            {history.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  position: "relative",
                  paddingBottom: i < history.length - 1 ? 14 : 0,
                }}
              >
                {/* 时间线节点圆点 */}
                <div
                  style={{
                    position: "absolute",
                    left: -18,
                    top: 3,
                    width: 12,
                    height: 12,
                    borderRadius: tokens.borderRadiusCircular,
                    background: dotColor(entry.newStatus),
                    border: `2px solid ${tokens.colorNeutralBackground1}`,
                    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke2}`,
                  }}
                />

                {/* 时间戳 — 与主界面日期 Badge 统一字体风格 */}
                <Caption1
                  style={{
                    display: "block",
                    color: tokens.colorNeutralForeground3,
                    fontSize: 12,
                    fontFamily: tokens.fontFamilyBase,
                    lineHeight: 1.3,
                    marginBottom: 6,
                  }}
                >
                  {formatTime(entry.changedAt)}
                </Caption1>

                {/* 状态变更行 — 统一使用 filled appearance */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  {entry.oldStatus ? (
                    <Badge
                      appearance="filled"
                      color={badgeColor(entry.oldStatus)}
                      size="medium"
                      shape="rounded"
                    >
                      {statusLabel(entry.oldStatus)}
                    </Badge>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        color: tokens.colorNeutralForeground3,
                        fontSize: 12,
                      }}
                    >
                      <AddRegular fontSize={12} />
                      创建
                    </span>
                  )}

                  <ArrowRightRegular
                    fontSize={14}
                    style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}
                  />

                  <Badge
                    appearance="filled"
                    color={badgeColor(entry.newStatus)}
                    size="medium"
                    shape="rounded"
                  >
                    {statusLabel(entry.newStatus)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </FluentProvider>,
    document.body,
  );
}
