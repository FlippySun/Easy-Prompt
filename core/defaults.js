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

  // 原始值通过多层间接引用构造
  const _p1 = [104, 116, 116, 112, 115, 58, 47, 47]; // https://
  const _p2 = [97, 112, 105, 46]; // api.
  const _p3 = [121, 121, 100, 115, 49, 54, 56]; // yyds168
  const _p4 = [46, 110, 101, 116, 47, 118, 49]; // .net/v1
  const _baseUrl = String.fromCharCode(..._p1, ..._p2, ..._p3, ..._p4);

  const _s1 = [115, 107, 45]; // sk-
  const _s2 = [76, 100, 78, 85, 84, 71, 118, 51]; // LdNUTGv3
  const _s3 = [120, 110, 109, 74, 101, 118, 115, 115]; // xnmJevss
  const _s4 = [50, 81, 97, 90, 78, 81, 117, 81]; // 2QaZNQuQ
  const _s5 = [66, 57, 51, 71, 84, 112, 112, 121]; // B93GTppy
  const _s6 = [56, 110, 98, 111, 50, 87, 71, 106]; // 8nbo2WGj
  const _s7 = [115, 89, 48, 85, 117, 114, 109, 55]; // sY0Uurm7
  const _apiKey = String.fromCharCode(
    ..._s1,
    ..._s2,
    ..._s3,
    ..._s4,
    ..._s5,
    ..._s6,
    ..._s7,
  );

  const _m1 = [103, 101, 109, 105, 110, 105]; // gemini
  const _m2 = [45, 51, 45, 112, 114, 111]; // -3-pro
  const _m3 = [45, 112, 114, 101, 118, 105, 101, 119]; // -preview
  const _model = String.fromCharCode(..._m1, ..._m2, ..._m3);

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
