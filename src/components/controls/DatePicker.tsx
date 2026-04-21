import { useState, useRef, useEffect } from "react";
import {
  Input,
  Button,
  Badge,
  Divider,
  tokens,
  Popover,
  PopoverTrigger,
  PopoverSurface,
} from "@fluentui/react-components";
import {
  CalendarRegular,
  CalendarFilled,
  CheckmarkRegular,
  WarningFilled,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from "@fluentui/react-icons";
import { todayString, formatDateDisplay } from "../../utils/dates";

/** 将用户输入的日期字符串解析为 YYYY-MM-DD */
function parseDateInput(s: string): string | null {
  const trimmed = s.trim().toLowerCase();
  if (!trimmed) return null;
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (trimmed === "td" || trimmed === "今天") return fmt(today);
  if (trimmed === "tmr" || trimmed === "明天") {
    const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d);
  }
  const curYear = today.getFullYear();
  const normalized = trimmed.replace(/\//g, "-");
  const parts = normalized.split("-").map(Number);
  let yr: number, mo: number, da: number;
  if (parts.length === 3 && parts[0] > 999) {
    [yr, mo, da] = parts;
  } else if (parts.length === 2) {
    yr = curYear;
    [mo, da] = parts;
  } else {
    return null;
  }
  if ([yr, mo, da].some(isNaN) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${yr}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

interface DatePickerProps {
  /** 当前日期 "YYYY-MM-DD" 或 null */
  value: string | null;
  /** 选择日期后的回调（null 表示清除） */
  onSelect: (date: string | null) => void;
  /** 日期紧迫度：normal=普通，warning=一周内（橙色），danger=今天/超期（红色） */
  dateUrgency?: "normal" | "warning" | "danger";
  /** 外部触发打开（计数器，变化时即打开） */
  externalOpenTrigger?: number;
}

/**
 * DatePicker — 截止日期选择器（Fluent Popover）
 *
 * 提供快捷选项 + 文字日期输入
 * 关闭方式：选择 / Escape / 点击外部
 */
export function DatePicker({ value, onSelect, dateUrgency = "normal", externalOpenTrigger = 0 }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const prevExtTrigger = useRef(0);

  // 外部触发打开
  useEffect(() => {
    if (externalOpenTrigger > prevExtTrigger.current) {
      prevExtTrigger.current = externalOpenTrigger;
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenTrigger]);

  // 打开时自动聚焦文字输入框
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  function pick(date: string | null) {
    onSelect(date);
    setOpen(false);
  }

  const today = todayString();

  // 计算明天
  const tomorrow = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  // 显示文字（yyyy/mm/dd 格式）
  const displayText = value ? formatDateDisplay(value) : "设置日期";

  return (
    <div className="shrink-0 w-[80px]">
      <Popover
        open={open}
        onOpenChange={(_, data) => setOpen(data.open)}
        positioning="below-end"
        trapFocus
      >
        <PopoverTrigger disableButtonEnhancement>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`截止日期：${value ?? "未设置"}`}
            className="cursor-pointer"
            style={{ background: "none", border: "none", padding: 0 }}
          >
            {value ? (
              <Badge
                appearance="filled"
                color={dateUrgency === "danger" ? "danger" : dateUrgency === "warning" ? "warning" : "brand"}
                size="medium"
                shape="rounded"
                icon={dateUrgency === "danger" ? <WarningFilled /> : <CalendarFilled />}
              >
                {displayText}
              </Badge>
            ) : (
              <Badge
                appearance="outline"
                color="informative"
                size="medium"
                shape="rounded"
                icon={<CalendarRegular />}
                style={{ opacity: 0.35 }}
              >
                设置日期
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverSurface
          ref={surfaceRef as React.Ref<HTMLDivElement>}
          style={{ width: 240, padding: 8 }}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          {/* 快捷选项 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
            <QuickOption
              label="今天"
              sub={formatDateDisplay(today)}
              active={value === today}
              onClick={() => pick(today)}
            />
            <QuickOption
              label="明天"
              sub={formatDateDisplay(tomorrow)}
              active={value === tomorrow}
              onClick={() => pick(tomorrow)}
            />
            {value && (
              <QuickOption
                label="清除日期"
                active={false}
                onClick={() => pick(null)}
                danger
              />
            )}
          </div>

          {/* 分隔线 */}
          <Divider style={{ marginBottom: 8 }} />

          {/* 日历选择 */}
          <MiniCalendar value={value} today={today} onSelect={(d) => pick(d)} />

          {/* 分隔线 */}
          <Divider style={{ margin: "8px 0" }} />

          {/* 文字日期输入 */}
          <label style={{ fontSize: 12, color: tokens.colorNeutralForeground3, display: "block", marginBottom: 4 }}>
            直接输入日期
          </label>
          <Input
            ref={textRef as React.RefObject<HTMLInputElement>}
            type="text"
            placeholder="如 2026/3/30 或 3/30"
            defaultValue={value ?? ""}
            size="small"
            appearance="outline"
            contentBefore={<CalendarRegular fontSize={14} />}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                // 输入为空 → 清除日期；否则尝试解析
                if (!val) { pick(null); return; }
                const parsed = parseDateInput(val);
                if (parsed) pick(parsed);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            onBlur={(e) => {
              // 焦点移向 Popover 内部元素（如"清除日期"按钮）时跳过，避免吞掉按钮点击
              if (surfaceRef.current?.contains(e.relatedTarget as Node)) return;
              const parsed = parseDateInput(e.target.value);
              if (parsed) pick(parsed);
            }}
            style={{ width: "100%" }}
          />
        </PopoverSurface>
      </Popover>
    </div>
  );
}

interface QuickOptionProps {
  label: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}

function QuickOption({ label, sub, active, onClick, danger }: QuickOptionProps) {
  return (
    <Button
      appearance="subtle"
      size="small"
      onClick={onClick}
      icon={active ? <CheckmarkRegular /> : undefined}
      iconPosition="after"
      style={{
        justifyContent: "flex-start",
        width: "100%",
        fontWeight: active ? 600 : 400,
        color: danger ? tokens.colorPaletteRedForeground1 : undefined,
      }}
    >
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      {sub && <span style={{ color: tokens.colorNeutralForeground3, marginLeft: 8 }}>{sub}</span>}
    </Button>
  );
}

/* ── MiniCalendar ─────────────────────────────────────────────── */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 生成一个月份的日历网格（6×7，含前后月补白） */
function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean; dateStr: string }[] = [];

  // 上月补白
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dt = new Date(year, month - 1, d);
    cells.push({ day: d, inMonth: false, dateStr: fmtDate(dt) });
  }
  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({ day: d, inMonth: true, dateStr: fmtDate(dt) });
  }
  // 下月补白（补满 6 行 = 42 格）
  const remain = 42 - cells.length;
  for (let d = 1; d <= remain; d++) {
    const dt = new Date(year, month + 1, d);
    cells.push({ day: d, inMonth: false, dateStr: fmtDate(dt) });
  }
  return cells;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface MiniCalendarProps {
  value: string | null;
  today: string;
  onSelect: (date: string) => void;
}

function MiniCalendar({ value, today, onSelect }: MiniCalendarProps) {
  // 初始显示月份：基于当前选中日期或今天
  const initDate = value ? new Date(value + "T00:00:00") : new Date(today + "T00:00:00");
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const cells = buildCalendarGrid(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;
  const cellSize = 28;

  return (
    <div style={{ userSelect: "none" }}>
      {/* 月份导航 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Button appearance="subtle" size="small" icon={<ChevronLeft20Regular />} onClick={prevMonth} aria-label="上月" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{monthLabel}</span>
        <Button appearance="subtle" size="small" icon={<ChevronRight20Regular />} onClick={nextMonth} aria-label="下月" />
      </div>

      {/* 星期头 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: "center" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, color: tokens.colorNeutralForeground3, lineHeight: `${cellSize}px` }}>
            {w}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: "center" }}>
        {cells.map((cell, i) => {
          const isSelected = cell.dateStr === value;
          const isToday = cell.dateStr === today;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(cell.dateStr)}
              style={{
                width: cellSize,
                height: cellSize,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                lineHeight: `${cellSize}px`,
                textAlign: "center",
                padding: 0,
                background: isSelected
                  ? tokens.colorBrandBackground
                  : "transparent",
                color: isSelected
                  ? tokens.colorNeutralForegroundOnBrand
                  : !cell.inMonth
                    ? tokens.colorNeutralForegroundDisabled
                    : isToday
                      ? tokens.colorBrandForeground1
                      : tokens.colorNeutralForeground1,
                fontWeight: isToday || isSelected ? 700 : 400,
                outline: isToday && !isSelected ? `1px solid ${tokens.colorBrandStroke1}` : "none",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget.style.background = tokens.colorNeutralBackground1Hover);
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget.style.background = "transparent");
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
