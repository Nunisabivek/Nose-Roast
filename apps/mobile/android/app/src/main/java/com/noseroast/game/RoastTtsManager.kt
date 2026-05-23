package com.noseroast.game

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.util.Log
import java.util.Locale

class RoastTtsManager(context: Context) {

    private var tts: TextToSpeech? = null
    private var isReady = false
    private var pendingRoast: String? = null

    init {
        // Explicitly use Google TTS engine — sounds far more natural than system default
        tts = TextToSpeech(context, { status ->
            if (status == TextToSpeech.SUCCESS) {
                val langResult = tts?.setLanguage(Locale.US)
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.w("RoastTts", "US English not supported, using device default")
                }
                pickBestVoice()
                // Neutral pitch sounds more human; slightly faster = confident, not monotone
                tts?.setPitch(1.0f)
                tts?.setSpeechRate(1.05f)
                isReady = true
                pendingRoast?.let {
                    speakInternal(it)
                    pendingRoast = null
                }
            } else {
                Log.e("RoastTts", "TTS init failed with status: $status")
            }
        }, "com.google.android.tts")
    }

    /** Pick the highest-quality available en-US voice. Falls back gracefully if none found. */
    private fun pickBestVoice() {
        val engine = tts ?: return
        val voices = engine.voices ?: return
        val best = voices
            .filter { v ->
                !v.isNetworkConnectionRequired &&
                v.locale.language == "en" &&
                v.locale.country == "US" &&
                v.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true
            }
            .maxByOrNull { it.quality }
        if (best != null) {
            engine.voice = best
            Log.d("RoastTts", "Using voice: ${best.name} quality=${best.quality}")
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
        val params = Bundle().apply {
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, "roast")
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
