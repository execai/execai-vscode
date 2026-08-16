[English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | **中文**

🌐 **官网：** [execai.ru](https://execai.ru) · 💬 网页版对话：[chat.execai.ru](https://chat.execai.ru) · 🖥 CLI：[execai/execai-agent](https://github.com/execai/execai-agent) · 🖥 编辑器：[ExecAI Studio](https://github.com/execai/execai-studio)

---

# 适用于 VS Code 和 Cursor 的 ExecAI

编辑器侧边栏中的 [execai](https://github.com/execai/execai-agent) 智能体：流式对话、带确认的工具调用、当前文件上下文。整个智能体循环都在你自己机器上的 CLI 中运行，扩展只负责呈现。

## 功能

- **侧边栏对话** —— 流式回答、可折叠的思考块、带实时输出的工具卡片（Bash 会按行实时输出）
- **与 TUI 和网页版完全一致的确认** —— 五个按钮：「仅此一次」「本会话内该工具」「本会话内该命令」「永久」（写入 `permissions.json`）「拒绝」。沉默永远不会扩大权限
- **智能体提问**（AskUser）—— 需要你来定夺时，选项以按钮形式送达
- **编辑器上下文** —— 当前文件与选中内容会附加到消息中（`execai.attachContext`）
- **变更文件** —— 在该轮下方以标签展示，点击即可打开
- **停止** 中断当前回合；**新对话** 重置历史与会话级权限
- **终端后路** —— 「ExecAI: 在终端中打开」命令可获得完整 TUI

数据源（ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…）、模型、记忆和权限都在 CLI 中配置，扩展直接使用你当前的配置。

## 界面语言

面板与命令跟随编辑器的显示语言：目前提供**英文**和**俄文**，其他区域设置回退到英文。新增一种语言只需两个文件、无需改动代码：清单用 `package.nls.<lang>.json`，运行时用 `l10n/bundle.l10n.<lang>.json`，再加上 [src/webviewHtml.ts](src/webviewHtml.ts) 中 `STRINGS` 里的一份词表。单元测试会保证所有词表与英文的键完全一致。

## 安装

1. 安装扩展：
   - **VS Code** —— Marketplace 搜索 `ExecAI`
   - **Cursor / VSCodium / Windsurf** —— Open VSX 搜索 `ExecAI`
   - 或手动安装：从 [Releases](https://github.com/execai/execai-vscode/releases) 下载 `.vsix` → `Extensions: Install from VSIX…`
2. 打开一个项目文件夹，左侧会出现 ExecAI 图标。
3. 首次启动时，扩展会提示**下载智能体**（约 6 MB），它会放进扩展自己的存储目录，
   无需 sudo。如果 PATH 中已有足够新的 execai（R6.49+），则直接使用它。

随后可直接在对话中登录或接入你自己的订阅：`>_` → 「在终端中打开 execai」。

手动安装智能体并非必需，但同样可行：

```bash
curl -fsSL https://raw.githubusercontent.com/execai/execai-agent/main/install.sh | bash
```

## 设置项

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| `execai.binaryPath` | `execai` | 二进制路径。留空或填 `execai` —— 在 PATH 中查找，或由扩展自行下载。 |
| `execai.maxIterations` | `0` | 每回合的工具迭代上限（0 —— 取自 execai 配置）。 |
| `execai.attachContext` | `true` | 将当前文件与选中内容附加到消息。 |
| `execai.autoInstall` | `true` | 当智能体缺失或过旧时提示下载。 |

## 工作原理

扩展会启动 `execai ide --cwd <项目目录>`，并通过 stdin/stdout 以 JSON 行与之通信。协议带版本号：当两端版本不一致时，扩展会请你升级，而不是无声地崩坏。若问题一直无人应答（你关闭了编辑器），智能体会视其为拒绝——与 `execai serve` 后台模式的原则一致。

## 开发

```bash
npm install
npm test          # 单元测试：协议、版本比较、webview 标记、i18n
npm run build     # esbuild → dist/extension.js
npm run package   # 通过 @vscode/vsce 打包 .vsix
```

## 许可

Business Source License 1.1 —— 内部使用与生产使用均免费；以服务形式进行商业托管需要单独授权（it@velesbsd.com）。

## 支持

- 缺陷与需求：[github.com/execai/execai-vscode/issues](https://github.com/execai/execai-vscode/issues)
- 智能体本体：[github.com/execai/execai-agent](https://github.com/execai/execai-agent)
