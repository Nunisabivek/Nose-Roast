package com.noseroast.game

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioManager as SystemAudioManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {

    private var hasCameraPermission by mutableStateOf(false)
    private val gameViewModel = GameEngineViewModel()
    private var audioManager: AudioManager? = null
    private var adManager: AdManager? = null
    private var roastTts: RoastTtsManager? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (!isGranted) Toast.makeText(this, "Camera is required to play!", Toast.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("NRMain", "onCreate")
        volumeControlStream = SystemAudioManager.STREAM_MUSIC

        hasCameraPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)

        audioManager = runCatching { AudioManager(this) }
            .onFailure { Log.e("NRMain", "Audio init failed: ${it.message}", it) }
            .getOrNull()
        roastTts = runCatching { RoastTtsManager(this) }
            .onFailure { Log.e("NRMain", "TTS init failed: ${it.message}", it) }
            .getOrNull()
        setContent {
            val density = LocalDensity.current.density
            val engine = remember { GameEngine(density) }
            var activeAdManager by remember { mutableStateOf<AdManager?>(null) }
            var isRestartingFromAd by remember { mutableStateOf(false) }
            val shouldRunTracking = hasCameraPermission &&
                engine.status != GameStatus.START &&
                !isRestartingFromAd
            val faceHelper = if (shouldRunTracking) {
                remember {
                    runCatching { FaceDetectionHelper(this@MainActivity, gameViewModel) }
                        .onFailure { Log.e("NRMain", "Face tracking init failed: ${it.message}", it) }
                        .getOrNull()
                }
            } else {
                null
            }
            val latestAudioManager = rememberUpdatedState(audioManager)
            val latestAdManager = rememberUpdatedState(activeAdManager)
            val latestRoastTts = rememberUpdatedState(roastTts)

            val rawBirdY by gameViewModel.birdNormalizedY.collectAsState()
            LaunchedEffect(rawBirdY) {
                engine.updateBirdY(rawBirdY)
            }

            LaunchedEffect(Unit) {
                delay(750)
                activeAdManager = runCatching { AdManager(this@MainActivity) }
                    .onFailure { Log.e("NRMain", "Ads init failed: ${it.message}", it) }
                    .getOrNull()
                adManager = activeAdManager
            }

            LaunchedEffect(activeAdManager) {
                activeAdManager?.attachBannerOverlay()
            }

            DisposableEffect(engine, faceHelper) {
                engine.onScoreEvent = { latestAudioManager.value?.playScore() }
                engine.onCrashEvent = {
                    latestAudioManager.value?.playCrash()
                    latestAudioManager.value?.stopBgm()
                    latestAdManager.value?.onGameOver()
                }
                onDispose {
                    engine.onScoreEvent = null
                    engine.onCrashEvent = null
                    faceHelper?.clearFaceLandmarker()
                }
            }

            LaunchedEffect(engine.status) {
                if (engine.status == GameStatus.COUNTDOWN) {
                    roastTts?.stop()
                    engine.countdown = 3
                    delay(1000)
                    engine.countdown = 2
                    delay(1000)
                    engine.countdown = 1
                    delay(1000)
                    engine.status = GameStatus.PLAYING
                    audioManager?.startBgm()
                }
            }

            DisposableEffect(Unit) {
                onDispose {
                    audioManager?.release()
                    adManager?.destroyBanner()
                    roastTts?.release()
                }
            }

            Column(Modifier.fillMaxSize().background(Color(0xFF0F172A))) {
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (hasCameraPermission) {
                        if (faceHelper != null) {
                            CameraPreview(faceHelper = faceHelper, modifier = Modifier.fillMaxSize())
                            Box(Modifier.fillMaxSize().background(Color(0x40020617)))
                        }

                        GameSurface(engine = engine, modifier = Modifier.fillMaxSize())

                        if (engine.status == GameStatus.PLAYING) {
                            ScoreHud(score = engine.score, heat = 3.8f + engine.score * 0.1f, level = engine.score / 5)
                        }

                        if (engine.status == GameStatus.START) {
                            StartMenu(onPlayClick = {
                                audioManager?.playScore()
                                engine.start()
                            })
                        }

                        if (engine.status == GameStatus.GAMEOVER) {
                            RoastCard(
                                score = engine.score,
                                highScore = engine.highScore,
                                roastText = engine.currentRoast,
                                isRestarting = isRestartingFromAd,
                                onShown = { latestRoastTts.value?.speak(engine.currentRoast) },
                                onRetry = {
                                    if (isRestartingFromAd) return@RoastCard

                                    isRestartingFromAd = true
                                    audioManager?.playScore()
                                    activeAdManager?.showInterstitialThen {
                                        isRestartingFromAd = false
                                        engine.start()
                                    } ?: run {
                                        isRestartingFromAd = false
                                        engine.start()
                                    }
                                }
                            )
                        }

                        if (engine.status == GameStatus.COUNTDOWN) {
                            CountdownOverlay(count = engine.countdown)
                        }

                        if (isRestartingFromAd) {
                            Box(Modifier.fillMaxSize().background(Color(0xCC020617)), contentAlignment = Alignment.Center) {
                                Text("Opening ad...", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        if (shouldRunTracking && faceHelper == null) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("Face tracking unavailable on this device.", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Awaiting Camera Permission...", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(78.dp)
                        .navigationBarsPadding()
                        .background(Color(0xFF020617))
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        adManager?.resumeBanner()
    }

    override fun onPause() {
        adManager?.pauseBanner()
        super.onPause()
    }
}
