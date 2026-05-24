import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameState, GAME_CONFIG, INITIAL_BIRD_Y, DIFFICULTY_MAX_SPEED, DIFFICULTY_MIN_GAP, DIFFICULTY_RAMP_SECONDS, CAMERA_CONFIG, FACE_DETECTION_CONFIG, GAME_LOOP_CONFIG, PRE_ROASTS_WAITING, getRoastForScore, getCrashRoast } from '@noseroast/shared';
import { RefreshCw, Play, Loader2, TrendingUp, Flame, CameraOff, Share2, Copy, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import RoastCard from './components/RoastCard';
import { AdMobService } from './services/admob';
import { AudioManager } from './services/AudioManager';
import GameCanvas, { PipeData, PlayerRenderData } from './components/GameCanvas';

const IS_NATIVE = Capacitor.isNativePlatform();
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.noseroast.game';
const PRIVACY_URL = '/privacy.html';

// Version info for tracking
const APP_VERSION = '2.1.0-Mobile';
const BUILD_DATE = '2026-05-23';

interface InternalPipeState {
  id: number;
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
  isMoving: boolean;
  moveDirection: 1 | -1;
  moveSpeed: number;
  baseTopHeight: number;
  moveRange: number;
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('LOADING');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [commentary, setCommentary] = useState<string>('');
  const [currentSpeed, setCurrentSpeed] = useState(GAME_CONFIG.pipeSpeed);
  const [preRoastText, setPreRoastText] = useState('');
  const [adCountdown, setAdCountdown] = useState(1);
  const [gameCountdown, setGameCountdown] = useState(3);
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [gameDimensions, setGameDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : GAME_CONFIG.width,
    height: typeof window !== 'undefined' ? window.innerHeight : GAME_CONFIG.height
  });
  const [username, setUsername] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [fps, setFps] = useState(0);
  const [scoreAlert, setScoreAlert] = useState<{ text: string; key: number } | null>(null);

  const [roastVoiceProfile, setRoastVoiceProfile] = useState<'sarcastic' | 'hype' | 'deadpan'>(() => {
    return (localStorage.getItem('noseroast_voice_profile') as any) || 'sarcastic';
  });

  // Visual sensory effects
  const [shakeLeft, setShakeLeft] = useState(false);
  const [flashLeft, setFlashLeft] = useState(false);

  // Refs for DOM nodes
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Mutable game loops & physical coords (essential for performance)
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastPipeTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const lastProcessTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(GAME_CONFIG.pipeSpeed);
  const gapRef = useRef<number>(GAME_CONFIG.pipeGap);
  const scoreRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>('LOADING');
  const gameDimensionsRef = useRef(gameDimensions);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const lastSpeedUpdateRef = useRef<number>(0);

  // Local player physics refs
  const lastCountdownRef = useRef<number>(-1);
  const birdYRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const targetBirdYRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const birdRotationRef = useRef<number>(0);
  const isLocalDeadRef = useRef(false);
  const calibrationNoseYRef = useRef<number | null>(null);

  const pipesRef = useRef<InternalPipeState[]>([]);

  // Keep refs synced with React state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gameDimensionsRef.current = gameDimensions; }, [gameDimensions]);

  // Synchronize AdMob banner for Android (native only)
  useEffect(() => {
    if (IS_NATIVE) {
      const initAds = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await AdMobService.initialize();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await AdMobService.showBanner();
      };
      initAds();
    }
  }, []);

  // Load Saved Data
  useEffect(() => {
    const savedName = localStorage.getItem('noseroast_username');
    if (savedName) setUsername(savedName);

    const savedHighScore = localStorage.getItem('noseroast_highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));

    console.log(`Nose Roast Mobile v${APP_VERSION} - Built: ${BUILD_DATE}`);
  }, []);

  const handleUsernameChange = (name: string) => {
    setUsername(name);
    localStorage.setItem('noseroast_username', name);
  };

  // Savagely speak the roast using Web Speech Synthesis
  const speakRoast = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        // Cancel active speech to prevent queuing overlap
        window.speechSynthesis.cancel();

        // Strip emoji icons so browser doesn't try to say them
        const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        
        // Define personality metrics based on chosen voice profile for premium clear tone
        let pitchVal = 0.95;
        let rateVal = 1.05;
        
        if (roastVoiceProfile === 'hype') {
          pitchVal = 1.08;
          rateVal = 1.10;
        } else if (roastVoiceProfile === 'deadpan') {
          pitchVal = 0.95;
          rateVal = 0.95;
        } else {
          // sarcastic
          pitchVal = 0.92;
          rateVal = 1.02;
        }

        // Find the absolute best matching natural English voice for the personality
        let activeVoice: SpeechSynthesisVoice | undefined;
        if (roastVoiceProfile === 'hype') {
          // Prefer high-energy/female tones (Samantha, Zira, Google UK Female)
          activeVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Google UK English Female') || v.name.includes('Victoria'))) ||
                        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google'))) ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];
        } else if (roastVoiceProfile === 'deadpan') {
          // Prefer monotone/robotic tones (Hazel, Mark, Google UK Male)
          activeVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Mark') || v.name.includes('Hazel') || v.name.includes('Zira'))) ||
                        voices.find(v => v.lang.startsWith('en') && v.name.includes('Male')) ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];
        } else {
          // Sarcastic: Deep/resonant/expressive male voice (Google US English, Daniel, David)
          activeVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google US English') || v.name.includes('Daniel') || v.name.includes('David') || v.name.includes('Natural'))) ||
                        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Male') || v.name.includes('Google'))) ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];
        }

        if (activeVoice) {
          utterance.voice = activeVoice;
        }

        utterance.volume = 1.0; 
        utterance.rate = rateVal;  
        utterance.pitch = pitchVal; 

        // Duck background music extremely low (to 1%) so the speech is clearly the louder/dominant sound!
        // We duck BGM rather than Master Volume so key SFX (like the crash sound) are not muted/ducked.
        AudioManager.getInstance().setBGMVolume(0.01);

        let volumeRestored = false;
        const restoreVolume = () => {
          if (!volumeRestored) {
            volumeRestored = true;
            AudioManager.getInstance().setBGMVolume(0.5); // Restore BGM volume fully
          }
        };

        utterance.onend = () => {
          restoreVolume();
        };
        utterance.onerror = () => {
          restoreVolume();
        };

        // Fallback safety timeout: always restore volume after 8 seconds if TTS gets stuck
        setTimeout(() => {
          restoreVolume();
        }, 8000);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis failure:', err);
      }
    }
  }, [roastVoiceProfile]);

  // Pre-load voices on mount to avoid delay in Speech API
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  const shareRoast = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `roast_${Date.now()}.png`;
      const savedFile = await Filesystem.writeFile({ path: fileName, data: dataUrl, directory: Directory.Cache });
      await Share.share({ title: 'Nose Roast Judgment', text: `Score: ${scoreRef.current}. Roast: "${commentary}" #NoseRoast`, url: savedFile.uri, dialogTitle: 'Share your Roast' });
    } catch (error) {
      await Share.share({ title: 'Nose Roast Judgment', text: `I scored ${scoreRef.current} in Nose Roast! My verdict: "${commentary}"`, dialogTitle: 'Share your Roast' });
    } finally {
      setIsSharing(false);
    }
  };

  // Initialize Face Tracking & Local Camera Feed
  useEffect(() => {
    const initTracking = async () => {
      const cameraPromise = (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: CAMERA_CONFIG.frameRate,
              facingMode: CAMERA_CONFIG.facingMode
            }
          });
          localStreamRef.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }
          console.log('✅ Local camera initialized and cached');
          return stream;
        } catch (err) {
          console.error('❌ Camera permission denied:', err);
          setShowPermissionError(true);
          throw err;
        }
      })();

      const modelPromise = (async () => {
        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { 
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, 
            delegate: "GPU" 
          },
          outputFaceBlendshapes: false,
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        landmarkerRef.current = faceLandmarker;
        console.log('✅ Face Landmarker model initialized');
        return faceLandmarker;
      })();

      try {
        await Promise.all([cameraPromise.catch(() => {}), modelPromise]);
        
        if (landmarkerRef.current) {
          setGameState('START');
        }
      } catch (error) {
        console.error("AI Initialization Failed:", error);
      }
    };
    initTracking();
  }, []);

  // Self-Healing Effect
  useEffect(() => {
    if (videoRef.current && localStreamRef.current && videoRef.current.srcObject !== localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
      videoRef.current.play().catch(e => console.error("Error auto-playing local stream:", e));
    }
  }, [gameState]);

  // Handle screen sizing
  useEffect(() => {
    const handleResize = () => setGameDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);

    const dims = gameDimensionsRef.current;
    const initialY = dims.height / 2 - GAME_CONFIG.birdHeight / 2;

    birdYRef.current = initialY;
    targetBirdYRef.current = initialY;
    birdRotationRef.current = 0;

    calibrationNoseYRef.current = null;
    isLocalDeadRef.current = false;
    pipesRef.current = [];

    lastPipeTimeRef.current = performance.now() - 1100; // First pipe spawns earlier (500ms after game start)
    gameStartTimeRef.current = performance.now();
    setCommentary('');
    speedRef.current = GAME_CONFIG.pipeSpeed;
    gapRef.current = GAME_CONFIG.pipeGap;
    setCurrentSpeed(GAME_CONFIG.pipeSpeed);
    setAdCountdown(1);

    canvasRef.current?.clear();
  }, []);

  const startCountdownFlow = (countdownMs: number = 3000) => {
    resetGame();
    lastCountdownRef.current = -1;
    gameStartTimeRef.current = performance.now() + countdownMs;
    setGameCountdown(3);
    setGameState('COUNTDOWN');
  };

  const handleGameOver = useCallback((reason: string) => {
    const crashRoast = getCrashRoast();
    setCommentary(crashRoast);

    setGameState('AD_INTERSTITIAL');
    AudioManager.getInstance().stopBGM();
    AudioManager.getInstance().playSound('crash');
    
    setTimeout(() => {
      speakRoast(crashRoast);
    }, 250);

    const localRoast = getRoastForScore(scoreRef.current);
    let timer = 1;
    setAdCountdown(1);
    const interval = setInterval(() => {
      timer -= 1;
      setAdCountdown(timer);
      if (timer <= 0) {
        clearInterval(interval);
        setCommentary(localRoast);
        setScore(scoreRef.current);
        setGameState('GAMEOVER');
        
        setTimeout(() => {
          speakRoast(localRoast);
        }, 150);

        setHighScore(prev => {
          const newHigh = Math.max(prev, scoreRef.current);
          localStorage.setItem('noseroast_highscore', newHigh.toString());
          return newHigh;
        });

        // Trigger mobile interstitial ad every few gameovers to maximize ad revenue!
        if (IS_NATIVE) {
          AdMobService.showInterstitial().catch(err => console.error("AdMob Interstitial failed to load:", err));
        }
      }
    }, 1000);
  }, [speakRoast]);

  // --- THE OPTIMIZED GAME LOOP WITH DELTA TIME ---
  const update = useCallback((currentTime: number) => {
    requestRef.current = requestAnimationFrame(update);

    const deltaTime = lastTimeRef.current === 0 ? 16.67 : currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    const clampedDeltaTime = Math.min(deltaTime, GAME_LOOP_CONFIG.maxDeltaTime);
    const deltaSeconds = clampedDeltaTime / 1000;

    frameCountRef.current++;
    if (currentTime - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = currentTime;
    }

    const isTrackingAllowed = gameStateRef.current === 'PLAYING' || gameStateRef.current === 'COUNTDOWN';
    const isGameRunning = gameStateRef.current === 'PLAYING';

    if (!isTrackingAllowed) return;

    const dims = gameDimensionsRef.current;
    const playWidth = dims.width;

    // Difficulty multiplier
    const elapsedSeconds = (currentTime - gameStartTimeRef.current) / 1000;
    const progress = Math.min(1, elapsedSeconds / DIFFICULTY_RAMP_SECONDS);
    speedRef.current = GAME_CONFIG.pipeSpeed + (DIFFICULTY_MAX_SPEED - GAME_CONFIG.pipeSpeed) * progress;
    gapRef.current = GAME_CONFIG.pipeGap - (GAME_CONFIG.pipeGap - DIFFICULTY_MIN_GAP) * progress;
    if (currentTime - lastSpeedUpdateRef.current > 250) {
      lastSpeedUpdateRef.current = currentTime;
      setCurrentSpeed(speedRef.current);
    }

    // Handle countdown phase dynamically in requestAnimationFrame for driftless high-precision countdown
    if (gameStateRef.current === 'COUNTDOWN') {
      const remainingMs = gameStartTimeRef.current - currentTime;
      const count = Math.ceil(remainingMs / 1000);
      if (count > 0 && count <= 3) {
        if (count !== lastCountdownRef.current) {
          lastCountdownRef.current = count;
          setGameCountdown(count);
        }
      }
      
      if (remainingMs <= 0) {
        gameStartTimeRef.current = currentTime; // Align start time precisely with current frame time!
        lastPipeTimeRef.current = currentTime - 1100; // First pipe spawns earlier (500ms after game start)
        gameStateRef.current = 'PLAYING'; // Instant ref update for immediate physics initialization!
        setGameState('PLAYING');
        AudioManager.getInstance().playBGM();
      }
    }

    // --- FACE TRACKING (Nose Y Position calculation) ---
    if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
      if (currentTime - lastProcessTimeRef.current > 40) {
        lastProcessTimeRef.current = currentTime;
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, currentTime);
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const faceY = results.faceLandmarks[0][FACE_DETECTION_CONFIG.noseLandmarkIndex].y;
            
            if (gameStateRef.current === 'PLAYING') {
              if (calibrationNoseYRef.current === null) {
                calibrationNoseYRef.current = faceY;
              }
              
              const displacement = faceY - calibrationNoseYRef.current;
              const sensitivity = 2.2;
              const normalizedDisplacement = displacement * sensitivity;
              
              const centerY = dims.height / 2 - GAME_CONFIG.birdHeight / 2;
              const targetY = centerY + normalizedDisplacement * dims.height;
              
              targetBirdYRef.current = Math.max(0, Math.min(dims.height - GAME_CONFIG.birdHeight, targetY));
            } else {
              targetBirdYRef.current = dims.height / 2 - GAME_CONFIG.birdHeight / 2;
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Ultra-smooth, highly responsive time-corrected adaptive interpolation
      const distance = targetBirdYRef.current - birdYRef.current;
      const absDist = Math.abs(distance);
      
      // Dynamic speed coefficient: small distance -> rock-solid stable, large distance -> snappy dodge
      const minSpeedCoeff = 6.5;
      const maxSpeedCoeff = 20.0;
      
      // Ramping based on distance (normalized to 120 pixels of maximum displacement range)
      const distRatio = Math.min(1.0, absDist / 120.0);
      const adaptiveCoeff = minSpeedCoeff + (maxSpeedCoeff - minSpeedCoeff) * Math.pow(distRatio, 1.5);
      
      // Calculate time-corrected lerp factor (exp decay ensures same physical speed across 30, 60, 120+ Hz)
      const lerpFactor = 1 - Math.exp(-adaptiveCoeff * deltaSeconds);
      const newY = birdYRef.current + distance * lerpFactor;
      
      // Smooth, inertia-based rotation that responds organically to physics
      const velocity = deltaSeconds > 0 ? (newY - birdYRef.current) / deltaSeconds : 0;
      const maxPhysSpeed = 700; // max reference velocity in pixels/sec
      const clampedVelocity = Math.max(-maxPhysSpeed, Math.min(maxPhysSpeed, velocity));
      
      // Going up -> point up (up to -28 deg). Going down -> dive down (up to 55 deg)
      const targetRotation = (clampedVelocity / maxPhysSpeed) * (clampedVelocity < 0 ? 28 : 55);
      // Smoothly interpolate rotation using a time-corrected factor to prevent angular jitter
      const rotationCoeff = 10.0;
      const rotationLerp = 1 - Math.exp(-rotationCoeff * deltaSeconds);
      
      birdRotationRef.current = birdRotationRef.current + (targetRotation - birdRotationRef.current) * rotationLerp;
      birdYRef.current = newY;
    }

    if (!isGameRunning) {
      // Stop physics update during countdown, but keep drawing
      const p1Data: PlayerRenderData = { birdY: birdYRef.current, birdRotation: birdRotationRef.current, score: scoreRef.current, isDead: isLocalDeadRef.current };
      canvasRef.current?.render('SOLO', p1Data, p1Data, pipesRef.current, highScore);
      return;
    }

    // --- PIPES SPAWNING ---
    const baseInterval = 1600;
    const minInterval = 850;
    const speedFactor = (speedRef.current - GAME_CONFIG.pipeSpeed) / (DIFFICULTY_MAX_SPEED - GAME_CONFIG.pipeSpeed);
    const spawnInterval = Math.max(minInterval, baseInterval - (speedFactor * 750));

    if (currentTime - lastPipeTimeRef.current > spawnInterval) {
      const pipeGap = Math.max(160, gapRef.current);
      const minWall = 60;
      let availableSpace = dims.height - pipeGap - (minWall * 2);
      if (availableSpace < 0) availableSpace = 0;

      const randomOffset = Math.floor(Math.random() * availableSpace);
      let topHeight = minWall + randomOffset;
      topHeight = Math.max(minWall, Math.min(topHeight, dims.height - pipeGap - minWall));

      // Moving pipe logic (starts after score 3)
      const currentScore = scoreRef.current;
      let isMoving = false;
      let moveSpeed = 0;
      let moveRange = 0;

      if (currentScore >= 3) {
        const movingChance = currentScore >= 15 ? 0.75 : currentScore >= 10 ? 0.6 : currentScore >= 7 ? 0.45 : 0.25;
        isMoving = Math.random() < movingChance;
        if (isMoving) {
          moveSpeed = Math.min(2.5, 0.8 + (currentScore - 3) * 0.12);
          moveRange = Math.min(90, 35 + (currentScore - 3) * 4);
          const buffer = moveRange + 20;
          topHeight = Math.max(minWall + buffer, Math.min(topHeight, dims.height - pipeGap - minWall - buffer));
        }
      }

      const newId = Date.now();
      const newPipe: InternalPipeState = {
        id: newId,
        x: playWidth,
        topHeight,
        gap: pipeGap,
        passed: false,
        isMoving,
        moveDirection: Math.random() < 0.5 ? 1 : -1,
        moveSpeed,
        baseTopHeight: topHeight,
        moveRange,
      };
      pipesRef.current.push(newPipe);

      lastPipeTimeRef.current = currentTime;
    }

    // --- MOVE PIPES & CHECK COLLISIONS ---
    const birdRect = {
      left: 50 + 12,
      right: 50 + GAME_CONFIG.birdWidth - 12,
      top: birdYRef.current + 8,
      bottom: birdYRef.current + GAME_CONFIG.birdHeight - 8
    };

    let passOccurred = 0;
    const pixelsPerSecond = speedRef.current * 60;
    const moveAmount = pixelsPerSecond * deltaSeconds;

    const pipes = pipesRef.current;
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= moveAmount;

      if (p.isMoving) {
        const verticalSpeed = p.moveSpeed * 60;
        p.topHeight += verticalSpeed * deltaSeconds * p.moveDirection;
        const minBound = p.baseTopHeight - p.moveRange;
        const maxBound = p.baseTopHeight + p.moveRange;

        if (p.topHeight <= minBound) {
          p.topHeight = minBound;
          p.moveDirection = 1;
        } else if (p.topHeight >= maxBound) {
          p.topHeight = maxBound;
          p.moveDirection = -1;
        }
      }

      // Check Local Pass
      if (!isLocalDeadRef.current && !p.passed && p.x + GAME_CONFIG.pipeWidth < 50) {
        p.passed = true;
        passOccurred++;
      }

      // Check Local Collision
      if (!isLocalDeadRef.current && birdRect.right > p.x && birdRect.left < p.x + GAME_CONFIG.pipeWidth) {
        if (birdRect.top < p.topHeight || birdRect.bottom > p.topHeight + p.gap) {
          triggerLocalCrash();
        }
      }

      // Cleanup offscreen pipes
      if (p.x < -GAME_CONFIG.pipeWidth) {
        pipes.splice(i, 1);
      }
    }

    if (passOccurred > 0) {
      scoreRef.current += passOccurred;
      const newScore = scoreRef.current;
      setScore(newScore);
      AudioManager.getInstance().playSound('score');

      // Awesome milestone alerts to juice the progression!
      let alertText = `+1`;
      if (newScore === 3) alertText = "RISING STAR! 🐣";
      else if (newScore === 7) alertText = "ON FIRE! ⚡";
      else if (newScore === 12) alertText = "Savage Combo! 🔥";
      else if (newScore === 18) alertText = "LEGENDARY! 👑";
      else if (newScore === 25) alertText = "NOSE ROAST GOD! 👃";

      setScoreAlert({ text: alertText, key: Date.now() });
    }

    // Boundary check
    if (!isLocalDeadRef.current && (birdYRef.current <= -40 || birdYRef.current >= dims.height - GAME_CONFIG.birdHeight + 40)) {
      triggerLocalCrash();
    }

    // RENDER Canvas
    const p1Data: PlayerRenderData = { birdY: birdYRef.current, birdRotation: birdRotationRef.current, score: scoreRef.current, isDead: isLocalDeadRef.current };
    canvasRef.current?.render('SOLO', p1Data, p1Data, pipesRef.current, highScore);
  }, [handleGameOver, highScore]);

  const triggerLocalCrash = () => {
    handleGameOver("crashed");
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  const isHyperDrive = gameState === 'PLAYING' && (score >= 8 || currentSpeed > 5.5);

  const renderSpeedLines = () => {
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const left = `${15 + i * 14 + Math.random() * 4}%`;
      const delay = `${(i * 0.08).toFixed(2)}s`;
      const duration = `${(0.25 + Math.random() * 0.15).toFixed(2)}s`;
      lines.push(
        <div
          key={i}
          className="speed-line"
          style={{
            left,
            animationDelay: delay,
            animationDuration: duration,
          }}
        />
      );
    }
    return lines;
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden text-white font-inter select-none transition-all duration-700 relative ${gameState === 'START' ? 'mesh-gradient-bg' : 'bg-slate-950'}`}>
      
      {/* GLOBAL WEBCAM FEED BACKGROUND */}
      <div className="absolute inset-0 w-screen h-screen z-0 pointer-events-none flex overflow-hidden bg-slate-950">
        <div className={`w-full h-full relative overflow-hidden transition-all duration-300 ${shakeLeft ? 'animate-shake' : ''} ${isHyperDrive ? 'hyper-drive-glow' : ''}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            loop
            className="w-full h-full object-cover webcam-feed-clear"
            style={{ transform: 'scaleX(-1)' }}
          />
          {flashLeft && <div className="absolute inset-0 bg-red-600 animate-flash-red z-10" />}
          {isHyperDrive && renderSpeedLines()}
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-transparent">
        
        {/* UPPER VIEWPORT: HUD / CANVAS */}
        <div className="flex-1 relative overflow-hidden bg-transparent">

          {/* Game Canvas */}
          <GameCanvas
            ref={canvasRef}
            width={gameDimensions.width}
            height={gameDimensions.height}
            pipeWidth={GAME_CONFIG.pipeWidth}
          />

          {/* Floating score alert milestone pops */}
          {scoreAlert && (
            <div
              key={scoreAlert.key}
              className="absolute pointer-events-none z-50 animate-score-alert text-center font-game font-black uppercase tracking-wider text-gradient-orange text-2xl"
              style={{
                left: '50%',
                top: '30%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {scoreAlert.text}
            </div>
          )}

          {/* FPS Debug Counter */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute top-2 right-2 z-50 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
              FPS: {fps} | Mobile v{APP_VERSION}
            </div>
          )}

          {/* HUD Accents */}
          {gameState === 'PLAYING' && (
            <div className="absolute top-20 inset-x-0 flex flex-col items-center gap-3 z-30 pointer-events-none">
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 rounded-full border-2 border-slate-950 shadow-lg">
                  <Flame size={12} fill="currentColor" className="text-white" />
                  <span className="text-[10px] font-game text-white font-black">HEAT {currentSpeed.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 rounded-full border-2 border-slate-950 shadow-lg">
                  <TrendingUp size={12} className="text-white" />
                  <span className="text-[10px] font-game text-white font-black">LVL {Math.max(1, Math.floor((currentSpeed - GAME_CONFIG.pipeSpeed) / 0.5) + 1)}</span>
                </div>
              </div>
              
              {isHyperDrive && (
                <div className="bg-gradient-to-r from-red-600 via-orange-500 to-indigo-600 px-6 py-2 rounded-full border-2 border-white shadow-2xl animate-hyper-text text-white text-[10px] font-game font-black tracking-widest flex items-center gap-2">
                  <span>⚡</span> HYPER DRIVE ACTIVATED! <span>⚡</span>
                </div>
              )}
            </div>
          )}

          {/* START SCREEN */}
          {gameState === 'START' && (
            <div className="absolute inset-0 bg-transparent flex flex-col items-center justify-center z-50 text-center overflow-hidden">
              <div className="flex-1 flex flex-col items-center overflow-y-auto py-8 px-6 w-full relative">
                
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-10 left-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl floating-blob" />
                  <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl floating-blob" style={{ animationDelay: '-4s' }} />
                </div>

                <div className="my-auto w-full max-w-sm flex flex-col items-center flex-shrink-0 relative">

                  {/* Logo Section */}
                  <div className="relative mb-1.5 sm:mb-3 animate-float">
                    <div className="w-14 h-14 sm:w-28 sm:h-28 bg-gradient-to-br from-orange-500 via-red-500 to-indigo-500 rounded-[1.1rem] sm:rounded-[2.2rem] p-1 shadow-2xl shadow-orange-500/30">
                      <div className="w-full h-full bg-slate-950 rounded-[0.95rem] sm:rounded-[2rem] flex items-center justify-center overflow-hidden">
                        <img src="/logo.png" alt="Nose Roast" className="w-[110%] h-[110%] object-contain" />
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl sm:text-4xl font-game text-white tracking-tight leading-none mb-0.5 sm:mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]">
                    NOSE<span className="text-gradient-orange">ROAST</span>
                  </h1>
                  <p className="text-white/95 text-[9px] sm:text-[11px] uppercase font-extrabold tracking-[0.16em] mb-2 sm:mb-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Fly with your face • Live Gaming</p>

                  {/* Glass Main UI Container */}
                  <div className="w-full max-w-sm p-3.5 sm:p-6 glass-panel rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-2xl flex flex-col items-center flex-shrink-0">
                    
                    {/* Username Input */}
                    <div className="w-full mb-2.5 sm:mb-4 relative">
                      <p className="text-white/90 text-[9px] sm:text-[11px] uppercase tracking-[0.15em] mb-1 sm:mb-2 font-black text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">Your Name</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">👃</span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => handleUsernameChange(e.target.value)}
                          placeholder="Enter your name..."
                          maxLength={15}
                          className="genz-input w-full bg-slate-950/45 border border-white/10 rounded-full pl-10 pr-5 py-1.5 sm:py-2 text-white text-center text-xs sm:text-sm font-extrabold focus:outline-none focus:border-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.25)] transition-all placeholder-white/50"
                        />
                      </div>
                    </div>

                    {/* Roastmaster Voice Personality Selector */}
                    <div className="w-full mb-3 sm:mb-5">
                      <p className="text-white/90 text-[9px] sm:text-[11px] uppercase tracking-[0.15em] mb-1 sm:mb-2 font-black text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">🔊 Roastmaster Voice Tone</p>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/40 border border-white/8 rounded-2xl">
                        <button
                          onClick={() => {
                            setRoastVoiceProfile('sarcastic');
                            localStorage.setItem('noseroast_voice_profile', 'sarcastic');
                          }}
                          className={`py-1.5 px-0.5 rounded-xl text-[10px] font-game transition-all duration-300 border ${
                            roastVoiceProfile === 'sarcastic'
                              ? 'voice-btn-active-orange font-bold'
                              : 'text-white/75 hover:text-white bg-white/5 border-transparent hover:bg-white/10'
                          }`}
                        >
                          🤖 OVERLORD
                        </button>
                        <button
                          onClick={() => {
                            setRoastVoiceProfile('hype');
                            localStorage.setItem('noseroast_voice_profile', 'hype');
                          }}
                          className={`py-1.5 px-0.5 rounded-xl text-[10px] font-game transition-all duration-300 border ${
                            roastVoiceProfile === 'hype'
                              ? 'voice-btn-active-purple font-bold'
                              : 'text-white/75 hover:text-white bg-white/5 border-transparent hover:bg-white/10'
                          }`}
                        >
                          🔥 HYPE MAN
                        </button>
                        <button
                          onClick={() => {
                            setRoastVoiceProfile('deadpan');
                            localStorage.setItem('noseroast_voice_profile', 'deadpan');
                          }}
                          className={`py-1.5 px-0.5 rounded-xl text-[10px] font-game transition-all duration-300 border ${
                            roastVoiceProfile === 'deadpan'
                              ? 'voice-btn-active-emerald font-bold'
                              : 'text-white/75 hover:text-white bg-white/5 border-transparent hover:bg-white/10'
                          }`}
                        >
                          🎙️ DEADPAN
                        </button>
                      </div>
                    </div>

                    {/* Launch Play Trigger */}
                    <button
                      onClick={() => startCountdownFlow()}
                      disabled={!username.trim()}
                      className="w-full py-2.5 sm:py-3.5 bg-gradient-to-r from-orange-500 via-red-500 to-indigo-600 rounded-full font-game text-[11px] sm:text-xs font-black tracking-widest text-white shadow-xl shadow-red-500/25 hover:shadow-red-500/40 focus:outline-none flex items-center justify-center gap-2 hover:scale-[1.03] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Play size={12} fill="currentColor" /> START SOLO GAME
                    </button>
                  </div>

                  {/* Personal Best Highscore Indicator */}
                  {highScore > 0 && (
                    <div className="mt-3 px-4 py-1.5 bg-slate-950/70 border border-white/5 rounded-full flex items-center gap-1.5 shadow-md">
                      <span className="text-[9px] font-game text-amber-400">🏆 PERSONAL BEST</span>
                      <span className="font-game text-[11px] font-black text-white">{highScore}</span>
                    </div>
                  )}

                  {/* Privacy Policy Link */}
                  <button
                    onClick={() => setShowPrivacy(true)}
                    className="mt-4 text-[9px] text-white/40 font-game tracking-widest hover:text-white/60 transition-colors"
                  >
                    PRIVACY POLICY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* COUNTDOWN OVERLAY */}
          {gameState === 'COUNTDOWN' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm select-none">
              <div className="w-32 h-32 rounded-full border-4 border-orange-500/30 flex items-center justify-center relative animate-pulse-fast">
                <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <span className="text-6xl font-game font-black text-orange-500 animate-ping-once">{gameCountdown}</span>
              </div>
              <p className="mt-6 text-white font-game text-xs tracking-[0.4em] uppercase animate-pulse">Position Your Nose in Center!</p>
            </div>
          )}

          {/* AD INTERSTITIAL TRANSITION SCREEN */}
          {gameState === 'AD_INTERSTITIAL' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md select-none">
              <div className="animate-spin text-orange-500 mb-6">
                <Loader2 size={48} />
              </div>
              <h2 className="text-xl font-game font-black text-white mb-2 animate-pulse">GENERATING SAVAGE JUDGMENT...</h2>
              <p className="text-white/60 text-[10px] font-game uppercase tracking-[0.3em]">AI is cooking your roast in {adCountdown}s</p>
            </div>
          )}

          {/* GAMEOVER SCREEN */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 overflow-y-auto">
              <div className="w-full max-w-sm flex flex-col items-center my-auto">
                
                {/* Roast scorecard card */}
                <div ref={cardRef} className="w-full mb-6">
                  <RoastCard score={score} highScore={highScore} roast={commentary} username={username} ref={cardRef} />
                </div>

                {/* Score Summary Panels */}
                <div className="grid grid-cols-2 gap-3 w-full mb-6">
                  <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-3 text-center">
                    <p className="text-white/40 text-[9px] font-game uppercase tracking-widest mb-0.5">FINAL SCORE</p>
                    <p className="text-2xl font-game font-black text-white">{score}</p>
                  </div>
                  <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-3 text-center">
                    <p className="text-white/40 text-[9px] font-game uppercase tracking-widest mb-0.5">HIGH SCORE</p>
                    <p className="text-2xl font-game font-black text-gradient-orange">{highScore}</p>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => startCountdownFlow()}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-full font-game text-xs font-black tracking-widest text-white shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <RefreshCw size={14} /> PLAY AGAIN
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={shareRoast}
                      disabled={isSharing}
                      className="py-3 bg-slate-800 hover:bg-slate-700/80 rounded-full font-game text-[10px] font-black tracking-widest text-white border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Share2 size={12} /> {isSharing ? 'SHARING...' : 'SHARE CARD'}
                    </button>
                    <button
                      onClick={() => setGameState('START')}
                      className="py-3 bg-slate-900 hover:bg-slate-850 rounded-full font-game text-[10px] font-black tracking-widest text-white/70 border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      🚪 LOBBY MENU
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY POLICY MODAL */}
          {showPrivacy && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col z-[100] p-6 text-left select-text">
              <div className="w-full max-w-md mx-auto flex flex-col h-full">
                <div className="flex justify-between items-center py-4 border-b border-white/10 flex-shrink-0">
                  <h2 className="text-lg font-game font-black text-gradient-orange">PRIVACY POLICY</h2>
                  <button
                    onClick={() => setShowPrivacy(false)}
                    className="text-white/60 hover:text-white font-game text-xs px-3 py-1 bg-white/5 rounded-full"
                  >
                    CLOSE
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-4 pr-1 text-xs leading-relaxed text-white/75 space-y-4 font-inter">
                  <p className="font-extrabold text-white text-[11px] font-game">NOSE ROAST GAME PRIVACY STATEMENT</p>
                  <p>At Nose Roast, we respect your privacy. This game uses local camera access to analyze facial movements (such as nose placement) dynamically to control the bird character.</p>
                  
                  <p className="font-extrabold text-white text-[11px] font-game">📷 1. FACE DATA PROCESSING</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>No Storage:</strong> Face data (including coordinate locations) is processed exclusively in real-time, directly on your physical device.</li>
                    <li><strong>No Transmission:</strong> Face data is NEVER stored, cached, or transmitted to external servers.</li>
                    <li><strong>Neural Network:</strong> Face landmarks are processed via Google's MediaPipe WebAssembly library, running fully locally within your local web container.</li>
                  </ul>

                  <p className="font-extrabold text-white text-[11px] font-game">🔒 2. SECURITY</p>
                  <p>Since all data remains strictly on your local device, no personal details or camera coordinates are at risk of data breaches. Nose Roast is completely safe and private.</p>
                </div>
              </div>
            </div>
          )}

          {/* PERMISSION/CAMERA ERROR SCREEN */}
          {showPermissionError && (
            <div className="absolute inset-0 bg-slate-950 z-[99] flex flex-col items-center justify-center p-6 text-center select-text">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center text-red-500 mb-6 animate-pulse">
                <CameraOff size={32} />
              </div>
              <h2 className="text-xl font-game font-black text-white mb-2">CAMERA ACCESS REQUIRED!</h2>
              <p className="text-white/60 text-xs max-w-xs leading-relaxed mb-6 font-inter">
                Nose Roast requires camera access to play. Head tilt and nose coordinates are analyzed in real-time on your device to fly the bird.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full font-game text-xs font-black tracking-widest text-white shadow-lg active:scale-95 transition-all"
              >
                🔄 RELOAD & RETRY
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
