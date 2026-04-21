import { useState, useRef, useEffect } from "react";
import { tokens } from "@fluentui/react-components";

interface InlineEditorProps {
  /** 当前显示的文本值 */
  value: string;
  /** 保存时的回调，传入新值 */
  onSave: (newValue: string) => void;
  /** 用于 aria-label */
  ariaLabel?: string;
  /** 文本样式（透传给显示文本和输入框） */
  className?: string;
  /** 无值时的占位文字 */
  placeholder?: string;
  /** Tab 键回调（编辑模式下按 Tab 触发，默认防止跳转字段） */
  onTab?: () => void;
  /** 允许保存空值（用于支持清除字段） */
  allowClear?: boolean;
  /** 编辑模式下的输入框样式（替代 className，支持弹出式宽输入） */
  editClassName?: string;
  /** 多行模式：Enter 换行，Ctrl+Enter 保存 */
  multiline?: boolean;
  /** 外部触发进入编辑（计数器） */
  focusTrigger?: number;
}

/**
 * InlineEditor — 原地编辑组件
 *
 * 交互规范：
 * - 单击文本 → 变为输入框，光标在末尾
 * - Enter / blur → 保存（若非空），恢复文本显示
 * - Escape → 取消，恢复原始值
 * - 空值 Enter/blur → 不保存（保留原值）
 */
export function InlineEditor({
  value,
  onSave,
  ariaLabel = "编辑文本",
  className = "",
  placeholder = "",
  onTab,
  allowClear = false,
  editClassName,
  multiline = false,
  focusTrigger = 0,
}: InlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(draft); // 始终同步最新 draft，防止 commit 闭包读到旧值
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 进入编辑时聚焦到末尾
  useEffect(() => {
    if (editing) {
      const el = multiline ? textareaRef.current : inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editing, multiline]);

  // 当外部 value 变化时同步 draft（乐观回滚后更新显示）
  useEffect(() => {
    if (!editing) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value, editing]);

  // 外部 focusTrigger 变化时进入编辑
  const prevFocusTrigger = useRef(0);
  useEffect(() => {
    if (focusTrigger > prevFocusTrigger.current) {
      prevFocusTrigger.current = focusTrigger;
      startEdit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTrigger]);

  function startEdit() {
    setDraft(value);
    draftRef.current = value;
    setEditing(true);
  }

  function commit() {
    // 直接读 DOM 元素的实时值，完全绕过 React 批处理时序问题
    const currentVal = multiline
      ? (textareaRef.current?.value ?? draftRef.current)
      : (inputRef.current?.value ?? draftRef.current);
    const trimmed = currentVal.trim();
    if (allowClear && trimmed === "") {
      onSave("");
    } else if (trimmed && trimmed !== value.trim()) {
      onSave(trimmed);
    } else {
      setDraft(value);
      draftRef.current = value;
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (multiline && e.ctrlKey) {
        // 多行模式：Ctrl+Enter 手动插入换行
        e.preventDefault();
        const ta = textareaRef.current;
        if (ta) {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const newVal = draft.slice(0, start) + "\n" + draft.slice(end);
          draftRef.current = newVal; // 同步 ref
          setDraft(newVal);
          requestAnimationFrame(() => {
            // 先更新光标位置
            ta.selectionStart = ta.selectionEnd = start + 1;
            // 再更新高度，确保换行后内容可见
            ta.style.height = "auto";
            ta.style.height = ta.scrollHeight + "px";
            // 滚动到光标所在行
            ta.scrollIntoView({ block: "nearest" });
          });
        }
        return;
      }
      e.preventDefault();
      const activeEl = multiline ? textareaRef.current : inputRef.current;
      const parentRow = activeEl?.closest<HTMLElement>('[role="listitem"][tabindex="0"]');
      commit();
      if (parentRow) requestAnimationFrame(() => parentRow.focus());
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    } else if (e.key === "Tab" && onTab) {
      e.preventDefault();
      commit();
      onTab();
    }
  }

  if (editing) {
    if (editClassName) {
      return (
        <>
          <span className={`invisible ${className}`} aria-hidden="true">{value || placeholder || '\u00A0'}</span>
          <input
            ref={inputRef}
            type="text"
            aria-label={ariaLabel}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={[
              "outline-none",
              editClassName,
            ].join(" ")}
          />
        </>
      );
    }
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft}
          rows={1}
          onChange={(e) => {
            const v = e.target.value;
            draftRef.current = v; // 同步 ref
            setDraft(v);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onFocus={(e) => {
            // 聚焦时也重新计算高度（已有内容时）
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            borderBottom: `2px solid ${tokens.colorBrandStroke1}`,
            borderRadius: tokens.borderRadiusSmall,
          }}
          className={[
            "outline-none min-w-0 resize-none overflow-hidden px-xs bg-transparent",
            className,
          ].join(" ")}
        />
      );
    }
    const strippedClass = className.replace(/\btruncate\b/, "").replace(/\bmax-w-full\b/, "").replace(/\btext-right\b/, "");
    const hasExplicitWidth = /\bw-\[/.test(className);
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          draftRef.current = v; // 同步 ref
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{
          borderBottom: `2px solid ${tokens.colorBrandStroke1}`,
          borderRadius: tokens.borderRadiusSmall,
        }}
        className={[
          `outline-none min-w-0 px-xs bg-transparent${hasExplicitWidth ? "" : " w-full"}`,
          strippedClass,
        ].join(" ")}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel}：${value || placeholder}`}
      onClick={startEdit}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && startEdit()}
      className={`cursor-text hover:underline decoration-dotted underline-offset-2 ${className}`}
    >
      {value || (placeholder ? <span className="opacity-40">{placeholder}</span> : null)}
    </span>
  );
}
