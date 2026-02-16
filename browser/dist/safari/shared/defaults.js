/**
 * Easy Prompt Browser Extension — 内置默认配置
 * AES-256-CBC 加密 + 多层混淆（与 core/defaults.js 和 web/app.js 保持一致）
 * 使用 Web Crypto API（浏览器扩展原生支持）
 */

// === 混淆层 1: 分散存储的密钥片段 ===
const _k = [
  "\x45\x50",
  "\x2d\x53",
  "\x65\x63",
  "\x72\x65",
  "\x74\x2d",
  "\x4b\x33",
  "\x79\x21",
  "\x40\x32",
  "\x30\x32",
  "\x36\x23",
  "\x46\x6c",
  "\x69\x70",
  "\x70\x79",
  "\x53\x75",
  "\x6e\x58",
  "\x39",
];

// === 混淆层 2: 打乱的索引序列 ===
const _seq = [0, 10, 4, 2, 14, 8, 6, 12, 1, 11, 5, 3, 15, 9, 7, 13];
const _order = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];

function _dk() {
  return _order.map((i) => _k[_seq[i]]).join("");
}

// === 混淆层 3: 预加密的数据 (AES-256-CBC, base64 iv:ciphertext) ===
const _vault = {
  _a: "nsyr2IS/y/d+/SjcQWWnMw==:QH+2F+3pvndj0tDx173pncFD8sjIXx7UVwJeFtOyTL4=",
  _b: "dsTXcwfRJa0zhYDUl6QHFA==:hxcqQTO75KRuSwC/9FoijhfiK/aA1fmjdhdQUNaJJwMmE9RJew0tbaNpLxef62nIoBZ/OLAfPJfK6V09oSAF7Q==",
  _c: "hStx3/BP4Pnf59dLvPg8VA==:kHqUSzkgftdvUmtb3K0eM6KC26J9s6gy7QvhcZi0x5c=",
};

let _builtinCache = null;
let _importedKey = null;

async function _getKey() {
  if (_importedKey) return _importedKey;
  const rawKey = new TextEncoder().encode(_dk());
  const hash = await crypto.subtle.digest("SHA-256", rawKey);
  _importedKey = await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );
  return _importedKey;
}

async function _decAES(ct) {
  try {
    const [ivB64, encB64] = ct.split(":");
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const enc = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0));
    const key = await _getKey();
    const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, enc);
    return new TextDecoder().decode(dec);
  } catch (err) {
    console.error("[Easy Prompt] Decrypt failed:", err);
    return "";
  }
}

async function getBuiltinDefaults() {
  if (_builtinCache) return _builtinCache;
  try {
    const [baseUrl, apiKey, model] = await Promise.all([
      _decAES(_vault._a),
      _decAES(_vault._b),
      _decAES(_vault._c),
    ]);
    if (!baseUrl || !apiKey || !model) return null;
    _builtinCache = { baseUrl, apiKey, model };
    return _builtinCache;
  } catch (err) {
    console.error("[Easy Prompt] Failed to load builtin defaults:", err);
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
const Defaults = { getBuiltinDefaults };
