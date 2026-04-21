import { useMemo } from "react";
import { Body1, tokens } from "@fluentui/react-components";
import { useItemStore, selectAllItems } from "../../stores/useItemStore";
import { DraggableList } from "../items/DraggableList";

/**
 * DoneView — 已完成视图
 */
export function DoneView() {
  const items = useItemStore((s) => s.items);
  const allItems = selectAllItems(items);
  const doneItems = useMemo(() => allItems.filter((i) => i.status === "done"), [allItems]);

  if (doneItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Body1 style={{ color: tokens.colorNeutralForeground3 }}>还没有已完成的跟进项</Body1>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DraggableList items={doneItems} ariaLabel="已完成跟进项列表" />
    </div>
  );
}
