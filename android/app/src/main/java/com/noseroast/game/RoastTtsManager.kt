package com.noseroast.game

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

class RoastTtsManager(context: Context) {

    private var tts: TextToSpeech? = null
    private var isReady = false
    private var pendingRoast: String? = null

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val langResult = tts?.setLanguage(Locale.US)
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.w("RoastTts", "US English not supported, using device default")
                }
                // Slightly elevated pitch = condescending. Normal rate = deliberate, not rushed.
                tts?.setPitch(1.08f)
                tts?.setSpeechRate(0.95f)
                isReady = true
                pendingRoast?.let {
                    speakInternal(it)
                    pendingRoast = null
                }
            } else {
                Log.e("RoastTts", "TTS init failed with status: $status")
            }
        }
    }

    fun speak(roast: String) {
        // Strip emojis and extra whitespace — TTS would read "skull emoji" out loud otherwise
        val clean = roast
            .replace(Regex("[^\\p{L}\\p{N}\\p{P}\\s]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (isReady) speakInternal(clean) else pendingRoast = clean
    }

    private fun speakInternal(text: String) {
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "roast")
    }

    fun stop() {
        tts?.stop()
    }

    fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
