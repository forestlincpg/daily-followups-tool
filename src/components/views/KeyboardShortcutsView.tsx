import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  Title2,
  Subtitle2,
  tokens,
  Badge,
  Divider,
} from "@fluentui/react-components";

interface ShortcutRow {
  keys: string;
  desc: string;
}

function ShortcutTable({ rows }: { rows: ShortcutRow[] }) {
  return (
    <Table size="small" style={{ marginBottom: 16 }}>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.keys}>
            <TableCell style={{ width: 180, paddingTop: 6, paddingBottom: 6 }}>
              <Badge
                appearance="outline"
                color="informative"
                shape="rounded"
                size="medium"
                style={{ fontFamily: "monospace" }}
              >
                {r.keys}
              </Badge>
            </TableCell>
            <TableCell style={{ paddingTop: 6, paddingBottom: 6, color: tokens.colorNeutralForeground3 }}>
              {r.desc}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function KeyboardShortcutsView() {
  return (
    <div className="p-xl max-w-2xl mx-auto">
      <Title2 style={{ marginBottom: 16 }}>键盘快捷键</Title2>

      <section style={{ marginBottom: 24 }}>
        <Subtitle2 style={{ marginBottom: 8, display: "block" }}>全局</Subtitle2>
        <Divider style={{ marginBottom: 8 }} />
        <ShortcutTable
          rows={[
            { keys: "Ctrl + Z", desc: "撤回上一步操作（最多 10 次）" },
            { keys: "Ctrl + C", desc: "聚焦到快速创建输入框（无文字选中时）" },
          ]}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <Subtitle2 style={{ marginBottom: 8, display: "block" }}>跟进项操作（选中行时）</Subtitle2>
        <Divider style={{ marginBottom: 8 }} />
        <ShortcutTable
          rows={[
            { keys: "Ctrl + S", desc: "打开状态选择器" },
            { keys: "Ctrl + B", desc: "切换强调星标 ★" },
            { keys: "Tab", desc: "继续添加子任务（已展开时）" },
            { keys: "→", desc: "展开子任务并聚焦创建框" },
            { keys: "←", desc: "收起子任务" },
            { keys: "↑ / ↓", desc: "上下切换选中项（包含子任务）" },
            { keys: "Ctrl + ↑ / ↓", desc: "上下移动项目（拖拽排序）" },
            { keys: "Ctrl + Shift + ↑", desc: "将子任务提升为主任务" },
            { keys: "Delete", desc: "删除当前项" },
            { keys: "Escape", desc: "取消选中" },
          ]}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <Subtitle2 style={{ marginBottom: 8, display: "block" }}>编辑模式</Subtitle2>
        <Divider style={{ marginBottom: 8 }} />
        <ShortcutTable
          rows={[
            { keys: "Enter", desc: "保存并退出编辑" },
            { keys: "Escape", desc: "取消编辑，恢复原值" },
            { keys: "Tab", desc: "保存并触发下一步操作" },
          ]}
        />
      </section>

      <section>
        <Subtitle2 style={{ marginBottom: 8, display: "block" }}>快速创建语法</Subtitle2>
        <Divider style={{ marginBottom: 8 }} />
        <ShortcutTable
          rows={[
            { keys: "--张三", desc: "设置等待人（创建后自动切为等待状态）" },
            { keys: "//2026/3/30", desc: "设置截止日期" },
            { keys: "//今天 或 //td", desc: "日期设为今天" },
            { keys: "//明天 或 //tmr", desc: "日期设为明天" },
            { keys: "//3-30", desc: "日期设为当年3月30日" },
          ]}
        />
      </section>
    </div>
  );
}
