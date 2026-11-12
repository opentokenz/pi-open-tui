# pi-open-tui

[![omp 状态](https://omppackages.com/badge/pi-open-tui.svg)](https://omppackages.com/packages/pi-open-tui)

[English](./README.md) | **简体中文**

一个为 [Pi](https://pi.dev) 编程代理打造的终端界面扩展。

![pi-open-tui 预览](https://raw.githubusercontent.com/OldSuns/pi-open-tui/main/assets/preview_dashboard_1.png)

## 功能亮点

- **Pi 顶栏**：显示模型、思考等级、当前目录和常用斜杠命令提示
- **自适应底栏**：展示 Git 状态、运行环境、上下文用量、Token、费用和扩展状态
- **带边框的编辑器**：支持块状、竖线和下划线光标，保留其他扩展的兼容编辑器
- **项目环境感知**：识别 50 多种运行环境，并展示 ahead/behind、已暂存、已修改、未跟踪、stash 和分离 HEAD 等 Git 状态
- **单轮遥测**：展示生成速度、首 Token 延迟、耗时、停顿、Token 数量和费用速率
- **思考预览**：模型工作时实时预览隐藏的推理内容
- **紧凑工具视图**：提供编辑/写入预览，可选支持扩展和 MCP 工具
- **全屏复制按钮**：一键复制代码块和用户消息
- **交互式设置**：通过 `/open-tui` 使用英文或简体中文界面

## 环境要求

- Pi 1.5.0 或更高版本
- Node.js 22.19.0 或更高版本（Pi 的最低要求）
- 支持 UTF-8 和彩色输出的终端
- 使用完整图标集时需要 [Nerd Font](https://www.nerdfonts.com/font-downloads)（可选，也可使用 Unicode 或 ASCII 模式）

## 安装

安装扩展：

```bash
pi install npm:pi-open-tui
```

也可以只在当前会话中试用：

```bash
pi -e npm:pi-open-tui
```

## 字体与图标

使用完整图标集时，请安装 [Nerd Font](https://www.nerdfonts.com/font-downloads)，在终端配置中选中它并重启终端。使用 VS Code、Windows Terminal 等应用时，只在操作系统中安装字体还不够。

`/open-tui` 的**外观 → 图标**提供 `auto`、`nerd`、`unicode` 和 `ascii`。默认 `auto` 检查终端环境，并不检查实际字体；图标显示为方框时可选 `unicode`，终端已配置 Nerd Font 时可强制选 `nerd`，SSH 会话同样适用。

自动选择规则和 Kitty 的间距选项见[图标检测与间距](./docs/configuration.md#图标)。

## 配置

运行 `/open-tui` 打开设置窗口，包含**常规**、**外观**、**底栏**和**遥测**四个页面，支持英文和简体中文，并适应终端尺寸。Tab/Shift+Tab 或 ←/→ 切页，↑/↓ 移动，Enter/Space 修改值，Esc/q 关闭。

设置保存在 Pi 的 agent 目录内的 `open-tui.json` 中，默认目录是 `~/.pi/agent`，可通过 `PI_CODING_AGENT_DIR` 覆盖。保存失败时会提示：修改仅在当前会话生效。

| 页面 | 分组 |
| --- | --- |
| 常规 | 扩展、界面、消息与工具、底栏 |
| 外观 | 图标、输入框 |
| 底栏 | 位置、Git、运行环境、用量、其他 |
| 遥测 | 启用（独立总开关）、测量指标 |

使用 Tab/Shift+Tab 或 ←/→ 切页，↑/↓ 或 Page Up/Page Down 移动到设置项，Enter/Space 修改值，Esc/q 关闭。分组标题各占一行，导航会跳过标题，点击标题也不会选中或修改设置。列表会在终端可用高度内滚动，位置提示按设置行和标题行一起计数。现有配置文件无需迁移。

在**常规 → 消息与工具**中选择**工具视图：紧凑**后，才会显示缩进的子选项**紧凑显示扩展工具**。切回**原生**时会隐藏子选项，并保留其开关状态，下次选择**紧凑**时继续使用。**底栏嵌入输入框**位于**常规 → 底栏**。

配置示例：

```json
{
  "enabled": true,
  "header": true,
  "inlineFooter": false,
  "contextStyle": "bar",
  "copyButtons": true,
  "hideThinkingLabel": true,
  "settingsLanguage": "zh",
  "cursorStyle": "block",
  "icons": {
    "mode": "auto"
  },
  "footerSegments": {
    "cwd": true,
    "hostname": false,
    "sessionName": false,
    "gitBranch": true,
    "gitStatus": true,
    "gitCommit": false,
    "runtime": true,
    "context": true,
    "contextBar": true,
    "tokens": true,
    "cost": true,
    "liveTps": true,
    "extensionStatuses": true,
    "capitalizeProviderName": true,
    "nerdIconSpacing": false
  },
  "telemetry": {
    "enabled": true,
    "tps": true,
    "ttft": true,
    "duration": true,
    "tokens": true,
    "stalls": true,
    "cost": true
  },
  "thinkingPeek": {
    "lines": 1
  },
  "toolView": {
    "mode": "native",
    "bar": true,
    "extensionTools": false,
    "exclude": []
  },
  "fast": {
    "persistState": false,
    "desiredActive": false,
    "supportedModels": ["openai/gpt-5.4", "openai-codex/gpt-5.4"]
  }
}
```

主要选项：

| 选项 | 可选值 | 说明 |
| --- | --- | --- |
| `hideThinkingLabel` | `true`、`false` | 把 Pi 为折叠思考块画的标签置空（包括已加载的历史）；默认 `true`。该行仍会占一行且保持可点击 |
| `settingsLanguage` | `en`、`zh` | 切换 `/open-tui` 设置界面的语言 |
| `header` | `true`、`false` | 决定是否用 open-tui 顶部信息栏覆盖 Pi 的 Header；设为 `false` 时把顶部栏位置留给 Pi 或其他扩展 |
| `inlineFooter` | `true`、`false` | 将两条主要 Footer 信息行移入编辑器上下边框以节省垂直空间，默认关闭；扩展状态行仍显示在编辑器外 |
| `contextStyle` | `bar`、`numbers` | 上下文用量的画法：`bar` 显示条形和百分比，`numbers` 显示百分比和已用/窗口 Token；默认 `bar` |
| `copyButtons` | `true`、`false` | 全屏模式下给代码块加圆角边框，并在代码块和用户消息上显示可点击的 `[Copy]` 标签，默认开启；见[复制按钮](#复制按钮) |
| `cursorStyle` | `block`、`bar`、`underline` | `bar` 和 `underline` 需要终端支持光标形状转义序列 |
| `icons.mode` | `auto`、`nerd`、`unicode`、`ascii` | 控制底栏和遥测通知使用的图标 |
| `footerSegments` | 布尔开关 | 分别控制底栏中的各项数据 |
| `footerSegments.contextBar` | 布尔开关 | 隐藏上下文进度条及其图标，仅保留百分比和 Token 用量；默认 `true` |
| `footerSegments.capitalizeProviderName` | 布尔开关 | 将底栏中提供商名称的首字母大写；设为 `false` 时保留原始大小写 |
| `footerSegments.nerdIconSpacing` | 布尔开关 | 在底栏 Nerd Font 图标后额外留一格空白；默认 `false` |
| `toolView.bar` | `true`、`false` | 在紧凑工具行左侧画状态色 `▌` 竖条；默认开启 |
| `telemetry` | 布尔开关 | 控制遥测总开关和各项指标 |
| `thinkingPeek.lines` | `0`、`1`、`2` | 关闭、单行或双行思考预览 |
| `toolView.mode` | `native`、`compact` | Pi 原生卡片（默认），或带编辑/写入成功预览的紧凑调用与摘要行。只对切换后新建的行生效 |
| `toolView.extensionTools` | `true`、`false` | 紧凑模式下，把扩展工具、MCP 工具和替换内置同名工具的扩展也折叠成通用行；默认 `false`。见[工具视图](#工具视图) |
| `toolView.exclude` | 工具名列表 | 始终保持原生渲染的工具，例如 `["subagent_wait"]`；默认 `[]` |
| `fast.supportedModels` | `provider/model` 规则 | 会收到优先服务等级的模型；默认 `["openai/gpt-5.4", "openai-codex/gpt-5.4"]`。见 [Fast 模式](#fast-模式) |
| `fast.persistState` | `true`、`false` | 把每次 `/fast` 的状态写入 `fast.desiredActive`，下次会话沿用；默认 `false` |
| `fast.desiredActive` | `true`、`false` | 会话启动时的 Fast 状态；仅在 `persistState` 开启时读取 |

选择**工具视图：紧凑**后，才会显示子选项**紧凑显示扩展工具**；切回原生时隐藏该选项并保留其值。完整 JSON 默认配置、所有选项和工具排除列表见[配置参考](./docs/configuration.md#简体中文)。

## 顶栏、底栏与编辑器

顶栏提供模型、项目环境和命令提示。两条主底栏集中显示位置、Git 状态、运行环境、工作/完成计时器、上下文用量、模型详情、Token 和费用。可单独开关各项字段；终端变窄时，布局会缩短或隐藏低优先级信息。

上下文用量由 `contextStyle` 决定：`bar` 画出条形和百分比，`numbers` 用百分比和已用/窗口 Token 取代条形及其图标。设 `footerSegments.contextBar: false` 可去掉条形及其图标，只保留百分比和 Token 总计。两种情况下会话 Token 与费用总计都保留在第二行。

第二行以模型名称和思考等级打头，并且在缩短它们之前会先去掉其他内容：先去掉模型图标和提供商名称，再让缓存命中、输出、费用、输入逐项让出空间。Fast 生效时，模型名后会跟一个小标记；见 [Fast 模式](#fast-模式)。

底栏 Token 和费用总计包含助手回复、工具报告的用量、压缩与分支摘要以及缓存预热；缓存命中率表示最近一条助手回复。其他扩展可以使用独立状态行，也可以[直接向主底栏添加内容](./docs/footer-segments.md)。

开启**底栏嵌入输入框**，可把两条主信息行移入编辑器上下边框，扩展状态行仍显示在编辑器下方。兼容编辑器会保留输入行为、补全和灰字建议；无法加框的编辑器继续使用独立底栏。集成边界见[编辑器兼容性与布局](./docs/implementation.md#编辑器与布局)。

## 单轮遥测

每次 Agent 完整运行结束后，pi-open-tui 会合并其中的助手轮次，显示一条临时结果：

```text
> TPS 42.5 tok/s | ~ TTFT 1.2s | + 29.7s | ↑ 567 | ↓ 1.2k | ! stall 1x / 4.3s | $ $3.60/M
```

TPS 用服务商报告的输出 Token 除以生成时间，包含等待和停顿，不包含轮次之间的工具执行时间。流式输出期间，工作计时器还会显示 `~54 tok/s` 这样的实时估算速度。`$ / M` 表示本次运行每百万 Token 的综合费率，底栏则显示会话累计费用。

可在**遥测 → 测量指标**中开关通知字段，在**底栏 → 运行环境 → 实时 TPS**中控制实时速度。计算公式、计时边界和缓存统计见[指标定义](./docs/implementation.md#用量与遥测)。

## 思考预览

开启 Pi 的 **Hide thinking** 后，模型工作时 pi-open-tui 会用最新推理片段替换隐藏思考块的 `Thinking...` 标签：

```text
~ think ⠋ 上一条思考
          最新一条思考
```

该字幕仅在模型真正输出推理内容后出现，非推理模型不会显示，正文开始后变为对勾。可见性由 Pi 自身的 Hide thinking 开关控制，切换后立即生效；每一行都按*显示宽度*截断（全角字符计 2 列），因此中文思考文本也不会溢出终端。可在 `/open-tui` 的**常规 → 消息与工具 → 思考预览**中切换，或直接修改 `open-tui.json` 中的 `thinkingPeek.lines`。折叠块只在流式过程中显示推理字幕，运行结束后会变成空白行，因为 `hideThinkingLabel` 默认为 `true`；设为 `false` 可恢复 Pi 的 `Thinking...` 标签。

## 工具视图

默认使用**原生**模式。在**常规 → 消息与工具 → 工具视图**中选择**紧凑**后，Pi 内置工具（`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`，以及需要手动启用的 `codemode` 和 `tool_search`）显示为调用行和摘要行：

```text
▌ ● Read(extensions/open-tui/footer.ts:1-120)
▌   └  120 lines
▌ ● Edit(extensions/open-tui/footer.ts)
▌   └  +2 −1
▌ ● Bash(npm test)
▌   └  Done · 131 lines · 6.4s
▌ ● Codemode(const results = await Promise.allSettled([ … (+3 lines))
▌   ├  ✓ Read(src/config.ts) · 12ms
▌   ├  ✓ Find(*test.ts) · 18ms
▌   ├  ✓ Bash(npm test) · 2.6s
▌   └  Done · 3 calls · 2.7s
▌      42 tests passed
▌ ● Tool Search(browser screenshot)
▌   └  Loaded 3 tools · 24ms
▌      browser_snapshot · browser_click · browser_screenshot
```

- 一次调用及其结果共用一条状态条：`▌` 用状态色（运行中黄、成功绿、失败红）。不画背景也不画边框，长会话不会满屏色带。`toolView.bar` 关闭状态条。
- 成功后调用与摘要文字变暗，圆点为绿色；等待时圆点变暗，运行时圆点每秒在主题强调色与暗色之间切换。错误继续显示红色圆点与摘要。Shell 失败摘要保留最后一行输出；运行中显示最新 3 行输出和已用时间。
- `edit` 成功预览解析 Pi 的真实 diff，分别对旧代码和新代码做语法高亮，删除/新增行使用红/绿背景色带。没有有效 diff 时保留摘要。
- `write` 成功预览在正常背景上显示行号和语法高亮；新建与覆盖写入显示相同，部分结果和错误不显示预览。
- 预览正文最多显示 16 行，超过时显示隐藏行数与 `Ctrl+O` 提示。仅紧凑模式下，长行以 `…` 横向截断，不自动换行。
- `codemode` 最多显示最近三条子调用的状态、参数和耗时，随后显示脚本状态、子调用总数、已用时间及一行输出或错误。保留图片数量和输出截断提示；展开可查看更早的调用与完整输出。调用摘要跳过可选的脚本选项头。
- `tool_search` 显示已加载工具的数量与最多三个工具名，更多工具会提示展开。两者均无需开启**紧凑显示扩展工具**。
- 点击某行只展开这一行为 Pi 原生卡片，`Ctrl+O` 展开全部行；原生展开视图的完整输出、diff 和截断提示保持不变。各次调用独立显示，不分组。
- 只改变显示：工具、参数、结果以及模型看到的内容都不受影响。默认仅接管 Pi 确认来源为内置的工具；第三方和 MCP 工具保持各自的渲染。
- 开启**紧凑显示扩展工具**（`toolView.extensionTools: true`）后，其余工具也会折叠，包括 MCP 工具和替换内置同名工具的扩展。它们的输出格式未知，摘要只显示文字行数、图片数量、耗时和第一行，没有编辑/写入预览；截断根据 `details.truncation.truncated: true` 等明确标记判断。依靠原生渲染器显示实时进度的工具可列入 `toolView.exclude`，内置工具同样适用。
- 对识别到的 `@ff-labs/pi-fff` 安装，使用搜索摘要：`ffgrep` 和 `fff-multi-grep` 显示当前页匹配数，`fffind` 显示总匹配文件数；展开保留 FFF 原生输出。
- 展开的行使用 Pi 解析出的渲染器；结果里的内联图片折叠时仍会显示，因为 Pi 会把图片画在这一行下方。
- 模式与状态条在 Pi 创建某行时确定，因此切换只影响新建的行；执行 `/reload` 或新开会话后整个记录都会应用。

预览规则、扩展摘要和渲染器兼容性见[工具渲染细节](./docs/implementation.md#工具渲染)。

## 复制按钮

全屏模式（Pi 的 `tuiMode: "fullscreen"`）下，完成的代码块会在宽度足够时，在圆角边框中显示可点击的 `[Copy]` 标签；用户消息也有复制标签。点击后复制原文，Pi 会短暂提示 `Copied!`。

```text
╭─ sh ─────────────── [Copy] ╮
│ pi install npm:pi-open-tui │
╰────────────────────────────╯
```

代码标签复制不含围栏的代码，保留缩进和制表符；用户消息标签复制输入原文。流式代码块会在输出结束后显示标签；普通模式和思考块保留 Pi 原生围栏。复制整条助手回复请使用 Pi 的 `/copy`。

可在**常规 → 消息与工具 → 复制按钮**中开关此功能。宽度限制、代码块缓存和与其他渲染器共存的细节见[复制按钮说明](./docs/implementation.md#复制按钮行为)。

## Fast 模式

`/fast` 开关当前会话的优先服务等级。只有 `provider/model` 命中 `fast.supportedModels` 规则的请求才会带上 `service_tier: "priority"`；其他请求、payload 的其余内容、会话记录和费用统计都不变。Fast 生效时，模型名后会显示一个小标记。

规则区分大小写，匹配完整的 provider 与模型 ID。第一个 `/` 分隔 provider 与模型 ID，模型 ID 本身可含 `/` 分段，`*` 只在单个分段内匹配：

- `openai/gpt-5.4` —— 精确匹配这一对；内置默认值，与 `openai-codex/gpt-5.4` 一起
- `relay/gpt-*` —— `relay` 提供商下的任意 `gpt-*` 模型
- `*/gpt-*` —— 显式写了 provider 通配符，因此任意提供商的这些模型都匹配
- `relay/team/gpt-*` —— `relay` 提供商的 `team/gpt-*` 模型；通配符不跨斜杠

在未配置的模型上打开 Fast 会保留开启状态并给出警告，切到已配置的模型后即可生效。`fast.persistState: true` 时，每次 `/fast` 都会把状态写入 `fast.desiredActive`，下次会话按该状态启动。

Fast 原本是独立的 `pi-fast-openai` 扩展。使用内置命令前请先移除它，因为两者都会注册 `/fast`。给第三方端点加规则前，请先确认它接受 `service_tier: "priority"`。

## 文档

- [配置参考](./docs/configuration.md#简体中文) — 完整默认值、配置项和图标选择规则
- [实现与兼容性](./docs/implementation.md#简体中文) — 指标公式、布局、渲染和生命周期
- [扩展底栏接口（英文）](./docs/footer-segments.md) — 面向扩展开发者的公开事件和接入示例
- [更新日志](./CHANGELOG.md) — 已发布和待发布的改动

## 本地开发

```bash
npm install
npm test
npm run typecheck
pi -e .
```

CI 在 Linux、Windows、macOS 上，使用 Node.js 22.19.0 和 24 检查 Pi 1.5.0 及最新版本。核对兼容性时应让所有 Pi 包保持同一版本。终端字体、鼠标交互和光标支持可通过 `pi -e .` 实际检查。

## 致谢

本项目基于多个 Pi 社区包的工作：

- **[pi-haiku](https://github.com/nnocte/pi-haiku)** — 双行底栏结构和工作计时器
- **[pi-claude-code-tui](https://github.com/Phoobobo/pi-claude-code-tui)** — Pi Logo 图案与圆角编辑器边框技术
- **[pi-zentui](https://github.com/lmilojevicc/pi-zentui)** — Starship 风格底栏、运行环境检测、会话生命周期和设置界面模式
- **[pi-tps](https://github.com/monotykamary/pi-tps)** — 单轮计时、停顿检测和保守的 TPS 计算方式
- **[pi-polish](https://github.com/Pringled/pi-extensions/blob/main/packages/pi-polish)** — 紧凑的工具调用行和带语法高亮的编辑 diff

Logo 图案源自 Pi 官方安装脚本（`pi.dev/install.sh`）。运行环境检测和 Git porcelain 解析借鉴了 `pi-zentui` 的结构。

特别感谢 **[LINUX DO](https://linux.do)** 社区的支持。

## 许可证

[MIT](./LICENSE)
