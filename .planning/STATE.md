# Multi-API Mode Implementation State

## Current Phase: ✅ ALL PLATFORMS COMPLETE — Ready for testing

## ✅ COMPLETED

1. core/api.js — 4-mode rewrite, fetchModels(), detectApiMode(), syntax verified
2. core/index.js — re-exports updated
3. package.json — apiMode, apiHost, apiPath settings added
4. extension.js — ALL DONE: getConfig, configureApi handlers, getConfigHtml full rewrite. Syntax verified.
5. browser/shared/api.js — 4-mode rewrite (fetch-based), fetchModels(), detectApiMode()
6. browser/background/service-worker.js — getEffectiveConfig() updated for apiMode+apiHost+apiPath
7. browser/options/options.html — API mode dropdown, Host+Path split, fetch models button added
8. browser/options/options.css — .form-row, .form-select, .models-list styles added
9. browser/options/options.js — Updated: getFormValues with apiMode/apiHost/apiPath, handleSave/handleTest updated, handleFetchModels+renderModelsList added, mode change auto-fills path

## 🔲 REMAINING

10. web/app.js (~2429 lines) — NEEDS:
    - callApiOnce(): add claude/gemini mode support (currently only openai + responses)
    - testApiConfig(): pass apiMode
    - fetchModels(): new function
    - loadConfig/saveConfig/getEffectiveConfig: add apiMode, apiHost, apiPath
    - Settings UI: replace #setting-base-url with mode dropdown + host + path
    - Add fetch models button next to model combobox
    - Settings bind/populate: handle new fields
11. intellij/ApiClient.kt — 4-mode callApiOnce + fetchModels
12. intellij/EasyPromptSettings.kt — apiMode, apiHost, apiPath fields
13. intellij/EasyPromptConfigurable.kt — mode dropdown + host/path + fetch models in Swing UI
14. Final syntax/compile verification

## CRITICAL REMAINING DETAILS

### web/app.js key locations and what to change:

- Lines ~258-284: loadConfig/saveConfig/getEffectiveConfig — add apiMode, apiHost, apiPath fields
- Lines ~800-960: callApiOnce() — currently dual format (Responses + ChatCompletions), needs 4-mode (add claude, gemini)
- Lines ~966-1010: testApiConfig() — pass apiMode
- Lines ~1476-1650: bindSettingsEvents() — add mode change listener, fetch models button
- Lines ~1693-1770: populateSettings() — populate apiMode/apiHost/apiPath fields
- Settings HTML IDs: #setting-base-url (rename to host+path), #setting-api-key, #setting-model
- MODEL_LIST array: hardcoded model list for combo-box
- initModelCombo(): existing model dropdown logic
- Need new: fetchModels() function (same as browser/shared/api.js but inline)

### IntelliJ key files:

- intellij/src/main/kotlin/com/easyprompt/core/ApiClient.kt (571 lines) — callApiOnce with HttpURLConnection, needs 4-mode
- intellij/src/main/kotlin/com/easyprompt/settings/EasyPromptSettings.kt — State class, add apiMode/apiHost/apiPath
- intellij/src/main/kotlin/com/easyprompt/settings/EasyPromptConfigurable.kt — Swing UI with JComboBox for model

### Pattern for all 4 modes (reuse across platforms):

- openai: POST {base}/chat/completions, Bearer auth, {model,messages,temperature,max_tokens}, choices[0].message.content
- openai-responses: POST {base}/responses, Bearer auth, {model,instructions,input,temperature,max_output_tokens}, output[type=message].content[type=output_text].text
- claude: POST {base}/messages, x-api-key+anthropic-version, {model,system,messages:[{role:user}],max_tokens,temperature}, content[0].text
- gemini: POST {base}/models/{model}:generateContent?key={apiKey}, NO auth header, {contents,systemInstruction,generationConfig}, candidates[0].content.parts[0].text

## ✅ COMPLETED

1. core/api.js — 4-mode rewrite, fetchModels(), detectApiMode(), syntax verified
2. core/index.js — re-exports updated
3. package.json — apiMode, apiHost, apiPath settings added
4. extension.js — ALL DONE: getConfig, configureApi handlers, getConfigHtml full rewrite. Syntax verified.
5. browser/shared/api.js — 4-mode rewrite (fetch-based), fetchModels(), detectApiMode()
6. browser/background/service-worker.js — getEffectiveConfig() updated for apiMode+apiHost+apiPath
7. browser/options/options.html — API mode dropdown, Host+Path split, fetch models button added
8. browser/options/options.css — .form-row, .form-select, .models-list styles added

