import { Body1, tokens } from "@fluentui/react-components";
import { useItemStore, selectLongTermItems } from "../../stores/useItemStore";
import { DraggableList } from "../items/DraggableList";
import { QuickCreateInput } from "../inputs/QuickCreateInput";

/**
 * LongTermView — 长期跟进视图（Story 4.1）
 *
 * 展示所有 status=long_term 的顶级跟进项。
 * 顶部快速创建（创建后默认为 long_term 状态需通过 StatusPicker 切换；
 * 此视图的 QuickCreate 与今日聚焦共用同一 createItem，创建后出现在"全部"视图，
 * 用户可从 StatusPicker 切换为 long_term）。
 *
 * 空状态：显示"没有长期跟进项"。
 */
export function LongTermView() {
  const items = useItemStore((s) => s.items);
  const createItem = useItemStore((s) => s.createItem);
  const isLoading = useItemStore((s) => s.isLoading);
  const longTermItems = selectLongTermItems(items);

  return (
    <div className="h-full flex flex-col">
      {/* 快速创建（创建后通过 StatusPicker 切换为长期跟进） */}
      <QuickCreateInput
        onCreate={(title, waitingFor, dueDate) => createItem(title, null, null, dueDate, waitingFor)}
        disabled={isLoading}
      />

      {longTermItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>没有长期跟进项</Body1>
        </div>
      ) : (
        <DraggableList items={longTermItems} ariaLabel="长期跟进列表" />
      )}
    </div>
  );
}
