# Easy Prompt - 常见问题 FAQ

## 安装与配置

### Q: 安装后需要配置吗？

**A:** 不需要！Easy Prompt 支持**开箱即用**，内置 AI 服务，安装后无需任何配置即可使用。如果你希望使用自己的 API Key，可以在设置中填写，填写后会自动切换为用户配置。

### Q: 如何配置自己的 API Key（可选）？

**A:** 配置步骤：

1. VSCode：设置（Cmd+,）→ 搜索 "Easy Prompt" → 填写 API Key
2. IntelliJ：Settings → Tools → Easy Prompt → 填写 API Key

### Q: API Key 在哪里获取？

**A:** 根据你使用的 API 提供商：

- **OpenAI**: https://platform.openai.com/api-keys
- **Azure OpenAI**: Azure Portal → OpenAI 服务 → Keys and Endpoint
- **Gemini (Google)**: https://makersuite.google.com/app/apikey
- **DeepSeek**: https://platform.deepseek.com/api-keys
- **本地 Ollama**: 不需要 API Key，Base URL 设为 `http://localhost:11434/v1`

### Q: Base URL 应该怎么配置？

**A:** 必须以 `/v1` 结尾，常见配置：

- OpenAI: `https://api.openai.com/v1`
- Azure: `https://your-resource.openai.azure.com/openai/deployments/your-deployment/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1`
- DeepSeek: `https://api.deepseek.com/v1`
- 第三方中转: `https://your-proxy.com/v1`

### Q: 模型名称怎么填？

**A:** 根据你的 API 提供商：

- OpenAI: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
- Gemini: `gemini-3-pro-preview`, `gemini-pro`
- DeepSeek: `deepseek-chat`
- Ollama: `qwen`, `llama3`, `mistral`

## 使用问题

### Q: 提示 "未找到 curl 命令"？

**A:** 插件使用 curl 调用 API。解决方法：

- **macOS/Linux**: 系统自带 curl，检查 PATH 环境变量
- **Windows**:
  - Windows 10+ 自带 curl，检查是否在 PATH 中
  - 或下载安装：https://curl.se/windows/

### Q: 点击"增强选中文本"没反应？

**A:** 检查：

1. 如果未选中文本，会自动 fallback 到智能增强（读取文件或剪贴板）
2. API Key 是否配置正确（或使用内置服务）
3. 网络连接是否正常
4. 查看右下角是否有错误提示

### Q: 智能增强（Ctrl+Alt+I）是如何工作的？

**A:** 智能增强按优先级自动选择内容源：

1. **选中文本**（最高优先）— 直接增强选中内容
2. **当前文件**（≤ 50 行且 ≤ 2000 字符）— 增强整个文件
3. **剪贴板内容**（≤ 10000 字符）— 增强剪贴板中的文本

多来源可用时会弹出选择列表，单来源时直接使用。

### Q: API 调用超时？

**A:** 可能原因：

1. **网络问题**: 检查网络连接，尝试使用代理
2. **API 服务慢**: 复合任务可能需要 30s+，请耐心等待
3. **配置错误**: Base URL 是否正确

### Q: 提示 "API Key 无效或已过期"？

**A:**

1. 检查 API Key 是否复制完整（前后无空格）
2. 确认 API Key 未过期
3. 检查账户余额是否充足
4. 确认 Base URL 和 Model 是否匹配

### Q: 提示 "API 请求频率超限"？

**A:**

1. 稍等几分钟后重试
2. 升级 API 套餐提高频率限制
3. 考虑使用其他 API 提供商

## 功能问题

### Q: 如何查看所有支持的场景？

**A:**

- VSCode: Ctrl+Alt+L 或命令面板 → "Easy Prompt: 浏览场景列表"
- IntelliJ: Ctrl+Alt+L

### Q: AI 识别的场景不对怎么办？

**A:** 使用"指定场景增强"功能（Ctrl+Alt+M）手动选择场景，跳过 AI 意图识别。

### Q: 生成的 Prompt 太长/太短？

**A:**

1. 调整输入描述的详细程度
2. 使用"指定场景"功能选择更精准的场景
3. 生成后手动编辑调整

### Q: 支持哪些快捷键？

**A:**

- `Ctrl+Alt+I`: 智能增强（自动选择内容源）
- `Ctrl+Alt+P`: 增强选中文本
- `Ctrl+Alt+O`: 快速输入增强
- `Ctrl+Alt+L`: 浏览场景列表
- `Ctrl+Alt+M`: 指定场景增强
- `Ctrl+Alt+H`: 查看使用教程

### Q: 可以更改快捷键吗？

**A:**

- VSCode: 设置 → Keyboard Shortcuts → 搜索 "Easy Prompt"
- IntelliJ: Settings → Keymap → 搜索 "Easy Prompt"

## 隐私与安全

### Q: API Key 会被泄露吗？

**A:** 不会。插件采用以下安全措施：

1. API Key 仅存储在本地配置中
2. 通过 stdin 传递数据，不在命令行参数中暴露
3. 不会上传到任何第三方服务器
4. 代码开源，可审查：https://github.com/FlippySun/Easy-Prompt

### Q: 我的代码会被发送到哪里？

**A:** 只发送到你配置的 API 服务商（如 OpenAI）。插件本身不保存或上传任何数据。

## 性能问题

### Q: 增强速度慢？

**A:**

1. **意图识别**: ~2-5 秒（无法优化）
2. **生成 Prompt**: ~5-15 秒（取决于场景复杂度）
3. **总耗时**: 单一场景 10-20s，复合场景 20-40s
4. **优化建议**: 使用"指定场景"跳过意图识别可节省 2-5s

### Q: 输入太长被截断？

**A:** 当前限制 10000 字符。如需处理更长内容：

1. 分段处理
2. 提炼核心需求
3. 使用"场景浏览"查看详细 Prompt 模板自行编写

## 故障排查

### Q: 完全不工作怎么办？

**A:** 按顺序检查：

1. ✅ 插件是否已启用
2. ✅ API Key 是否配置
3. ✅ Base URL 格式是否正确（以 /v1 结尾）
4. ✅ curl 命令是否可用（终端运行 `curl --version`）
5. ✅ 网络连接是否正常
6. ✅ 查看 VSCode/IntelliJ 的开发者工具 Console 是否有错误日志

### Q: 如何查看详细错误日志？

**A:**

- VSCode: Help → Toggle Developer Tools → Console
- IntelliJ: Help → Show Log in Finder/Explorer

### Q: 遇到 Bug 怎么反馈？

**A:**

1. GitHub Issues: https://github.com/FlippySun/Easy-Prompt/issues
2. 提供：操作系统、IDE 版本、错误截图、详细复现步骤

## 其他

### Q: 支持离线使用吗？

**A:** 不支持。需要联网调用 AI API。但可以使用本地部署的 Ollama。

### Q: 支持自定义场景吗？

**A:** 当前版本不支持。后续版本可能会添加。

### Q: 会收费吗？

**A:** 插件本身**完全免费**。但需要：

- OpenAI/Gemini/DeepSeek 等服务商的 API 调用费用（按使用量计费）
- 或使用免费的本地 Ollama

### Q: 插件开源吗？

**A:** 是的，MIT 协议开源：https://github.com/FlippySun/Easy-Prompt

### Q: 支持英文吗？

**A:** 当前版本专注中文。所有 Prompt 模板和 UI 都是中文。后续版本可能添加英文支持。

---

**还有其他问题？** 访问 https://github.com/FlippySun/Easy-Prompt/issues 提问。