## 🔄 IN PROGRESS

9. browser/options/options.js — Need to update:
   - Load: read apiMode, apiHost, apiPath from config (in addition to apiKey, model)
   - Mode change event: auto-fill apiPath from DEFAULT_API_PATHS
   - Save: save apiMode, apiHost, apiPath (construct baseUrl from host+path)
   - Test: construct baseUrl from host+path, pass apiMode
   - Fetch models button handler
   - Models chip list click-to-select handler

## 🔲 REMAINING

10. web/app.js (~2429 lines) — callApiOnce 4-mode, settings UI, fetchModels
11. intellij/ApiClient.kt — 4-mode callApiOnce + fetchModels
12. intellij/EasyPromptSettings.kt — apiMode field
13. intellij/EasyPromptConfigurable.kt — mode dropdown + host/path + fetch models
14. Final syntax/compile verification

## Constants

- API_MODES: openai, openai-responses, claude, gemini
- DEFAULT_API_PATHS: openai→/v1/chat/completions, responses→/v1/responses, claude→/v1/messages, gemini→/v1beta
- Config external: {apiMode, apiHost, apiPath, apiKey, model}
- Config internal: {baseUrl, apiKey, model, apiMode} where baseUrl=apiHost+apiPath

3. The new version:
   - Changes signature to include apiMode, apiHost, apiPath
   - Adds CSS for .field-row (side-by-side fields), .select (dropdown styles)
   - Replaces Base URL field with Mode dropdown + Host + Path fields
   - Adds "获取模型" button next to model combo
   - Adds Mode-change auto-fill JS
   - Updates all postMessage calls (test/save) to send apiMode/apiHost/apiPath
   - Adds fetchModels button handler + fetchModelsResult handler
   - Keeps ALL existing model combo-box logic intact

### Current Form HTML structure (approximate):

```html
<div class="field">
  <label>API Base URL</label>
  <input
    id="base-url"
    value="${esc(baseUrl)}"
    placeholder="https://api.openai.com/v1"
  />
  <div class="hint">...</div>
</div>
<div class="field">
  <label>API Key</label>
  <div class="key-wrapper">
    <input id="api-key" type="password" value="${esc(apiKey)}" />
    <button id="toggle-key">...</button>
  </div>
</div>
<div class="field">
  <label>模型</label>
  <div class="combo-box" id="model-combo">
    <input id="model-input" value="${esc(model)}" placeholder="gpt-4o" />
    <div class="combo-dropdown" id="combo-dropdown">...grouped options...</div>
  </div>
</div>
```

### New Form HTML structure:

```html
<div class="field">
  <label>API 模式</label>
  <select id="api-mode">
    <option value="">自动检测</option>
    <option value="openai">OpenAI API 兼容</option>
    <option value="openai-responses">OpenAI Responses API 兼容</option>
    <option value="claude">Claude API 兼容</option>
    <option value="gemini">Google Gemini API 兼容</option>
  </select>
  <div class="hint">选择你的 API 服务商使用的协议格式</div>
</div>
<div class="field">
  <label>API Host</label>
  <input
    id="api-host"
    value="${esc(apiHost || derived from baseUrl)}"
    placeholder="https://api.openai.com"
  />
  <div class="hint">API 服务器地址（协议+域名）</div>
</div>
<div class="field">
  <label>API Path</label>
  <input
    id="api-path"
    value="${esc(apiPath || derived from baseUrl)}"
    placeholder="切换模式自动填充"
  />
  <div class="hint">API 路径，切换模式时自动填充默认值</div>
</div>
<div class="field">
  <label>API Key</label>
  ... (keep existing)
</div>
<div class="field">
  <label>模型</label>
  <div style="display:flex;gap:8px;align-items:flex-start">
    <div class="combo-box" id="model-combo" style="flex:1">
      ... (keep existing combo-box)
    </div>
    <button
      id="fetch-models-btn"
      class="btn btn-secondary"
      style="white-space:nowrap"
    >
      获取模型
    </button>
  </div>
</div>
```

## REMAINING PLATFORMS (after extension.js complete):

