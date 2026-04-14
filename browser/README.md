# Easy Prompt Browser (WXT)

<!-- ========================== Change Record ========================== -->
<!-- [Date]        2026-03-24                                           -->
<!-- [Type]        Configuration change                                  -->
<!-- [Description] Reorganize the browser extension developer guide after the WXT migration, add Safari converter usage, and document local loading flows for Chrome, Firefox, Safari, and Edge. -->
<!-- [Approach]    Promote README from a short command note to a full developer handbook so the browser workspace can be used without reopening the root documentation. -->
<!-- [Params/Returns] N/A for Markdown documentation.                    -->
<!-- [Impact]      browser/README.md, browser/package.json, package.json, browser/scripts/convert-safari.mjs, browser/wxt.config.ts. -->
<!-- [Risk]        Command names and output paths must stay aligned with the real workspace scripts; this document should be updated together with future build changes. -->
<!-- ================================================================= -->

Easy Prompt 的浏览器扩展子项目已经完整切换到 **WXT**。本目录现在可以独立完成安装、开发、构建、打包，以及 Safari 的 Xcode 工程转换。

## 1. 快速开始

### 环境要求

- Node.js **18+**
- npm **9+**
- Safari 本地调试额外需要：**macOS + Xcode Command Line Tools**

### 安装依赖

```bash
cd browser
npm install
```

### 最常用命令

| 命令                             | 作用                                             |
| -------------------------------- | ------------------------------------------------ |
| `npm run dev`                    | 启动 Chrome MV3 开发模式                         |
| `npm run dev:firefox`            | 启动 Firefox MV3 开发模式                        |
| `npm run dev:safari`             | 启动 Safari MV3 开发模式                         |
| `npm run dev:edge`               | 启动 Edge MV3 开发模式                           |
| `npm run build`                  | 构建 Chrome MV3 产物                             |
| `npm run build:firefox`          | 构建 Firefox MV3 产物                            |
| `npm run build:safari`           | 构建 Safari MV3 产物                             |
| `npm run build:edge`             | 构建 Edge MV3 产物                               |
| `npm run build:all`              | 一次性构建 Chrome / Firefox / Safari / Edge 四端 |
| `npm run zip:chrome`             | 打包 Chrome ZIP                                  |
| `npm run zip:firefox`            | 打包 Firefox ZIP                                 |
| `npm run zip:safari`             | 打包 Safari ZIP                                  |
| `npm run zip:edge`               | 打包 Edge ZIP                                    |
| `npm run zip:all`                | 一次性输出四端 ZIP 包                            |
| `npm run typecheck`              | 执行 TypeScript 类型检查                         |
| `npm run safari:convert`         | 先构建 Safari，再生成 Xcode 工程                 |
| `npm run safari:convert:dry-run` | 仅打印 Safari converter 实际命令，不执行         |
| `node build.js [target]`         | 兼容旧调用方式，内部转发到 WXT 构建脚本          |

> 如果你习惯在仓库根目录操作，也可以使用 `package.json` 中的代理命令，例如 `npm run browser:build`、`npm run browser:safari:convert`。

## 2. 当前目录职责

```text
browser/
├── background/          # 后台 Service Worker 业务逻辑
├── content/             # Content Script 业务逻辑与样式
├── options/             # Options 页 JS/CSS 业务逻辑
├── popup/               # Popup 页 JS/CSS 业务逻辑
├── public/              # WXT 静态资源（scenes.json、icons）
├── scripts/             # Browser 子项目辅助脚本（Safari converter 等）
├── shared/              # Browser 端共享模块（Storage/API/Router/Scenes/...）
├── wxt-entrypoints/     # WXT 专用入口层（background/content/popup/options）
├── build.js             # 兼容旧入口的构建包装器
├── package.json         # Browser 子项目脚本与依赖
├── tsconfig.json        # Browser 子项目 TypeScript 配置
├── wxt-env.d.ts         # WXT 生成类型入口
└── wxt.config.ts        # WXT 主配置（manifest、多浏览器兼容）
```

### 关键约定

- **业务逻辑继续留在原目录**：`background/`、`content/`、`popup/`、`options/`、`shared/`。
- **WXT 只负责入口与构建**：`wxt-entrypoints/` 负责把旧实现接入新的构建链路。
- **静态资源单一真相源**：扩展打包所需的 `scenes.json` 与图标资源统一放在 `public/`。
- **manifest 单一真相源**：不再维护旧版多份 manifest 文件，统一由 `wxt.config.ts` 生成。

