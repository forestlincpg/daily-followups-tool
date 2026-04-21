import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowExportRegular,
  KeyboardRegular,
  SubtractRegular,
  SquareRegular,
  DismissRegular,
} from "@fluentui/react-icons";
import type { TabConfig, TabId } from "../../types";

interface TopTabBarProps {
  tabs: TabConfig[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

const ICON_MAP: Record<string, React.ReactElement> = {
  export: <ArrowExportRegular fontSize={16} />,
  shortcuts: <KeyboardRegular fontSize={16} />,
};

let _appWindow: ReturnType<typeof getCurrentWindow> | null = null;
function getAppWindow() {
  if (!_appWindow) _appWindow = getCurrentWindow();
  return _appWindow;
}

export function TopTabBar({ tabs, activeTab, onTabChange }: TopTabBarProps) {
  const navTabs = tabs.filter((t) => !t.isUtility);
  const utilTabs = tabs.filter((t) => t.isUtility);

  return (
    <nav
      data-tauri-drag-region
      className="flex items-center bg-primary h-11 shrink-0 select-none"
    >
      {/* 左侧：导航标签页 */}
      <div className="flex items-center h-full" style={{ paddingLeft: 8 }}>
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              aria-label={tab.ariaLabel}
              onClick={() => onTabChange(tab.id)}
              className={[
                "relative px-3 h-full text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-inset",
                isActive
                  ? "text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              {tab.label}
              {/* 活动标签底部指示条 */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 中间可拖拽空白区 */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* 右侧：功能图标 + 窗口控制按钮 */}
      <div className="flex items-center h-full">
        {/* 功能图标 */}
        {utilTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              aria-label={tab.ariaLabel}
              title={tab.label}
              onClick={() => onTabChange(tab.id)}
              className={[
                "flex items-center justify-center w-9 h-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-inset",
                isActive
                  ? "text-white bg-white/20"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              {ICON_MAP[tab.id]}
            </button>
          );
        })}

        {/* 分隔线 */}
        <div className="w-px h-3.5 bg-white/20 mx-xs" />

        {/* 窗口控制按钮 */}
        <button
          type="button"
          aria-label="最小化"
          onClick={() => getAppWindow().minimize()}
          className="flex items-center justify-center w-11 h-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <SubtractRegular fontSize={12} />
        </button>
        <button
          type="button"
          aria-label="最大化"
          onClick={() => getAppWindow().toggleMaximize()}
          className="flex items-center justify-center w-11 h-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <SquareRegular fontSize={12} />
        </button>
        <button
          type="button"
          aria-label="关闭"
          onClick={() => getAppWindow().close()}
          className="flex items-center justify-center w-11 h-full text-white/70 hover:bg-red-500 hover:text-white transition-colors"
        >
          <DismissRegular fontSize={12} />
        </button>
      </div>
    </nav>
  );
}
