import {
  createLightTheme,
  type BrandVariants,
} from "@fluentui/react-components";

/**
 * 自定义 Brand 色阶（基于 #003DA5 主色）
 * Fluent UI 要求提供 10~160 的 16 个色阶
 */
const dftBrand: BrandVariants = {
  10: "#001224",
  20: "#001D3D",
  30: "#002A5C",
  40: "#003474",
  50: "#003D8C",
  60: "#003DA5",
  70: "#1A56B3",
  80: "#336FC1",
  90: "#4D88CF",
  100: "#66A1DD",
  110: "#80BAEB",
  120: "#99CCF0",
  130: "#B3DDF5",
  140: "#CCEEFA",
  150: "#E6F7FD",
  160: "#F5FBFF",
};

const lightTheme = createLightTheme(dftBrand);

/**
 * DFT 自定义 Fluent 主题
 * 覆盖部分 token 以匹配现有设计系统
 */
export const dftTheme = {
  ...lightTheme,
  // 字体：保持系统字体栈
  fontFamilyBase:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Calibri, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
  // 选中态背景：Outlook 风格浅蓝（品牌色 150 色阶）
  colorNeutralBackground1Selected: "#E8EFF9",
};
