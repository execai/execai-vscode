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
- **聊天标签页**位于面板顶部，就像编辑器的文件标签：本项目的所有聊天，点击切换，「×」关闭（聊天仍在历史中，进行中的回合继续运行），拖动可调整顺序
- **聊天并行运行**（agent R6.74+）：在某个聊天回答时切换标签——本轮继续进行，回来时从头重放。标签徽标：闪烁的点——工作中，绿点——已完成但未读，«?»——等待你的回答，⏰——已安排唤醒；当你在别处时完成或提问的聊天会弹出带 **Open** 的提示。唤醒（`schedule_wakeup`）显示为带 **Now** / **Cancel** 的一行，并在编辑器重启后保留
- **可点击链接** — URL 在浏览器中打开；项目内路径（`internal/agent/memory.go:42`）会在编辑器中定位到该行
- **复制按钮** — 每个代码块一个，整条回答也有一个（复制原始 markdown）
- **Stop** 中断当前回合；**New chat** 重置历史与会话级权限
- **终端后路** —— 「ExecAI: Open in a terminal」命令可获得完整 TUI
- **Getting started**（agent R7.10+）—— 空对话会先显示五个带勾选标记的步骤：登录、接入模型、开启同步、把文件夹绑定到项目、用手机呼叫智能体。每一步都有完成它的按钮；关闭一次后在所有项目中都保持关闭，可通过 `>_` 菜单或「ExecAI: Getting started」命令重新打开
- **My machine** —— 一张紧凑的卡片，可从面板标题栏、`>_` 菜单或「ExecAI: My machine」命令打开：机器与智能体版本、账号及其套餐、哪些模型来源有响应及其时间、同步会带走哪些内容、网页版对话和手机能否访问这台机器
- **手机二维码** —— 最后一步中的 **Show the QR code** 和卡片上的 **QR for the phone**：用手机摄像头对准它，网页版对话就会打开并选中这台机器。二维码直接在面板中绘制，不从网络获取任何内容
- **子智能体** —— 当智能体把工作分给子智能体时，输入框上方的 **Agents** 区块会逐个列出：状态、标题、「step 12/50 · 38 left」（剩余 5 步及以下时变黄）、最近使用的工具和运行时长；仍在运行的带 **+25** 和 **Stop**，显示「hit the step limit」的可用 **Continue (+25)** 从中断处继续。点击某一行会在只读标签页中打开它目前的工作；`>_` 菜单中的 **Subagent steps** 设置新子智能体的步数上限（1–100，默认 50）
- **来自网页和手机的任务** —— 在网页版对话或手机上发起的任务会在这里以新对话打开：标签页带 🌐，第一条消息为「From the web: …」，弹出带 **Open** 的提示「A task came in from the web: …」，整个回合在面板中流式显示；权限请求可以在这里或网站上回答，以先到者为准。需要登录、包含网页任务功能的 ExecAI 套餐（面板会说明是哪种并给出套餐链接），以及把文件夹绑定到项目——`>_` 菜单中的 **Project**。状态栏和菜单会显示这台机器上由谁接收任务；若任务由后台的 `execai serve` 接收，可点 **Accept here** 改由此处接收
- **独立窗口中的同一对话** —— 智能体的 `execai ui` 命令无需编辑器即可打开对话：没有标签页和地址栏的窗口（没有合适的浏览器时为浏览器标签页），三种外观，各有浅色和深色主题；通过 SSH 时转发端口，并在本地打开打印出的链接。指南：[docs/en/ui.md](https://github.com/execai/execai-agent/blob/main/docs/en/ui.md)

  ![execai ui — 独立窗口中的对话](https://raw.githubusercontent.com/execai/execai-agent/main/docs/ui-demo-en.gif)

- **通知** —— 当前显示的对话结束本轮或等待你的回答，而面板被隐藏或编辑器窗口处于后台时，会弹出通知，其中的 **Open** 按钮会把面板切到该对话；你自己停止的回合不会通知。编辑器窗口处于后台时，配合更新后的智能体，改由智能体本身显示桌面通知（仅限你自己的电脑；远程会话中仍使用编辑器内通知）。在 `execai ui` 中，页面顶部的 🔔 按钮可开启浏览器通知。在编辑器中可用 `execai.notifications` 设置将其关闭
- **同步消息** —— 智能体同步给出的提示（在文件旁保留的副本、被跳过的文件、从服务器取来的版本）会以服务行的形式显示在对话中，并保留换行；同步命令在终端中输入：`execai sync`。指南：[docs/en/sync.md](https://github.com/execai/execai-agent/blob/main/docs/en/sync.md)

数据源（ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…）、模型、记忆和权限都在 CLI 中配置，扩展直接使用你当前的配置。数据源也可以是 **你自己的端点** —— 任意 OpenAI 或 Anthropic 兼容地址（LM Studio、vLLM、LiteLLM、公司网关）：在 `>_` 菜单中选择 **Connect a source → Custom provider**，填写名称、接口类型、地址和密钥。模型列表来自提供商本身。

## 界面语言

面板与命令跟随编辑器的显示语言：目前提供**英文**和**俄文**，其他区域设置回退到英文。新增一种语言只需两个文件、无需改动代码：清单用 `package.nls.<lang>.json`，运行时用 `l10n/bundle.l10n.<lang>.json`，再加上 [src/webviewHtml.ts](src/webviewHtml.ts) 中 `STRINGS` 里的一份词表。单元测试会保证所有词表与英文的键完全一致。

## 安装

1. 安装扩展：
   - **VS Code** —— Marketplace 搜索 `ExecAI`
   - **Cursor / VSCodium / Windsurf** —— Open VSX 搜索 `ExecAI`
   - 或手动安装：从 [Releases](https://github.com/execai/execai-vscode/releases) 下载 `.vsix` → `Extensions: Install from VSIX…`
2. 打开一个项目文件夹，左侧会出现 ExecAI 图标。
3. 首次启动时，扩展会提示**下载智能体**（约 7 MB），它会放进扩展自己的存储目录，
   无需 sudo。如果 PATH 中已有足够新的 execai（R7.21+），则直接使用它。

随后可直接在面板中登录并接入模型：**Getting started** 的每个步骤都有对应按钮，`>_` 菜单里也有同样的入口（「Sign in to ExecAI」「Connect a source」）。

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
| `execai.resumeLastChat` | `true` | 打开面板时继续本项目的上一个对话；关闭则每次从空白开始。 |
| `execai.notifications` | `true` | 当对话结束本轮或等待你的回答，而面板被隐藏或编辑器窗口处于后台时发出通知：在编辑器内（按钮会打开该对话），或在窗口处于后台时以桌面通知提醒。 |

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