5. 🔲 browser/shared/api.js (286 lines) — fetch-based callApiOnce, same 4-mode refactoring
6. 🔲 browser/shared/storage.js (146 lines) — add apiMode/apiHost/apiPath to loadConfig/saveConfig
7. 🔲 browser/options/options.html+js — add mode dropdown, split host/path, fetch button
8. 🔲 web/app.js (2429 lines) — inline API+config+settings, same changes
9. 🔲 IntelliJ ApiClient.kt (571 lines) — Kotlin, same 4-mode
10. 🔲 IntelliJ EasyPromptSettings.kt — add apiMode to State
11. 🔲 IntelliJ EasyPromptConfigurable.kt — add mode dropdown to Swing UI
12. 🔲 All platforms syntax/compile check

## API Format Specs (reference for all platforms):

- **openai**: POST {baseUrl}, Auth: Bearer, body: {model,messages:[{role:"system",...},{role:"user",...}],temperature,max_tokens}, resp: choices[0].message.content
- **openai-responses**: POST {baseUrl}, Auth: Bearer, body: {model,instructions,input,temperature,max_output_tokens}, resp: output[].find(type=message).content[].find(type=output_text).text
- **claude**: POST {baseUrl}, Auth: x-api-key+anthropic-version:2023-06-01, body: {model,system,messages:[{role:"user",content}],max_tokens,temperature}, resp: content[0].text
- **gemini**: POST {baseUrl}/models/{model}:generateContent?key={apiKey}, NO auth, body: {contents:[{role:"user",parts:[{text}]}],systemInstruction:{parts:[{text}]},generationConfig:{temperature,maxOutputTokens}}, resp: candidates[0].content.parts[0].text

## Config Shape:

- External (UI/storage): {apiMode, apiHost, apiPath, apiKey, model}
- Internal (API layer): {baseUrl, apiKey, model, apiMode} where baseUrl=apiHost+apiPath
- DEFAULT_API_PATHS: {"openai":"/v1/chat/completions","openai-responses":"/v1/responses","claude":"/v1/messages","gemini":"/v1beta"}
- Backward compat: if apiMode missing, detectApiMode(baseUrl) auto-detects from URL patterns
- detectApiMode: /responses$ → openai-responses, anthropic|/messages$ → claude, generativelanguage.googleapis.com → gemini, else → openai

## fetchModels endpoints (reference):

- openai/responses: GET {host}{versionPrefix}/models, Bearer auth, resp: data[].id
- claude: GET {host}{versionPrefix}/models, x-api-key + anthropic-version, resp: data[].id
- gemini: GET {host}{versionPrefix}/models?key={apiKey}, no auth, resp: models[].name (strip "models/" prefix)
- versionPrefix derived from apiPath's first segment (e.g. /v1, /v1beta)

## IMMEDIATE NEXT ACTIONS (in exact order):

### A. Fix extension.js save handler CLEAR section (~line 1131):

Find: `await cfgNow.update("apiBaseUrl", undefined, target);\n                await cfgNow.update("apiKey", undefined, target);\n                await cfgNow.update("model", undefined, target);`
Add before these: apiMode, apiHost, apiPath clears

### B. Fix extension.js save handler VALIDATION (~line 1155):

Find: `!config.baseUrl || !config.apiKey || !config.model`
Replace with: `!apiHost || !apiKey || !model`

### C. Fix extension.js save handler WRITE section (~line 1187):

Find: `await cfgNow.update("apiBaseUrl", config.baseUrl, target);\n              await cfgNow.update("apiKey", config.apiKey, target);\n              await cfgNow.update("model", config.model, target);`
Add BEFORE these: apiMode, apiHost, apiPath writes

### D. Fix extension.js reset handler (~line 1208):

Find reset handler's `await cfgNow.update("apiBaseUrl"...` block, add apiMode/apiHost/apiPath clears

### E. Add fetchModels handler before the closing `}` of the switch block (~line 1227)

### F. REWRITE getConfigHtml() function (starts ~line 1240, ~760 lines)

Signature changes from: getConfigHtml(baseUrl, apiKey, model)
To: getConfigHtml(apiMode, apiHost, apiPath, baseUrl, apiKey, model)

### G. After extension.js done, update remaining platforms:

- browser/shared/api.js (fetch-based, same 4-mode logic)
- browser/shared/storage.js (add apiMode/apiHost/apiPath)
- browser/options/options.html + options.js (new UI fields)
- web/app.js (API + config + settings all inline)
- IntelliJ ApiClient.kt (Kotlin, same 4-mode logic)
- IntelliJ EasyPromptSettings.kt (add apiMode to State)
- IntelliJ EasyPromptConfigurable.kt (add mode dropdown)

