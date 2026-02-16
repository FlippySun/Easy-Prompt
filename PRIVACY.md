# Privacy Policy — Easy Prompt AI

**Last Updated: February 17, 2026**

## Overview

Easy Prompt AI is an open-source AI-powered prompt enhancement tool available as a browser extension (Chrome, Firefox, Safari), VSCode extension, IntelliJ plugin, and web application. This privacy policy explains how the browser extension handles user data.

**Source Code:** [https://github.com/FlippySun/Easy-Prompt](https://github.com/FlippySun/Easy-Prompt)

## Data Collection

### What We Collect

Easy Prompt AI collects and processes the following data **only when explicitly initiated by the user**:

- **Selected Text Content**: When you select text on a webpage and click the floating enhance button, use the right-click context menu, or trigger the keyboard shortcut, the selected text is sent to an AI API endpoint for prompt enhancement.
- **User Input Text**: Text you manually type into the extension's popup input field.

### What We Store Locally

The following data is stored **locally on your device** using `chrome.storage.local` and `chrome.storage.session`:

- **API Configuration**: Custom API endpoint URL, API key, and model name (if you choose to configure your own AI service).
- **Enhancement History**: Records of your past prompt enhancements (input and output text), stored for your convenience to review and reuse.
- **UI State**: Popup panel state (input text, output text, selected scene) for session persistence.
- **Theme Preference**: Your dark/light mode selection.

### What We Do NOT Collect

- No personal identity information (name, email, address, etc.)
- No location or GPS data
- No browsing history or web activity tracking
- No health, financial, or authentication information
- No analytics, telemetry, or usage tracking data
- No cookies or cross-site tracking

## Data Transmission

- **AI API Calls**: When you initiate a prompt enhancement, your input text is sent to an AI API endpoint (the built-in default service, or a custom endpoint you configure such as OpenAI, Gemini, DeepSeek, etc.) for processing. The AI service returns the enhanced prompt text. No other data is included in these API calls.
- **No Other Transmission**: No data is sent to any other server, analytics service, advertising network, or third party. There is no background data collection or transmission.

## Data Sharing

Easy Prompt AI does **not** sell, share, or transfer user data to any third party for any purpose, including:

- No selling of data to third parties
- No sharing with advertisers or analytics providers
- No use of data for purposes unrelated to the extension's core functionality
- No transfer of data to determine creditworthiness or for lending purposes

## Data Security

- All data is stored locally on your device using the browser's built-in storage APIs.
- Built-in API credentials are encrypted with AES-256-CBC.
- The extension's Content Security Policy (`script-src 'self'; object-src 'self'`) prevents any remote code execution.
- No remote code is loaded or executed. All JavaScript is bundled within the extension package.

## Permissions Usage

| Permission | Purpose |
|---|---|
| `storage` | Store API config, enhancement history, UI state, and theme preference locally |
| `contextMenus` | Add a right-click "Easy Prompt 增强" option for selected text |
| `activeTab` | Read selected text from the active tab when keyboard shortcut is triggered |
| `scripting` | Execute `window.getSelection()` on the active tab to retrieve selected text via keyboard shortcut |
| Content Scripts (`<all_urls>`) | Display a floating enhance button near selected text on any webpage |

## User Control

- You can delete all enhancement history at any time from within the extension.
- You can configure or remove your custom API settings at any time.
- Uninstalling the extension removes all locally stored data.

## Children's Privacy

Easy Prompt AI does not knowingly collect any data from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted to this page with an updated "Last Updated" date. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

If you have any questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/FlippySun/Easy-Prompt/issues).

## Open Source

Easy Prompt AI is open-source software licensed under the MIT License. You can review the complete source code at [https://github.com/FlippySun/Easy-Prompt](https://github.com/FlippySun/Easy-Prompt).