## 3. 构建产物说明

| 浏览器            | 目录                         | 用途                                         |
| ----------------- | ---------------------------- | -------------------------------------------- |
| Chrome MV3        | `browser/dist/chrome-mv3/`   | 本地加载 / 手动验证                          |
| Firefox MV3       | `browser/dist/firefox-mv3/`  | 本地临时加载 / 手动验证                      |
| Safari MV3        | `browser/dist/safari-mv3/`   | 提供给 `safari-web-extension-converter` 输入 |
| Edge MV3          | `browser/dist/edge-mv3/`     | 本地加载 / Microsoft Add-ons 上传            |
| Safari Xcode 工程 | `browser/dist/safari-xcode/` | `npm run safari:convert` 生成                |

ZIP 包默认输出到 `browser/dist/` 根目录。

## 4. Chrome 本地加载扩展

最稳妥的方式是先构建，再手动加载产物目录：

```bash
cd browser
npm run build
```

然后：

1. 打开 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择目录：`browser/dist/chrome-mv3`
5. 修改代码后重新执行 `npm run build`，再回到扩展页点击 **刷新**

### Chrome 开发建议

- 想保守验证构建结果：优先用 `npm run build`
- 想要 WXT 的开发体验：使用 `npm run dev`
- 如果你只从仓库根目录操作，可用 `npm run browser:build`

## 5. Firefox 本地加载扩展

先构建 Firefox 产物：

```bash
cd browser
npm run build:firefox
```

然后：

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击 **Load Temporary Add-on...**
3. 选择文件：`browser/dist/firefox-mv3/manifest.json`
4. 修改代码后重新执行 `npm run build:firefox`，然后在调试页点击 **Reload**

### Firefox 注意事项

- 临时扩展在 Firefox 重启后需要重新加载
- 当前项目仍通过 `wxt.config.ts` 中的 manifest hook 兼容 Firefox MV3 的 `background.scripts`
- Popup 无法像 Chrome 一样通过 `openPopup()` 完整工作时，会 fallback 到 `chrome.runtime.getURL('/popup.html')` 新标签页

## 6. Safari 本地开发 / Xcode 转换

Safari 不能像 Chrome / Firefox 一样直接加载解压目录，推荐流程如下：

```bash
cd browser
npm run safari:convert
```

这条命令会做两件事：

1. 先执行 `npm run build:safari`
2. 再调用 `xcrun safari-web-extension-converter`，把 `browser/dist/safari-mv3/` 转成 `browser/dist/safari-xcode/` 下的 Xcode 工程

### 默认行为

- 默认 App Name：`Easy Prompt`
- 默认 Bundle Identifier：`chat.zhiz.easy-prompt`
- 默认平台：`macos`
- 默认语言：`swift`
- 默认不会自动打开 Xcode（`--no-open`）
- 默认不会弹交互确认（`--no-prompt`）

### 常用自定义方式

```bash
# 只查看将要执行的命令
npm run safari:convert:dry-run

# 改 bundle identifier
EASY_PROMPT_SAFARI_BUNDLE_ID=com.example.easy-prompt npm run safari:convert

# 生成同时包含 macOS + iOS 的工程
EASY_PROMPT_SAFARI_PLATFORM=all npm run safari:convert

# 把扩展资源复制到 Xcode 工程中
EASY_PROMPT_SAFARI_COPY_RESOURCES=1 npm run safari:convert
```

### Safari 运行步骤

1. 执行 `npm run safari:convert`
2. 在 `browser/dist/safari-xcode/` 中打开生成的 Xcode 工程
3. 选择 macOS App target 并运行
4. 打开 Safari
5. 在 **Safari → Settings → Extensions** 中启用 Easy Prompt
6. 如需本地未签名调试，请确保 Safari 开发相关选项已启用

> 如果 `xcrun safari-web-extension-converter` 不存在，请先安装 Xcode Command Line Tools。

## 7. Edge 本地加载扩展

先构建 Edge 产物：

```bash
cd browser
npm run build:edge
```

然后：

1. 打开 `edge://extensions`
2. 打开左侧 **开发者模式**
3. 点击 **加载扩展**
4. 选择目录：`browser/dist/edge-mv3`
5. 修改代码后重新执行 `npm run build:edge`，然后点击扩展卡片的 **刷新按钮**

### Edge 注意事项

