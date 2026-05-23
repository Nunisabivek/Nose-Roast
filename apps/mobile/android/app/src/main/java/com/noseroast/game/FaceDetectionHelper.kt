package com.noseroast.game

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult

class FaceDetectionHelper(
    private val context: Context,
    private val faceLandmarkerResultListener: LandmarkerListener?
) {
    private var faceLandmarker: FaceLandmarker? = null
    @Volatile private var isProcessingFrame = false
    @Volatile private var lastAnalyzedTimestampMs = 0L
    @Volatile private var inFlightBitmap: Bitmap? = null

    // 15ms = ~66fps analysis rate (up from 20ms/50fps)
    private val analysisIntervalMs = 15L

    init {
        setupFaceLandmarker()
    }

    private fun setupFaceLandmarker() {
        // Try GPU first for faster inference, fall back to CPU for compatibility
        val delegates = listOf(Delegate.GPU, Delegate.CPU)
        for (delegate in delegates) {
            try {
                val baseOptions = BaseOptions.builder()
                    .setModelAssetPath("face_landmarker.task")
                    .setDelegate(delegate)
                    .build()

                val options = FaceLandmarker.FaceLandmarkerOptions.builder()
                    .setBaseOptions(baseOptions)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setNumFaces(1)
                    .setMinFaceDetectionConfidence(0.5f)
                    // Lower presence/tracking thresholds = tracks through fast movements better
                    .setMinFacePresenceConfidence(0.4f)
                    .setMinTrackingConfidence(0.4f)
                    .setResultListener(this::returnLivestreamResult)
                    .setErrorListener(this::returnLivestreamError)
                    .setOutputFaceBlendshapes(false)
                    .build()

                faceLandmarker = FaceLandmarker.createFromOptions(context, options)
                Log.d("FaceDetectionHelper", "Initialized with $delegate delegate")
                break
            } catch (e: Exception) {
                Log.w("FaceDetectionHelper", "Failed with $delegate delegate: ${e.message}, trying next")
            }
        }

        if (faceLandmarker == null) {
            Log.e("FaceDetectionHelper", "All delegates failed — face tracking unavailable")
        }
    }

    fun detectLiveStream(imageProxy: ImageProxy, isFrontCamera: Boolean) {
        val landmarker = faceLandmarker
        if (landmarker == null) {
            imageProxy.close()
            return
        }

        val frameTime = SystemClock.uptimeMillis()
        if (isProcessingFrame || frameTime - lastAnalyzedTimestampMs < analysisIntervalMs) {
            imageProxy.close()
            return
        }

        isProcessingFrame = true
        lastAnalyzedTimestampMs = frameTime

        try {
            val bitmap = imageProxy.toBitmap()
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            if (isFrontCamera) {
                matrix.postScale(-1f, 1f, bitmap.width / 2f, bitmap.height / 2f)
            }
            val rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (rotatedBitmap != bitmap && !bitmap.isRecycled) {
                bitmap.recycle()
            }

            val mpImage = BitmapImageBuilder(rotatedBitmap).build()
            inFlightBitmap = rotatedBitmap
            landmarker.detectAsync(mpImage, frameTime)
        } catch (e: Exception) {
            inFlightBitmap?.safeRecycle()
            inFlightBitmap = null
            isProcessingFrame = false
            Log.e("FaceDetectionHelper", "Frame processing error: ${e.message}")
        } finally {
            imageProxy.close()
        }
    }

    @Suppress("UNUSED_PARAMETER")
    private fun returnLivestreamResult(result: FaceLandmarkerResult, input: MPImage) {
        inFlightBitmap?.safeRecycle()
        inFlightBitmap = null
        isProcessingFrame = false
        faceLandmarkerResultListener?.onResults(result)
    }

    private fun returnLivestreamError(error: RuntimeException) {
        inFlightBitmap?.safeRecycle()
        inFlightBitmap = null
        isProcessingFrame = false
        Log.e("FaceDetectionHelper", "Detection error: ${error.message}")
        faceLandmarkerResultListener?.onError(error.message ?: "Unknown error")
    }

    fun clearFaceLandmarker() {
        inFlightBitmap?.safeRecycle()
        inFlightBitmap = null
        faceLandmarker?.close()
        faceLandmarker = null
        isProcessingFrame = false
    }

    private fun Bitmap.safeRecycle() {
        if (!isRecycled) recycle()
    }

    interface LandmarkerListener {
        fun onError(error: String)
        fun onResults(resultBundle: FaceLandmarkerResult)
    }
}
