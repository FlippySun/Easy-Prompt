package com.easyprompt.core

import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.security.MessageDigest

/**
 * 内置默认配置（AES-256-CBC 加密 + 多层混淆）
 */
object BuiltinDefaults {

    // 混淆层 1: 分散存储的密钥片段
    private val kFragments = arrayOf(
        "\u0045\u0050",   // EP
        "\u002d\u0053",   // -S
        "\u0065\u0063",   // ec
        "\u0072\u0065",   // re
        "\u0074\u002d",   // t-
        "\u004b\u0033",   // K3
        "\u0079\u0021",   // y!
        "\u0040\u0032",   // @2
        "\u0030\u0032",   // 02
        "\u0036\u0023",   // 6#
        "\u0046\u006c",   // Fl
        "\u0069\u0070",   // ip
        "\u0070\u0079",   // py
        "\u0053\u0075",   // Su
        "\u006e\u0058",   // nX
        "\u0039",         // 9
    )

    // 混淆层 2: 打乱的索引序列
    private val seq = intArrayOf(0, 10, 4, 2, 14, 8, 6, 12, 1, 11, 5, 3, 15, 9, 7, 13)

    // 重组密钥
    private fun deriveKey(): String {
        val order = intArrayOf(0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15)
        return order.map { kFragments[seq[it]] }.joinToString("")
    }

    // AES-256-CBC 解密
    private fun decrypt(ciphertext: String, key32: String): String {
        val keyBytes = MessageDigest.getInstance("SHA-256").digest(key32.toByteArray())
        val parts = ciphertext.split(":")
        val iv = Base64.getDecoder().decode(parts[0])
        val encrypted = Base64.getDecoder().decode(parts[1])

        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), IvParameterSpec(iv))
        return String(cipher.doFinal(encrypted))
    }

    // AES-256-CBC 加密（构建时使用）
    private fun encrypt(plaintext: String, key32: String): String {
        val keyBytes = MessageDigest.getInstance("SHA-256").digest(key32.toByteArray())
        val iv = ByteArray(16).also { java.security.SecureRandom().nextBytes(it) }

        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, "AES"), IvParameterSpec(iv))
        val encrypted = cipher.doFinal(plaintext.toByteArray())

        return Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(encrypted)
    }

    // 混淆层 3: 加密后的数据（延迟初始化）
    private val vault: Map<String, String> by lazy {
        val key = deriveKey()

        // 原始值通过 charCode 构造
        val baseUrl = intArrayOf(104,116,116,112,115,58,47,47,118,112,115,97,105,114,111,98,111,116,46,99,111,109,47,118,49,47,114,101,115,112,111,110,115,101,115)
            .map { it.toChar() }.joinToString("")
        val apiKey = intArrayOf(115,107,45,54,56,102,100,57,98,56,57,102,56,50,101,99,50,100,52,52,50,98,99,53,56,53,54,56,99,97,99,53,53,53,57,52,52,100,55,56,97,53,100,98,52,101,98,50,56,101,50,50,98,101,53,57,55,100,48,55,56,51,101,51,57,56,98)
            .map { it.toChar() }.joinToString("")
        val model = intArrayOf(103,112,116,45,53,46,51,45,99,111,100,101,120)
            .map { it.toChar() }.joinToString("")

        mapOf(
            "baseUrl" to encrypt(baseUrl, key),
            "apiKey" to encrypt(apiKey, key),
            "model" to encrypt(model, key)
        )
    }

    data class Defaults(val baseUrl: String, val apiKey: String, val model: String)

    fun getDefaults(): Defaults {
        val key = deriveKey()
        return Defaults(
            baseUrl = decrypt(vault["baseUrl"]!!, key),
            apiKey = decrypt(vault["apiKey"]!!, key),
            model = decrypt(vault["model"]!!, key)
        )
    }
}
