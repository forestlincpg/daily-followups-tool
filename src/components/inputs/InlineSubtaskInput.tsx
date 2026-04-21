import { useState, useRef, useEffect } from "react";
import { Input } from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";
import { useItemStore } from "../../stores/useItemStore";
import { parseQuickInput } from "../../utils/parseQuickInput";

interface InlineSubtaskInputProps {
  parentId: number;
  /** 自增计数器，每次变化则重新聚焦输入框 */
  autoFocus?: number;
}

/**
 * InlineSubtaskInput — 子任务展开区域底部创建输入框
 *
 * 行为与 QuickCreateInput 完全一致：
 * - Enter：非空则创建，清空，保持焦点
 * - 支持 --等待人  //日期 快捷语法
 * - 空 Enter：忽略
 * - Escape：不操作
 * 占位文本："+ 添加子任务… --等待人 //日期"
 */
export function InlineSubtaskInput({ parentId, autoFocus = 0 }: InlineSubtaskInputProps) {
  const [value, setValue] = useState("");
  const createItem = useItemStore((s) => s.createItem);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当 autoFocus 发生变化（且大于 0）时自动聚焦
  useEffect(() => {
    if (autoFocus > 0) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      const { title, waitingFor, dueDate } = parseQuickInput(trimmed);
      if (!title) return;
      createItem(title, parentId, null, dueDate, waitingFor);
      setValue("");
    } else if (e.key === "ArrowLeft" || e.key === "Escape") {
      // 左箭头（光标已在最左侧或输入框为空）/ Escape：退出输入框，聚焦到上一个子任务或父任务
      if (e.key === "ArrowLeft" && inputRef.current && inputRef.current.selectionStart !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setValue("");
      inputRef.current?.blur();
      // 在同一个子任务列表内找到前面的 listitem，没有就找父 li
      const container = inputRef.current?.closest('[role="list"]');
      if (container) {
        const siblings = Array.from(
          container.querySelectorAll<HTMLElement>(':scope > [role="listitem"][tabindex="0"]')
        );
        if (siblings.length > 0) {
          siblings[siblings.length - 1].focus();
          return;
        }
      }
      // 没有子任务，回到父任务 li
      const parentLi = inputRef.current?.closest('li[role="listitem"]');
      if (parentLi instanceof HTMLElement) parentLi.focus();
    }
  }

  return (
    <div className="px-lg py-xs">
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        aria-label="添加子任务"
        placeholder="+ 添加子任务… --等待人 //日期"
        value={value}
        onChange={(_e, data) => setValue(data.value)}
        onKeyDown={handleKeyDown}
        appearance="underline"
        size="small"
        contentBefore={<AddRegular fontSize={14} />}
        style={{ width: "100%" }}
      />
    </div>
  );
}
