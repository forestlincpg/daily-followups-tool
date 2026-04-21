# Daily Follow-ups Tool

> 轻量级桌面待办跟进工具 —— 专为日常工作待办追踪设计，支持子任务、多视图、键盘快捷操作与智能快速创建。

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## 功能特性

### 多视图切换
- **Today Focus** — 只显示今日到期、逾期和等待中的待办，帮你聚焦当天最重要的事
- **All Items** — 按状态分组浏览所有任务（待办 → 等待 → 长期 → 已完成）
- **Long-Term** — 长期跟进项集中管理
- **Done** — 已完成事项归档查看
- **Export** — 按日期范围和状态筛选，导出 Markdown / CSV

### 智能快速创建
在顶部输入框中使用特殊语法快速创建待办：

```
买牛奶 --张三 //4/10
```

- `--张三` → 设置等待人，状态自动切换为"等待中"
- `//4/10` → 设置截止日期（支持 `//2026/4/10`、`//今天`、`//明天`）

### 子任务层级
- 支持父子任务关系，可展开/折叠子任务列表
- `Tab` 键快速添加子任务
- `Ctrl+Shift+↑` 将子任务提升为顶级任务

### 拖拽排序
- 鼠标拖拽手柄自由排序
- `Ctrl+↑ / Ctrl+↓` 键盘快速调整顺序

### 更多功能
- **撤销** — `Ctrl+Z` 支持最多 10 步撤销
- **星标强调** — `Ctrl+B` 标记重要事项
- **详情面板** — 双击打开右侧滑出面板，编辑备注、链接等
- **状态流转** — 待办 / 等待中 / 长期 / 已完成，支持状态变更历史
- **全键盘操作** — 内置快捷键帮助面板，无需鼠标即可完成所有操作

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 聚焦快速创建输入框（无选中文本时） |
| `Ctrl+Tab` | 切换视图标签 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+S` | 打开状态选择器 |
| `Ctrl+B` | 切换星标 |
| `↑ / ↓` | 上下导航 |
| `→` | 展开子任务 |
| `←` | 折叠子任务 |
| `Tab` | 添加子任务 |
| `Ctrl+↑ / Ctrl+↓` | 移动排序 |
| `Ctrl+Shift+↑` | 提升子任务为顶级 |
| `Delete` | 删除任务 |
| `Escape` | 取消 / 关闭 |

## 技术栈

- **桌面框架**: [Tauri 2](https://v2.tauri.app/) (Rust)
- **前端**: React 19 + TypeScript
- **UI 组件**: [Fluent UI React v9](https://react.fluentui.dev/)
- **状态管理**: Zustand 5
- **样式**: Tailwind CSS 3
- **数据库**: SQLite（本地持久化）
- **拖拽**: @dnd-kit
- **构建**: Vite 7

## 安装

### 从 Release 下载（推荐）

前往 [Releases](https://github.com/forestlincpg/daily-followups-tool/releases) 页面，下载最新的 `.exe` 安装包，双击安装即可。

### 从源码构建

**前置要求**：
- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)

```bash
# 克隆仓库
git clone https://github.com/forestlincpg/daily-followups-tool.git
cd daily-followups-tool

# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建生产版本
pnpm tauri build --bundles nsis
```

构建产物位于 `src-tauri/target/release/bundle/nsis/`。

## 项目结构

```
daily-followups/
├── src/                    # React 前端源码
│   ├── components/         # UI 组件
│   │   ├── layout/         # AppShell, TopTabBar
│   │   ├── inputs/         # QuickCreate, InlineEditor
│   │   ├── items/          # FollowUpItem, DraggableList
│   │   ├── controls/       # StatusBadge, DatePicker
│   │   ├── panels/         # DetailSlidePanel
│   │   └── views/          # AllItems, DoneView, ExportView
│   ├── stores/             # Zustand 状态管理
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数
├── src-tauri/              # Tauri / Rust 后端
│   └── src/                # Rust 命令与 SQLite 操作
├── package.json
└── tauri.conf.json
```

## License

MIT