## EXACT CODE NEEDED for extension.js save/reset/fetchModels handlers:

### Save handler CLEAR section (line ~1131-1152):

Current code clears apiBaseUrl, apiKey, model. Must ALSO clear apiMode, apiHost, apiPath.
Old code:

```
await cfgNow.update("apiBaseUrl", undefined, target);
await cfgNow.update("apiKey", undefined, target);
await cfgNow.update("model", undefined, target);
```

New code (add 3 more lines):

```
await cfgNow.update("apiMode", undefined, target);
await cfgNow.update("apiHost", undefined, target);
await cfgNow.update("apiPath", undefined, target);
await cfgNow.update("apiBaseUrl", undefined, target);
await cfgNow.update("apiKey", undefined, target);
await cfgNow.update("model", undefined, target);
```

### Save handler VALIDATION (line ~1155):

Change `!config.baseUrl || !config.apiKey || !config.model` to `!apiHost || !apiKey || !model`

### Save handler WRITE section (line ~1187-1190):

Old code:

```
await cfgNow.update("apiBaseUrl", config.baseUrl, target);
await cfgNow.update("apiKey", config.apiKey, target);
await cfgNow.update("model", config.model, target);
```

New code:

```
await cfgNow.update("apiMode", apiMode || undefined, target);
await cfgNow.update("apiHost", apiHost || undefined, target);
await cfgNow.update("apiPath", apiPath || undefined, target);
await cfgNow.update("apiBaseUrl", config.baseUrl, target);
await cfgNow.update("apiKey", config.apiKey, target);
await cfgNow.update("model", config.model, target);
```

### Reset handler (line ~1208-1215):

Old code clears apiBaseUrl, apiKey, model. New code adds apiMode, apiHost, apiPath.

### New fetchModels handler (add before closing `}` of switch):

```
case "fetchModels": {
  const apiMode = (msg.apiMode || "").trim();
  const apiHost = (msg.apiHost || "").trim();
  const apiPath = (msg.apiPath || "").trim();
  const apiKey = (msg.apiKey || "").trim();
  let baseUrl = "";
  if (apiHost) {
    const host = apiHost.replace(/\/+$/, "");
    const path = apiPath || (apiMode ? DEFAULT_API_PATHS[apiMode] || "/v1/chat/completions" : "/v1/chat/completions");
    baseUrl = host + path;
  }
  const config = { baseUrl, apiKey, model: "dummy", apiMode: apiMode || detectApiMode(baseUrl) };
  if (!apiHost || !apiKey) {
    panel.webview.postMessage({ type: "fetchModelsResult", ok: false, models: [], message: "请先填写 API Host 和 API Key" });
    return;
  }
  panel.webview.postMessage({ type: "fetchingModels", message: "正在获取模型列表..." });
  try {
    const result = await fetchModels(config, apiHost.replace(/\/+$/, ""));
    if (!panel.visible) return;
    panel.webview.postMessage({ type: "fetchModelsResult", ok: result.ok, models: result.models, message: result.message });
  } catch (e) {
    if (!panel.visible) return;
    panel.webview.postMessage({ type: "fetchModelsResult", ok: false, models: [], message: "获取失败: " + e.message });
  }
  break;
}
```

## CRITICAL: getConfigHtml() function starts at line ~1230

This is ~760 lines of inline HTML/CSS/JS. Need MAJOR rewrite:

- Add API mode dropdown at top (4 options + auto)
- Replace single baseUrl field with apiHost + apiPath
- Add "fetch models" button next to model combo-box
- Mode change auto-fills apiPath
- Keep existing model combo-box with grouped options

## Config Field Details

- apiMode: openai|openai-responses|claude|gemini (or empty for auto-detect)
- apiHost: protocol+domain like https://api.openai.com
- apiPath: path like /v1/chat/completions
- DEFAULT_API_PATHS: {openai:"/v1/chat/completions", "openai-responses":"/v1/responses", claude:"/v1/messages", gemini:"/v1beta"}

## API Format Specs (for all platforms)

