# Easy Prompt - API 提供商配置示例

本文档提供各主流 API 提供商的详细配置示例。

## 📋 配置项说明

所有配置项都在插件设置中：

- **VSCode**: 设置（Cmd+,）→ 搜索 "Easy Prompt"
- **IntelliJ**: Settings → Tools → Easy Prompt

### 必填项

- `API Base URL`: API 服务地址（必须以 `/v1` 结尾）
- `API Key`: 访问密钥
- `Model`: 模型名称

---

## 🤖 OpenAI

### 官方 API

```
API Base URL: https://api.openai.com/v1
API Key: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Model: gpt-4o
```

**推荐模型:**

- `gpt-4o` - 最新旗舰模型（推荐）
- `gpt-4-turbo` - 性价比高
- `gpt-3.5-turbo` - 便宜快速

**获取 API Key:** https://platform.openai.com/api-keys

**定价:** 参考 https://openai.com/pricing

---

## ☁️ Azure OpenAI

### 配置格式

```
API Base URL: https://YOUR-RESOURCE-NAME.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT-NAME/v1
API Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Model: gpt-4o (或你的部署名称)
```

**示例:**

```
API Base URL: https://my-company.openai.azure.com/openai/deployments/gpt4-deployment/v1
API Key: abc123def456ghi789jkl012mno345pq
Model: gpt-4o
```

**注意:**

- Base URL 中的 `YOUR-RESOURCE-NAME` 和 `YOUR-DEPLOYMENT-NAME` 需要替换为你的实际值
- 从 Azure Portal → OpenAI 服务 → Keys and Endpoint 获取

---

## 🌟 Google Gemini

### 配置格式

```
API Base URL: https://generativelanguage.googleapis.com/v1
API Key: AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Model: gemini-3-pro-preview
```

**推荐模型:**

- `gemini-3-pro-preview` - 最新版本
- `gemini-pro` - 稳定版

**获取 API Key:** https://makersuite.google.com/app/apikey

**注意:** Gemini API 可能需要特殊配置，如果不工作请使用 OpenAI 格式的中转站。

---

## 🧠 DeepSeek (国产大模型)

### 官方 API

```
API Base URL: https://api.deepseek.com/v1
API Key: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Model: deepseek-chat
```

**推荐模型:**

- `deepseek-chat` - 通用对话模型

**获取 API Key:** https://platform.deepseek.com/api-keys

**优势:** 价格便宜，中文支持好，国内访问快

---

## 🦙 Ollama (本地部署)

### 本地安装

```
API Base URL: http://localhost:11434/v1
API Key: (留空或填 "ollama")
Model: qwen
```

**推荐模型:**

- `qwen` - 阿里通义千问（中文优秀）
- `llama3` - Meta Llama 3
- `mistral` - Mistral AI

**安装步骤:**

1. 下载安装 Ollama: https://ollama.com/
2. 运行模型: `ollama run qwen`
3. 配置插件使用 `http://localhost:11434/v1`

**优势:**

- 完全免费
- 数据隐私（不上传云端）
- 支持离线使用

**劣势:**

- 需要较好的硬件（推荐 16GB+ 内存）
- 性能可能不如云端大模型

---

## 🔄 第三方 API 中转站

### 为什么使用中转站？

- OpenAI API 在中国大陆无法直接访问
- 中转站提供国内可访问的代理服务

### 配置格式

```
API Base URL: https://your-proxy-domain.com/v1
API Key: 从中转站获取的 Key
Model: gpt-4o
```

### 常见中转站（示例）

⚠️ **风险提示:** 使用第三方中转站有 API Key 泄露风险，请选择信誉良好的服务商。

1. **自建中转（推荐）**
   - 使用 Cloudflare Workers 或 Vercel 自建代理
   - GitHub 搜索 "openai proxy" 查找开源方案

2. **商业中转站**
   - 从靠谱的国内服务商购买
   - 注意查看用户评价和安全性

### 安全建议

- 优先使用官方 API 或 Azure
- 如必须使用中转站，定期更换 API Key
- 不要在中转站配置中暴露敏感代码

---

## ⚙️ 高级配置

### 代理设置

如果网络需要代理访问 OpenAI，在终端设置环境变量：

**macOS/Linux:**

```bash
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
```

**Windows:**

```cmd
set http_proxy=http://127.0.0.1:7890
set https_proxy=http://127.0.0.1:7890
```

然后启动 VSCode/IntelliJ。

### 调试模式

如遇到问题，查看详细日志：

- **VSCode**: Help → Toggle Developer Tools → Console
- **IntelliJ**: Help → Show Log

---

## 💡 推荐配置方案

### 个人开发者（预算有限）

1. **首选**: DeepSeek（便宜，中文好）
2. **次选**: Ollama 本地部署（免费）
3. **备用**: OpenAI gpt-3.5-turbo（快速便宜）

### 团队/企业

1. **首选**: Azure OpenAI（企业级支持）
2. **次选**: OpenAI 官方 API
3. **备用**: 私有化部署 Ollama

### 学生/新手

1. **首选**: Ollama 本地部署（免费学习）
2. **次选**: 申请 OpenAI 免费额度
3. **备用**: DeepSeek（新用户有赠金）

---

## ❓ 测试配置是否正常

配置完成后，测试方法：

1. 选中一段文本："帮我写个登录页面"
2. 按 `Ctrl+Alt+P`
3. 查看是否能正常生成 Prompt

如果失败，查看错误提示并参考 [FAQ.md](./FAQ.md) 排查。

---

**配置还有问题？** 查看 [FAQ.md](./FAQ.md) 或提交 Issue。
