import { useEffect, useRef, useState } from "react";
import { Input, Badge } from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";
import { formatDateDisplay } from "../../utils/dates";
import { parseQuickInput } from "../../utils/parseQuickInput";
import { useItemStore } from "../../stores/useItemStore";

interface QuickCreateInputProps {
  /** 创建跟进项的回调 */
  onCreate: (title: string, waitingFor?: string | null, dueDate?: string | null) => void;
  /** 是否禁用（正在保存中） */
  disabled?: boolean;
}

/**
 * QuickCreateInput — 顶部快速创建输入框
 *
 * 快捷语法：
 * - `--张三`   → 设置等待人
 * - `//2026/3/30` → 设置截止日期（支持 2026/3/30 、3/30 、今天、明天）
 */
export function QuickCreateInput({ onCreate, disabled = false }: QuickCreateInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trigger = useItemStore((s) => s.quickCreateFocusTrigger);

  // 当全局触发时自动聚焦
  useEffect(() => {
    if (trigger > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [trigger]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) {
        // 聚焦当前 tabpanel 内第一个可见 item 行（避免命中隐藏 tab 的元素）
        const panel: Element =
          inputRef.current?.closest('[role="tabpanel"]') ?? document.body;
        panel
          .querySelector<HTMLElement>('[role="listitem"][tabindex="0"]')
          ?.focus();
        return;
      }
      const { title, waitingFor, dueDate } = parseQuickInput(trimmed);
      if (!title) return;
      onCreate(title, waitingFor, dueDate);
      setValue("");
    }
  }

  const preview = value ? parseQuickInput(value) : null;

  return (
    <div className="relative px-xl py-sm">
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        role="textbox"
        aria-label="快速创建跟进项"
        placeholder="输入跟进项…  --等待人  //日期  回车创建"
        value={value}
        onChange={(_e, data) => setValue(data.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
        appearance="underline"
        size="medium"
        contentBefore={<AddRegular fontSize={16} />}
        style={{ width: "100%" }}
      />
      {(preview?.waitingFor || preview?.dueDate) && (
        <div className="flex gap-xs mt-xs flex-wrap pb-xs">
          {preview?.waitingFor && (
            <Badge appearance="filled" color="warning" size="medium">
              等待：{preview.waitingFor}
            </Badge>
          )}
          {preview?.dueDate && (
            <Badge appearance="filled" color="success" size="medium">
              日期：{formatDateDisplay(preview.dueDate)}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

