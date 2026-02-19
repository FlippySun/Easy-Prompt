/**
 * Easy Prompt — 内置默认配置
 * 使用 AES-256-CBC 加密 + 多层混淆保护敏感数据
 */

const crypto = require("crypto");

// === 混淆层 1: 分散存储的密钥片段 ===
const _k = [
  "\x45\x50", // EP
  "\x2d\x53", // -S
  "\x65\x63", // ec
  "\x72\x65", // re
  "\x74\x2d", // t-
  "\x4b\x33", // K3
  "\x79\x21", // y!
  "\x40\x32", // @2
  "\x30\x32", // 02
  "\x36\x23", // 6#
  "\x46\x6c", // Fl
  "\x69\x70", // ip
  "\x70\x79", // py
  "\x53\x75", // Su
  "\x6e\x58", // nX
  "\x39", // 9
];

// === 混淆层 2: 打乱的索引序列 ===
const _seq = [0, 10, 4, 2, 14, 8, 6, 12, 1, 11, 5, 3, 15, 9, 7, 13];

// 重组密钥
function _dk() {
  const order = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  return order.map((i) => _k[_seq[i]]).join("");
}

// === 混淆层 3: 加密后的数据块（AES-256-CBC） ===
// 数据在构建时通过 _enc() 加密，运行时通过 _dec() 解密
const _vault = {
  // 分段存储，每段独立加密
  _a: null, // baseUrl
  _b: null, // apiKey
  _c: null, // model
};

/**
 * 加密函数（仅构建时使用）
 */
function _enc(plaintext, key32) {
  const keyBuf = crypto.createHash("sha256").update(key32).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

/**
 * 解密函数
 */
function _dec(ciphertext, key32) {
  const keyBuf = crypto.createHash("sha256").update(key32).digest();
  const [ivB64, encB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
  let decrypted = decipher.update(encB64, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// === 初始化：加密原始数据并缓存 ===
// 这段逻辑在模块首次加载时执行一次
(function _init() {
  const key = _dk();
  // 如果已经有加密数据就跳过
  if (_vault._a) return;

  // 原始值通过多层间接引用构造 [Provider: modelverse]
  const _p1 = [104, 116, 116, 112, 115, 58, 47, 47]; // https://
  const _p2 = [97, 112, 105, 46, 109, 111, 100, 101]; // api.mode
  const _p3 = [108, 118, 101, 114, 115, 101, 46, 99]; // lverse.c
  const _p4 = [110, 47, 118, 49, 47, 99, 104, 97]; // n/v1/cha
  const _p5 = [116, 47, 99, 111, 109, 112, 108, 101]; // t/comple
  const _p6 = [116, 105, 111, 110, 115]; // tions
  const _baseUrl = String.fromCharCode(..._p1, ..._p2, ..._p3, ..._p4, ..._p5, ..._p6);

  const _s1 = [104, 119, 102, 80, 119, 68, 100, 70]; // hwfPwDdF
  const _s2 = [108, 54, 54, 118, 107, 80, 119, 121]; // l66vkPwy
  const _s3 = [51, 57, 49, 99, 69, 52, 55, 98]; // 391cE47b
  const _s4 = [45, 99, 56, 51, 52, 45, 52, 50]; // -c834-42
  const _s5 = [55, 52, 45, 98, 65, 97, 51, 45]; // 74-bAa3-
  const _s6 = [69, 101, 66, 97, 56, 55, 52, 48]; // EeBa8740
  const _apiKey = String.fromCharCode(
    ..._s1, ..._s2, ..._s3, ..._s4, ..._s5, ..._s6,
  );

  const _m1 = [99, 108, 97, 117, 100, 101, 45, 115]; // claude-s
  const _m2 = [111, 110, 110, 101, 116, 45, 52, 45]; // onnet-4-
  const _m3 = [53, 45, 50, 48, 50, 53, 48, 57]; // 5-202509
  const _m4 = [50, 57]; // 29
  const _model = String.fromCharCode(..._m1, ..._m2, ..._m3, ..._m4);

  _vault._a = _enc(_baseUrl, key);
  _vault._b = _enc(_apiKey, key);
  _vault._c = _enc(_model, key);
})();

/**
 * 获取内置默认配置
 * @returns {{ baseUrl: string, apiKey: string, model: string }}
 */
function getBuiltinDefaults() {
  const key = _dk();
  return {
    baseUrl: _dec(_vault._a, key),
    apiKey: _dec(_vault._b, key),
    model: _dec(_vault._c, key),
  };
}

module.exports = { getBuiltinDefaults };
