import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  ToggleButton,
  Input,
  tokens,
  Title2,
  Body1,
  Spinner,
} from "@fluentui/react-components";
import { ArrowDownloadRegular, EyeRegular } from "@fluentui/react-icons";
import { todayString } from "../../utils/dates";
import type { ItemStatus } from "../../types";

type PresetRange = "this_month" | "this_quarter" | "this_year" | "custom";

const PRESET_LABELS: Record<PresetRange, string> = {
  this_month: "本月",
  this_quarter: "本季度",
  this_year: "今年",
  custom: "自定义",
};

const STATUS_FILTER_OPTIONS: { value: ItemStatus | "all"; label: string }[] = [
  { value: "all", label: "所有状态" },
  { value: "done", label: "已完成" },
  { value: "todo", label: "待办" },
  { value: "waiting", label: "等待他人" },
  { value: "long_term", label: "长期跟进" },
];

function getPresetDates(preset: PresetRange): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (preset) {
    case "this_month": {
      const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { from, to: todayString() };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      const qMonth = q * 3;
      const from = `${y}-${String(qMonth + 1).padStart(2, "0")}-01`;
      return { from, to: todayString() };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: todayString() };
    case "custom":
      return { from: `${y}-01-01`, to: todayString() };
  }
}

/**
 * ExportView — 导出视图（Story 5.1 + 5.2）
 *
 * 提供时间范围预设 + 自定义日期 + 状态筛选 + 预览 + 导出
 */
export function ExportView() {
  const [preset, setPreset] = useState<PresetRange>("this_year");
  const [customFrom, setCustomFrom] = useState(getPresetDates("this_year").from);
  const [customTo, setCustomTo] = useState(todayString());
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const dates = preset === "custom"
    ? { from: customFrom, to: customTo }
    : getPresetDates(preset);

  async function generateMarkdown() {
    setIsLoading(true);
    setPreview(null);
    setIsEmpty(false);
    try {
      const md = await invoke<string>("export_markdown", {
        dateFrom: dates.from,
        dateTo: dates.to,
        statusFilter: statusFilter === "all" ? null : statusFilter,
      });
      if (!md.trim() || md === "# 跟进项导出\n\n") {
        setIsEmpty(true);
      } else {
        setPreview(md);
      }
    } catch (e) {
      console.error("export_markdown error:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveFile() {
    if (!preview) return;
    try {
      await invoke("save_export_file", { content: preview });
    } catch (e) {
      console.error("save_export_file error:", e);
    }
  }

  return (
    <div className="h-full flex flex-col p-xl gap-lg overflow-auto">
      <Title2>导出跟进项</Title2>

      {/* 时间范围 */}
      <section className="flex flex-col gap-sm">
        <Body1 style={{ fontWeight: 500, color: tokens.colorNeutralForeground3 }}>时间范围</Body1>
        <div className="flex gap-sm flex-wrap">
          {(Object.keys(PRESET_LABELS) as PresetRange[]).map((p) => (
            <ToggleButton
              key={p}
              checked={preset === p}
              onClick={() => setPreset(p)}
              appearance={preset === p ? "primary" : "outline"}
              size="small"
            >
              {PRESET_LABELS[p]}
            </ToggleButton>
          ))}
        </div>

        {/* 自定义日期范围 */}
        <div className="flex items-center gap-sm">
          <Input
            type="date"
            value={preset === "custom" ? customFrom : dates.from}
            onChange={(_e, data) => {
              setPreset("custom");
              setCustomFrom(data.value);
            }}
            size="small"
            appearance="outline"
          />
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>至</Body1>
          <Input
            type="date"
            value={preset === "custom" ? customTo : dates.to}
            onChange={(_e, data) => {
              setPreset("custom");
              setCustomTo(data.value);
            }}
            size="small"
            appearance="outline"
          />
        </div>
      </section>

      {/* 状态筛选 */}
      <section className="flex flex-col gap-sm">
        <Body1 style={{ fontWeight: 500, color: tokens.colorNeutralForeground3 }}>状态筛选</Body1>
        <div className="flex gap-sm flex-wrap">
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <ToggleButton
              key={value}
              checked={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              appearance={statusFilter === value ? "primary" : "outline"}
              size="small"
            >
              {label}
            </ToggleButton>
          ))}
        </div>
      </section>

      {/* 操作按钮 */}
      <div className="flex gap-sm">
        <Button
          appearance="primary"
          onClick={generateMarkdown}
          disabled={isLoading}
          icon={isLoading ? <Spinner size="tiny" /> : <EyeRegular />}
        >
          {isLoading ? "生成中..." : "预览 Markdown"}
        </Button>
        {preview && (
          <Button
            appearance="outline"
            onClick={saveFile}
            icon={<ArrowDownloadRegular />}
          >
            保存到本地
          </Button>
        )}
      </div>

      {/* 空状态 */}
      {isEmpty && (
        <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
          所选范围内没有符合条件的跟进项
        </Body1>
      )}

      {/* 预览区 */}
      {preview && (
        <div className="flex-1 min-h-[200px]">
          <Body1 style={{ color: tokens.colorNeutralForeground3, marginBottom: 4 }}>导出预览：</Body1>
          <pre
            style={{
              fontSize: 12,
              color: tokens.colorNeutralForeground1,
              background: tokens.colorNeutralBackground3,
              border: `1px solid ${tokens.colorNeutralStroke1}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: 12,
              overflow: "auto",
              height: "100%",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
            }}
          >
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
