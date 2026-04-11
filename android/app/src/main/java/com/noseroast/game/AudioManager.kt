package com.noseroast.game

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.MediaPlayer
import android.os.Build
import android.util.Log
import android.media.AudioManager as SystemAudioManager
import kotlin.math.max

class AudioManager(private val context: Context) {
    private val systemAudioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as SystemAudioManager

    private var bgmPlayer: MediaPlayer? = null
    private var wantsBgm = false
    private var hasAudioFocus = false
    private val activeOneShots = mutableSetOf<MediaPlayer>()

    private val focusChangeListener = SystemAudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            SystemAudioManager.AUDIOFOCUS_LOSS,
            SystemAudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                try {
                    if (bgmPlayer?.isPlaying == true) bgmPlayer?.pause()
                } catch (_: Exception) {}
            }
            SystemAudioManager.AUDIOFOCUS_GAIN -> {
                if (wantsBgm) {
                    try {
                        if (bgmPlayer?.isPlaying != true) bgmPlayer?.start()
                    } catch (e: Exception) {
                        Log.e("NRAudio", "BGM resume error: ${e.message}", e)
                    }
                }
            }
        }
    }

    private val audioFocusRequest: AudioFocusRequest? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest.Builder(SystemAudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(buildAudioAttributes())
                .setOnAudioFocusChangeListener(focusChangeListener)
                .build()
        } else {
            null
        }

    init {
        ensureAudibleVolume()
        logVolumeState("init")
        bgmPlayer = createPlayer(R.raw.bgm, volume = 0.75f, looping = true)
        if (bgmPlayer == null) {
            Log.e("NRAudio", "BGM player failed to initialize")
        } else {
            Log.d("NRAudio", "BGM player initialized")
        }
    }

    private fun buildAudioAttributes(): AudioAttributes {
        return AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setLegacyStreamType(SystemAudioManager.STREAM_MUSIC)
            .build()
    }

    private fun logVolumeState(reason: String) {
        val current = systemAudioManager.getStreamVolume(SystemAudioManager.STREAM_MUSIC)
        val max = systemAudioManager.getStreamMaxVolume(SystemAudioManager.STREAM_MUSIC)
        Log.d("NRAudio", "Volume[$reason] music=$current/$max ringerMode=${systemAudioManager.ringerMode}")
    }

    private fun ensureAudibleVolume() {
        runCatching {
            val current = systemAudioManager.getStreamVolume(SystemAudioManager.STREAM_MUSIC)
            val maxVolume = systemAudioManager.getStreamMaxVolume(SystemAudioManager.STREAM_MUSIC)
            if (current == 0 && maxVolume > 0) {
                val target = max(1, maxVolume / 3)
                systemAudioManager.setStreamVolume(SystemAudioManager.STREAM_MUSIC, target, 0)
                Log.d("NRAudio", "Raised music volume from 0 to $target")
            }
        }.onFailure { error ->
            Log.e("NRAudio", "Unable to ensure audible volume: ${error.message}", error)
        }
    }

    private fun requestAudioFocusIfNeeded() {
        if (hasAudioFocus) return

        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            systemAudioManager.requestAudioFocus(audioFocusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            systemAudioManager.requestAudioFocus(
                focusChangeListener,
                SystemAudioManager.STREAM_MUSIC,
                SystemAudioManager.AUDIOFOCUS_GAIN
            )
        }

        hasAudioFocus = result == SystemAudioManager.AUDIOFOCUS_REQUEST_GRANTED
        Log.d("NRAudio", "Audio focus granted=$hasAudioFocus")
    }

    private fun createPlayer(resId: Int, volume: Float, looping: Boolean): MediaPlayer? {
        return runCatching {
            val afd = context.resources.openRawResourceFd(resId)
                ?: return@runCatching null
            MediaPlayer().apply {
                setAudioAttributes(buildAudioAttributes())
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = looping
                setVolume(volume, volume)
                prepare()
            }
        }.onFailure { error ->
            Log.e("NRAudio", "createPlayer FAILED for resId=$resId: ${error.message}", error)
        }.getOrNull()
    }

    private fun playOneShot(resId: Int, volume: Float) {
        try {
            logVolumeState("playOneShot:$resId")
            requestAudioFocusIfNeeded()

            val player = createPlayer(resId, volume, looping = false)
            if (player == null) {
                Log.e("NRAudio", "One-shot player could not be created for resId=$resId")
                return
            }

            activeOneShots += player
            player.setOnCompletionListener { completed ->
                activeOneShots -= completed
                completed.release()
            }
            player.setOnErrorListener { errored, what, extra ->
                Log.e("NRAudio", "One-shot player error: resId=$resId what=$what extra=$extra")
                activeOneShots -= errored
                errored.release()
                true
            }
            player.start()
            Log.d("NRAudio", "One-shot started for resId=$resId")
        } catch (e: Exception) {
            Log.e("NRAudio", "One-shot play FAILED for resId=$resId: ${e.message}", e)
        }
    }

    fun playScore() {
        playOneShot(R.raw.score, 0.9f)
    }

    fun playCrash() {
        playOneShot(R.raw.crash, 1f)
    }

    fun startBgm() {
        wantsBgm = true
        ensureAudibleVolume()
        logVolumeState("startBgm")

        if (bgmPlayer == null) {
            bgmPlayer = createPlayer(R.raw.bgm, volume = 0.75f, looping = true)
        }

        try {
            requestAudioFocusIfNeeded()
            if (bgmPlayer?.isPlaying != true) {
                bgmPlayer?.start()
                Log.d("NRAudio", "BGM started")
            }
        } catch (e: Exception) {
            Log.e("NRAudio", "BGM start FAILED: ${e.message}", e)
        }
    }

    fun stopBgm() {
        wantsBgm = false
        try {
            if (bgmPlayer?.isPlaying == true) {
                bgmPlayer?.pause()
                Log.d("NRAudio", "BGM paused")
            }
        } catch (e: Exception) {
            Log.e("NRAudio", "BGM pause FAILED: ${e.message}", e)
        }
    }

    fun release() {
        wantsBgm = false
        try {
            bgmPlayer?.release()
        } catch (_: Exception) {}
        bgmPlayer = null
        activeOneShots.forEach { player ->
            runCatching { player.release() }
        }
        activeOneShots.clear()

        if (hasAudioFocus) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                systemAudioManager.abandonAudioFocusRequest(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                systemAudioManager.abandonAudioFocus(focusChangeListener)
            }
            hasAudioFocus = false
        }
    }
}
