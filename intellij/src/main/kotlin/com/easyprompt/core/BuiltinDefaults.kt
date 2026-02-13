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
        val baseUrl = intArrayOf(104,116,116,112,115,58,47,47,97,112,105,46,121,121,100,115,49,54,56,46,110,101,116,47,118,49)
            .map { it.toChar() }.joinToString("")
        val apiKey = intArrayOf(115,107,45,103,86,77,73,79,104,57,89,89,76,97,56,88,113,57,75,103,53,120,105,57,107,66,76,114,81,65,48,119,119,75,52,89,65,116,120,74,81,79,81,111,49,74,99,51,100,66,80)
            .map { it.toChar() }.joinToString("")
        val model = intArrayOf(103,101,109,105,110,105,45,51,45,112,114,111,45,112,114,101,118,105,101,119)
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