- Edge 基于 Chromium，内核与 Chrome 高度兼容，扩展加载流程几乎相同
- `wxt.config.ts` 中的 manifest hook 会为 Edge 生成 `browser_specific_settings.edge.strict_min_version: "130"`
- Edge 支持 Chrome Web Store 的部分 API，`chrome.storage`、`chrome.runtime`、`chrome.tabs` 等核心 API 均可正常工作
- 如需上架 Microsoft Add-ons 商店，可直接使用 `npm run zip:edge` 生成的 ZIP 包上传

## 8. 开发与维护建议

### 推荐工作流

#### 日常开发

```bash
cd browser
npm run build
npm run build:firefox
npm run build:edge
npm run typecheck
```

#### 四端回归

```bash
cd browser
npm run build:all
npm run zip:all
npm run safari:convert:dry-run
```

### 为什么保留 `build.js`

`browser/build.js` 仍保留 `node build.js [target]` 的调用方式，是为了兼容旧文档、旧脚本和已有心智；它本身已经不再维护自定义构建逻辑，而是转发到 WXT scripts。

## 9. 常见排查

### 1) 加载后 Popup / Options 页面异常

优先确认：

- 是否重新执行了对应浏览器的构建命令
- 是否加载了正确目录（Chrome: `dist/chrome-mv3`，Firefox: `dist/firefox-mv3/manifest.json`）
- 是否误用了已经废弃的旧版产物路径

### 2) Safari converter 失败

优先确认：

- `xcrun safari-web-extension-converter --help` 能否正常执行
- 是否已经先生成 `browser/dist/safari-mv3/`
- `EASY_PROMPT_SAFARI_BUNDLE_ID` 是否符合你的本地签名/团队要求

### 3) Firefox 背景脚本行为与 Chrome 不一致

这是 Firefox MV3 的已知差异之一；项目已在 `wxt.config.ts` 中对 `background.scripts` 做兼容修正。如果后续升级 WXT 或 Firefox manifest 策略，请同时回看该 hook。

## 10. Skill Panel 兼容性与防回归说明

### 维护范围

本轮兼容性修复最终落在以下文件：

- `browser/content/content.js`
- `shared-ui/skill-panel.js`
- `shared-ui/skill-panel.css`

### 核心根因

#### 1) 重复事件导致无效重置

在 Gemini 等 `contenteditable` 站点，一次输入可能连续触发 `input + keyup`。如果 `content.js` 对相同 `filter` 重复写回，`shared-ui/skill-panel.js` 会重复重置 `_activeIndex` 并再次 `_render()`，表现为高亮丢失、方向键切换失效或交互不稳。

**当前保留实现：**

- `browser/content/content.js::_checkSkillTrigger()` 先比较当前 `filter`，仅在值变化时写入 attribute
- `shared-ui/skill-panel.js` 在 `attributeChangedCallback("filter")` 与 `set filter(...)` 中都保留相同值短路

**防回归要求：**

- 不要移除上述 `filter` 幂等判断
- 如果后续新增新的输入事件监听，必须先确认不会对相同 `filter` 重复提交状态

#### 2) 整块 panel 外壳重建导致整窗闪烁

旧实现会在每次过滤时重新创建 `style`、`.skill-container`、`.skill-scroll`，再执行 `shadowRoot.replaceChildren(style, container)`。由于 panel 外壳包含背景、阴影与暗色 `backdrop-filter`，浏览器会把整块浮窗重新挂载和重绘，表现为“整窗闪烁”。

**当前保留实现：**

- `shared-ui/skill-panel.js` 通过 `_ensureStructure()` 复用 `_styleNode`、`_containerNode`、`_scrollNode`
- 过滤更新时仅执行 `scroll.replaceChildren(...nextNodes)`，不再重建 panel 外壳

**防回归要求：**

- 不要在 `filter` 更新路径中恢复整块 `shadowRoot.replaceChildren(style, container)` 的做法
- 允许替换列表内容，但必须保持外层 `style/container/scroll` 稳定复用

### 输入体感约定

- 首次输入 `/` 唤起 skill 浮窗必须保持即时
- 浮窗已打开后的字符过滤采用 `160ms` trailing debounce
- 关闭浮窗、切换输入框或解绑监听时，必须清理 `_skillFilterDebounceTimer`

### 兼容性补充

- Trusted Types 页面禁止回退到 `innerHTML` / 运行时 SVG 解析链路
- 图标渲染保持 parser-free `mask-image + data URL` 路径，并继续保留缺失 `xmlns` 的 SVG 归一化逻辑