- openai: POST {baseUrl}, Auth: Bearer, body: {model,messages,temperature,max_tokens}, resp: choices[0].message.content
- openai-responses: POST {baseUrl}, Auth: Bearer, body: {model,instructions,input,temperature,max_output_tokens}, resp: output[].content[].text
- claude: POST {baseUrl}, Auth: x-api-key+anthropic-version:2023-06-01, body: {model,system,messages:[{role:"user"}],max_tokens,temperature}, resp: content[0].text
- gemini: POST {baseUrl}/models/{model}:generateContent?key={apiKey}, NO auth header, body: {contents,systemInstruction,generationConfig}, resp: candidates[0].content.parts[0].text

## fetchModels (in core/api.js) pattern for other platforms:

- Derive versionPrefix from baseUrl pathname first segment (e.g. /v1, /v1beta)
- openai/responses: GET {host}{versionPrefix}/models, Bearer auth
- claude: GET {host}{versionPrefix}/models, x-api-key auth
- gemini: GET {host}{versionPrefix}/models?key={apiKey}, no auth
- Parse: openai/responses/claude → data[].id; gemini → models[].name (strip "models/" prefix)

## What We're Building

Adding 4 API mode support across all 5 platforms:

- **openai**: POST {host}{path}, Authorization: Bearer, body: {model, messages, temperature, max_tokens}, response: choices[0].message.content
- **openai-responses**: POST {host}{path}, Authorization: Bearer, body: {model, instructions, input, temperature, max_output_tokens}, response: output[].content[].text
- **claude**: POST {host}{path}, headers: x-api-key + anthropic-version: 2023-06-01, body: {model, system, messages:[{role:"user"}], max_tokens, temperature}, response: content[0].text
- **gemini**: POST {host}{path}/models/{model}:generateContent?key={apiKey}, NO auth header, body: {contents:[{role:"user",parts:[{text}]}], systemInstruction:{parts:[{text}]}, generationConfig:{temperature,maxOutputTokens}}, response: candidates[0].content.parts[0].text

## Config Schema Change

Old: `{baseUrl, apiKey, model}`
New externally: `{apiMode, apiHost, apiPath, apiKey, model}`
New internally: `{baseUrl, apiKey, model, apiMode}` where baseUrl = apiHost + apiPath

## Default apiPath per mode

- openai → /v1/chat/completions
- openai-responses → /v1/responses
- claude → /v1/messages
- gemini → /v1beta

## fetchModels endpoints

- openai/openai-responses: GET {host}/v1/models (derive /v1 from apiPath by stripping last segment), Authorization: Bearer → data[].id
- claude: GET {host}/v1/models (derive /v1 from apiPath by stripping last segment), x-api-key + anthropic-version → data[].id
- gemini: GET {host}{apiPath}/models?key={apiKey} → models[].name (strip "models/" prefix)

## Key Design Decisions

1. Backward compat: if apiMode missing, auto-detect from baseUrl suffix (/responses → openai-responses, else → openai)
2. Gemini URL: {host}{apiPath}/models/{model}:generateContent?key={apiKey}
3. Claude system prompt: extracted to top-level `system` field
4. Auth headers: per-mode helper function
5. Model fetch URL: derived from apiPath's version prefix

## core/api.js Implementation Details

The callApiOnce function currently (line ~218) does:

- Takes config = {baseUrl, apiKey, model}
- Detects format via: normalizedBase.endsWith("/responses")
- Always uses `Authorization: Bearer` header
- Two body formats: ResponsesAPI vs ChatCompletions
- Two response parsers: output[].content[].text vs choices[0].message.content
- Uses curl subprocess via spawn

Changes needed:

1. Add `apiMode` to config destructuring with backward-compat auto-detect
2. Add `detectApiMode(baseUrl)` helper for backward compat
3. Replace URL construction with per-mode logic
4. Replace body construction with per-mode logic (4 formats)
5. Replace header construction with per-mode logic
6. Replace response parsing with per-mode logic
7. Update testApiConfig to pass apiMode through
8. Add new `fetchModels(config)` function
9. Update module.exports to include fetchModels

## callApiOnce curl args structure (current):

```
args = ["-s", "-S", "--max-time", timeout, "-X", "POST", url,
        "-H", "Content-Type: application/json",
        "-H", "Authorization: Bearer ${apiKey}",
        "-d", "@-"]
```

For claude: change auth header to "-H", "x-api-key: ${apiKey}", "-H", "anthropic-version: 2023-06-01"
For gemini: remove auth header entirely (key in URL query param)

