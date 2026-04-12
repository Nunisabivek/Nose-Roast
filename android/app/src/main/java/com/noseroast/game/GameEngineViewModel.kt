package com.noseroast.game

import android.util.Log
import androidx.lifecycle.ViewModel
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.abs

class GameEngineViewModel : ViewModel(), FaceDetectionHelper.LandmarkerListener {

    private val _birdNormalizedY = MutableStateFlow(0.5f)
    val birdNormalizedY: StateFlow<Float> = _birdNormalizedY.asStateFlow()
    private var lastPublishedY = 0.5f

    override fun onError(error: String) {
        Log.e("GameVM", "FaceLandmarker Error: $error")
    }

    override fun onResults(resultBundle: FaceLandmarkerResult) {
        val landmarks = resultBundle.faceLandmarks()
        if (landmarks != null && landmarks.isNotEmpty() && landmarks[0].size > 5) {
            val face = landmarks[0]

            // Average nose bridge (#1) and nose tip (#4) for more stable vertical tracking.
            // Nose bridge is less prone to jitter from mouth/nostril movement.
            // Weight nose tip higher since it has larger range of motion.
            val noseY = face[1].y() * 0.35f + face[4].y() * 0.65f

            val adjustedY = ((noseY - 0.15f) / 0.7f).coerceIn(0f, 1f)
            val delta = adjustedY - lastPublishedY

            val stabilizedY = when {
                // Sub-pixel camera noise — discard
                abs(delta) < 0.003f -> lastPublishedY
                // Small intentional moves — smooth to reduce micro-jitter feeding spring
                abs(delta) < 0.04f  -> lastPublishedY + delta * 0.75f
                // Medium moves — moderate smoothing, spring handles the rest
                abs(delta) < 0.12f  -> lastPublishedY + delta * 0.85f
                // Large fast moves — responsive but not instant, spring gives natural decel
                else                 -> lastPublishedY + delta * 0.92f
            }.coerceIn(0f, 1f)

            lastPublishedY = stabilizedY
            _birdNormalizedY.value = stabilizedY
        }
    }
}
