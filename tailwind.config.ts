import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // ── 颜色系统 ──────────────────────────────────────────
      colors: {
        // 主色
        primary: {
          DEFAULT: "#003DA5",
          light: "#E8EFF9",
          dark: "#002D7A",
        },
        // 状态色（四种跟进项状态）
        status: {
          todo: "#2563EB",      // 待办 - 蓝，需要行动
          waiting: "#EA580C",   // 等待他人 - 橙，有人卡你
          done: "#16A34A",      // 已完成 - 绿，安心
          longTerm: "#FDBA74",  // 长期跟进 - 浅橙/杏，不急
        },
        // 功能色
        overdue: "#DC2626",     // 逾期日期文字（仅日期变红）
        emphasis: "#FEF3C7",    // 强调高亮背景（浅琥珀）
        // 中性色
        surface: {
          bg: "#FFFFFF",        // 主内容区背景
          sidebar: "#F8FAFC",   // 侧边栏背景，极浅灰
          hover: "#F1F5F9",     // 列表项悬停
          border: "#E2E8F0",    // 边框/分隔线
        },
        // 文字色
        content: {
          primary: "#1E293B",   // 主文字：标题、正文
          secondary: "#64748B", // 次要文字：元数据（日期、owner）
        },
      },

      // ── 字体系统 ──────────────────────────────────────────
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Calibri",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans SC"',
          "sans-serif",
        ],
      },

      // ── 字号层级 ──────────────────────────────────────────
      fontSize: {
        // 子任务 / 辅助文字
        meta: ["12px", { lineHeight: "1.4" }],
        // 主任务标题
        body: ["13px", { lineHeight: "1.5" }],
        // 分区标题 H2
        section: ["15px", { lineHeight: "1.3" }],
        // 视图标题 H1
        view: ["18px", { lineHeight: "1.3" }],
      },

      // ── 间距系统（叠加 Tailwind 默认间距）──────────────────
      spacing: {
        xs: "4px",   // 图标与文字间距、标签内边距
        sm: "8px",   // 状态标签之间、元数据项之间
        md: "12px",  // 列表项内边距（上下）
        lg: "16px",  // 列表项内边距（左右）、区块间距
        xl: "24px",  // 视图区块之间
      },

      // ── 圆角系统 ──────────────────────────────────────────
      borderRadius: {
        sm: "2px",   // 最小圆角
        md: "4px",   // 常规（默认）
        lg: "6px",   // 组件，如 badge / 状态标签
        xl: "8px",   // 卡片层级
      },

      // ── 阴影（极浅，仅用于层级区分）──────────────────────
      boxShadow: {
        layer: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        panel: "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