## Files to Modify (ordered)

1. 🔄 core/api.js (485 lines) — IN PROGRESS
2. 🔲 package.json (228 lines) — settings schema lines 117-195, add apiMode enum + apiHost + apiPath
3. 🔲 extension.js (1961 lines) — getConfig() L303 returns {baseUrl,apiKey,model}, configureApi() L988 webview, getConfigHtml() L1190 ~760 lines inline HTML
4. 🔲 browser/shared/api.js (286 lines) — fetch-based, same callApiOnce/testApiConfig
5. 🔲 browser/shared/storage.js (146 lines) — loadConfig/saveConfig uses chrome.storage.local, key="ep-config"
6. 🔲 browser/options/options.html (209 lines) — has input-base-url, input-api-key, input-model fields
7. 🔲 browser/options/options.js (200 lines) — handleSave saves {baseUrl, apiKey, model}, handleTest
8. 🔲 web/app.js (2429 lines) — settings panel at L1476 bindSettingsEvents, L1693 populateSettings, L1747 handleSaveSettings stores {baseUrl,apiKey,model}; API at L800-993 callApiOnce same logic; config L258-284 loadConfig/saveConfig/getEffectiveConfig
9. 🔲 IntelliJ ApiClient.kt (571 lines) — getEffectiveConfig() returns Triple(baseUrl,apiKey,model), callApiOnce same dual format, testApiConfig(baseUrl,apiKey,model) at end
10. 🔲 IntelliJ EasyPromptSettings.kt — State data class has apiBaseUrl, apiKey (PasswordSafe), model
11. 🔲 IntelliJ EasyPromptConfigurable.kt — SwingUI: apiBaseUrlField, apiKeyField, modelField (JComboBox), doTest/doSave/doReset
12. 🔲 IntelliJ BuiltinDefaults.kt — has vault with baseUrl/apiKey/model charCode arrays, no apiMode needed

## Current Provider (vpsairobot) — inject-provider.js targets

- baseUrl: https://vpsairobot.com/v1/responses
- model: gpt-5.3-codex
- apiKey: sk-68fd9b89f82ec2d442bc58568cac555944d78a5db4eb28e22be597d0783e398b
- apiMode: openai-responses (to be auto-detected from baseUrl suffix)

## Risk Resolutions (ALL approved by user)

1. Gemini URL: dynamic construction with model in path
2. Claude system: separate top-level field
3. Auth: per-mode headers
4. Model fetch: per-mode URL/parsing
5. testApiConfig: shares format logic with callApiOnce

## web/app.js Settings HTML IDs

- #setting-base-url, #setting-api-key, #setting-model (current)
- Need to add: #setting-api-mode, #setting-api-host, #setting-api-path
- Settings panel opened by: openPanel("settings"), closed by closePanel("settings")
- Has MODEL_LIST (hardcoded array with groups) and initModelCombo() combobox
- bindSettingsEvents() at L1476, populateSettings() at L1693
- handleSaveSettings() at L1747: saves {baseUrl, apiKey, model} to localStorage

## browser/options Settings

- Fields: #input-base-url, #input-api-key, #input-model
- All fields are simple text/password inputs
- handleSave: saves via Storage.saveConfig({baseUrl, apiKey, model})
- handleTest: calls Api.testApiConfig(config)
- Uses Defaults.getBuiltinDefaults() for fallback

## IntelliJ Settings Details

- EasyPromptSettings.State: apiBaseUrl, apiKey (deprecated, migrated to PasswordSafe), model, language, sceneStats, historyRecords
- EasyPromptConfigurable: creates Swing panel with addField() helper
- builtinModels array (no custom key) vs fullModels array (has custom key)
- PlaceholderTextField and PlaceholderPasswordField inner classes
- doTest() → runs ApiClient.testApiConfig(baseUrl, apiKey, model) on pooled thread
- doSave() → tests first, on success saves to settings + PasswordSafe

## extension.js getConfig() (L303)

Returns {baseUrl, apiKey, model} — reads from vscode settings, falls back to builtin defaults
Must change to return {baseUrl, apiKey, model, apiMode}

## extension.js getConfigHtml() (L1190, ~760 lines)

Inline HTML/CSS/JS for the settings webview panel
Has sophisticated model combo-box with grouped options, keyboard nav, filtering
Must add: API mode dropdown at top, split baseUrl into apiHost + apiPath fields, "fetch models" button
