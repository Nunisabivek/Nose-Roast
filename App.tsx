
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PipeData } from './types';
import { GAME_CONFIG, INITIAL_BIRD_Y, DIFFICULTY_MAX_SPEED, DIFFICULTY_MIN_GAP, DIFFICULTY_RAMP_SECONDS } from './constants';
import Bird from './components/Bird';
import Pipe from './components/Pipe';
import AdBlockDetector from './components/AdBlockDetector';
import { Camera, RefreshCw, Skull, Play, Loader2, Zap, AlertCircle, Sparkles, TrendingUp, ShieldCheck, Flame, CameraOff, XCircle, Smartphone, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import RoastCard from './components/RoastCard';
import { AdMobService } from './services/admob';

// Playful roasts organized by score ranges - psychological engagement
const ROASTS_BEGINNER = [ // Score 0-2
  "First try? Everyone starts somewhere! 🐣",
  "That was just the warm-up, right? RIGHT?",
  "Rome wasn't built in a day. Neither was your skill.",
  "Hey, at least you're consistent... consistently trying!",
  "Plot twist: the pipes moved. Definitely not your fault.",
  "Your nose has potential. Let's unlock it!",
  "Even eagles crash sometimes. You're basically an eagle.",
  "Speed bump on the road to greatness!",
];

const ROASTS_LEARNING = [ // Score 3-7
  "Ooh, you're getting the hang of it! Almost...",
  "So close! The pipes are scared of you now.",
  "That was actually impressive. For a beginner.",
  "Your nose is evolving! Keep going!",
  "I've seen worse. I've also seen better. Try again?",
  "Progress detected! Your face-flying skills are loading...",
  "You're in the top 80% of players! (We made that up, but still!)",
  "The Force is awakening in your nose...",
];

const ROASTS_DECENT = [ // Score 8-15
  "Now we're talking! You've got moves!",
  "Impressive focus! Your nose is a certified pilot.",
  "Double digits incoming! Can you feel it?",
  "You're making this look easy. Suspiciously easy...",
  "The student is becoming the master! 🎓",
  "Alert: Natural talent detected. Continue mission.",
  "Your friends could never. Go prove it.",
  "That score deserves a screenshot. Just saying.",
];

const ROASTS_PRO = [ // Score 16+
  "Legend status: UNLOCKED 👑",
  "Okay, are you cheating? That was insane!",
  "Your nose should be in the Olympics.",
  "I bow to the Face-Flight Champion!",
  "Share this. Your friends need to know.",
  "You've officially broken the game. Congrats!",
  "NASA called. They want your nose for navigation.",
  "This score is going viral. Screenshot NOW!",
];

// Fun loading messages
const PRE_ROASTS_WAITING = [
  "Calculating your awesomeness...",
  "Consulting the roast oracle...",
  "Measuring nose aerodynamics...",
  "Computing your comeback story...",
  "Preparing personalized motivation...",
  "Summoning the judgment spirits...",
];

// Helper function to get roast based on score
const getRoastForScore = (score: number): string => {
  let roastPool: string[];
  if (score <= 2) {
    roastPool = ROASTS_BEGINNER;
  } else if (score <= 7) {
    roastPool = ROASTS_LEARNING;
  } else if (score <= 15) {
    roastPool = ROASTS_DECENT;
  } else {
    roastPool = ROASTS_PRO;
  }
  return roastPool[Math.floor(Math.random() * roastPool.length)];
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('LOADING');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [birdY, setBirdY] = useState(INITIAL_BIRD_Y);
  const [rotation, setRotation] = useState(0);
  const [pipes, setPipes] = useState<PipeData[]>([]);
  const [commentary, setCommentary] = useState<string>('');
  const [currentSpeed, setCurrentSpeed] = useState(GAME_CONFIG.pipeSpeed);
  const [currentGap, setCurrentGap] = useState(GAME_CONFIG.pipeGap);
  const [preRoastText, setPreRoastText] = useState('');
  const [adCountdown, setAdCountdown] = useState(3);
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [scale, setScale] = useState(1);
  const [username, setUsername] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);

  const [isSharing, setIsSharing] = useState(false);

  // Initialize AdMob
  useEffect(() => {
    const initAds = async () => {
      await AdMobService.initialize();
      // Show banner on startup (Menu)
      await AdMobService.showBanner();
    };
    initAds();
  }, []);

  // Load username from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('noseroast_username');
    if (savedName) {
      setUsername(savedName);
    }
  }, []);

  // Save username to localStorage when it changes
  const handleUsernameChange = (name: string) => {
    setUsername(name);
    localStorage.setItem('noseroast_username', name);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const shareRoast = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2
      });
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `roast_${Date.now()}.png`;

      // Save to filesystem first
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: dataUrl,
        directory: Directory.Cache
      });

      // Share via capacitor share
      await Share.share({
        title: 'Nose Roast Judgment',
        text: `Score: ${score}. Roast: "${commentary}" #NoseRoast`,
        url: savedFile.uri,
        dialogTitle: 'Share your Roast'
      });

    } catch (error) {
      console.error('Sharing failed', error);
      // Fallback: Share text only
      await Share.share({
        title: 'Nose Roast Judgment',
        text: `I scored ${score} in Nose Roast! My verdict: "${commentary}" Download: https://play.google.com/store/apps/details?id=com.noseroast.game`,
        dialogTitle: 'Share your Roast'
      });
    } finally {
      setIsSharing(false);
    }
  };
  const requestRef = useRef<number>(0);
  const lastPipeTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const birdYRef = useRef<number>(INITIAL_BIRD_Y);
  const pipesRef = useRef<PipeData[]>([]);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastProcessTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(GAME_CONFIG.pipeSpeed);
  const gapRef = useRef<number>(GAME_CONFIG.pipeGap);

  useEffect(() => {
    const initTracking = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        landmarkerRef.current = faceLandmarker;
        setGameState('START');
      } catch (error) {
        console.error("AI Initialization Failed:", error);
      }
    };
    initTracking();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scaleX = w / GAME_CONFIG.width;
      const scaleY = h / GAME_CONFIG.height;
      // Allow slight overflow for immersive feel on phones, or contain strictly?
      // Strict containment is safer for gameplay visibility.
      const newScale = Math.min(scaleX, scaleY, 1.5);
      setScale(newScale * 0.95);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setBirdY(INITIAL_BIRD_Y);
    birdYRef.current = INITIAL_BIRD_Y;
    setRotation(0);

    // Spawn initial pipe with guaranteed safe opening at center
    const initialGap = GAME_CONFIG.pipeGap;
    const safeTopHeight = (GAME_CONFIG.height - initialGap) / 2; // Center gap
    const initialPipe: PipeData = {
      id: Date.now(),
      x: GAME_CONFIG.width + 100, // Spawn slightly off-screen for smooth entry
      topHeight: safeTopHeight,
      gap: initialGap,
      passed: false
    };

    setPipes([initialPipe]);
    pipesRef.current = [initialPipe];
    lastPipeTimeRef.current = Date.now();
    gameStartTimeRef.current = Date.now();
    setCommentary('');
    speedRef.current = GAME_CONFIG.pipeSpeed;
    gapRef.current = GAME_CONFIG.pipeGap;
    setCurrentSpeed(GAME_CONFIG.pipeSpeed);
    setCurrentGap(GAME_CONFIG.pipeGap);
    setAdCountdown(3);

    // Hide banner when starting game
    AdMobService.hideBanner();
  }, []);

  const startCameraAndGame = async () => {
    if (!videoRef.current) return;
    setShowPermissionError(false);
    try {
      // Low resolution for better performance on low-end devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320, max: 480 },
          height: { ideal: 240, max: 360 },
          frameRate: { ideal: 24, max: 30 }, // Lower FPS = less CPU usage
          facingMode: 'user'
        }
      });
      videoRef.current.srcObject = stream;

      // Fix for iOS/Android video autoplay policies
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };

      resetGame();
      setGameState('PLAYING');
    } catch (err) {
      setShowPermissionError(true);
    }
  };

  const handleGameOver = useCallback((reason: string) => {
    setGameState('AD_INTERSTITIAL');
    setPreRoastText(PRE_ROASTS_WAITING[Math.floor(Math.random() * PRE_ROASTS_WAITING.length)]);

    // Get score-appropriate roast for engagement
    const localRoast = getRoastForScore(score);

    let timer = 3;
    const interval = setInterval(() => {
      timer -= 1;
      setAdCountdown(timer);
      if (timer <= 0) {
        clearInterval(interval);
        setCommentary(localRoast);
        setGameState('GAMEOVER');
        setHighScore(prev => Math.max(prev, score));
      }
    }, 1000);
  }, [score]);

  const handleRetry = useCallback(async () => {
    // Show interstitial before replaying
    await AdMobService.showInterstitial();

    resetGame();
    // Ensure banner is hidden again
    AdMobService.hideBanner();
    setGameState('PLAYING');
  }, [resetGame]);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const elapsedSeconds = (Date.now() - gameStartTimeRef.current) / 1000;
    const progress = Math.min(1, elapsedSeconds / DIFFICULTY_RAMP_SECONDS);

    speedRef.current = GAME_CONFIG.pipeSpeed + (DIFFICULTY_MAX_SPEED - GAME_CONFIG.pipeSpeed) * progress;
    gapRef.current = GAME_CONFIG.pipeGap - (GAME_CONFIG.pipeGap - DIFFICULTY_MIN_GAP) * progress;

    setCurrentSpeed(speedRef.current);
    setCurrentGap(gapRef.current);

    if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
      // FPS OPTIMIZATION: Throttle AI to ~15FPS (66ms) for low-end mobile devices
      const now = performance.now();
      if (now - lastProcessTimeRef.current > 66) {
        lastProcessTimeRef.current = now;
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, now);
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const faceY = results.faceLandmarks[0][4].y;
            const normalizedY = (faceY - 0.2) / 0.6;
            const targetY = normalizedY * GAME_CONFIG.height;
            const clampedY = Math.max(0, Math.min(GAME_CONFIG.height - GAME_CONFIG.birdHeight, targetY));
            // Smoother interpolation for low FPS tracking
            const newY = birdYRef.current + (clampedY - birdYRef.current) * 0.5;
            setRotation((newY - birdYRef.current) * 5);
            birdYRef.current = newY;
            setBirdY(newY);
          }
        } catch (e) {
          // Silently handle detection errors to prevent crashes
        }
      }
    }

    const now = Date.now();
    // Slower spawn at start, faster as difficulty increases
    const spawnInterval = Math.max(1200, 2200 - (speedRef.current * 120));
    if (now - lastPipeTimeRef.current > spawnInterval) {
      // Ensure minimum gap of 150px at all times
      const gap = Math.max(150, gapRef.current);

      // Safe margins from top and bottom of screen
      const safeMargin = 80;
      const minTopHeight = safeMargin;
      const maxTopHeight = GAME_CONFIG.height - gap - safeMargin;

      let topHeight: number;

      // Check if valid range exists
      if (maxTopHeight <= minTopHeight) {
        // Screen too small or gap too big - center the gap
        topHeight = (GAME_CONFIG.height - gap) / 2;
      } else {
        // Random position within safe bounds
        topHeight = Math.floor(Math.random() * (maxTopHeight - minTopHeight)) + minTopHeight;
      }

      // Final safety clamp
      topHeight = Math.max(50, Math.min(topHeight, GAME_CONFIG.height - gap - 50));

      pipesRef.current.push({
        id: now,
        x: GAME_CONFIG.width,
        topHeight,
        gap,
        passed: false
      });
      lastPipeTimeRef.current = now;
    }

    const birdRect = {
      left: 50 + 12,
      right: 50 + GAME_CONFIG.birdWidth - 12,
      top: birdYRef.current + 8,
      bottom: birdYRef.current + GAME_CONFIG.birdHeight - 8
    };

    let passOccurred = 0;
    pipesRef.current = pipesRef.current
      .map(p => {
        const nextX = p.x - speedRef.current;
        if (!p.passed && nextX + GAME_CONFIG.pipeWidth < 50) {
          passOccurred++;
          return { ...p, x: nextX, passed: true };
        }
        return { ...p, x: nextX };
      })
      .filter(p => p.x > -GAME_CONFIG.pipeWidth);

    if (passOccurred > 0) setScore(s => s + passOccurred);

    for (const p of pipesRef.current) {
      if (birdRect.right > p.x && birdRect.left < p.x + GAME_CONFIG.pipeWidth) {
        if (birdRect.top < p.topHeight || birdRect.bottom > p.topHeight + p.gap) {
          handleGameOver("crashed");
          return;
        }
      }
    }

    if (birdYRef.current <= -40 || birdYRef.current >= GAME_CONFIG.height - GAME_CONFIG.birdHeight + 40) {
      handleGameOver("out of bounds");
      return;
    }

    setPipes([...pipesRef.current]);
    requestRef.current = requestAnimationFrame(update);
  }, [gameState, handleGameOver]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-slate-950 p-0 font-inter overflow-hidden">
      <AdBlockDetector />
      <div
        className="relative overflow-hidden bg-slate-900 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[2rem] sm:rounded-[3.5rem] border-[8px] sm:border-[16px] border-slate-950"
        style={{
          width: GAME_CONFIG.width,
          height: GAME_CONFIG.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        {/* NEURAL BACKGROUND FEED - Optimized for low-end devices */}
        <div className="absolute inset-0 z-0" style={{ willChange: 'auto' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="320"
            height="240"
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            style={{ willChange: 'auto', imageRendering: 'auto' }}
          />
          <div className="absolute inset-0 bg-red-500/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
        </div>

        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-10 inset-x-0 flex flex-col items-center z-30 pointer-events-none">
            <div className={`transition-all duration-300 ${speedRef.current > 7 ? 'scale-125' : 'scale-100'}`}>
              <div className="bg-slate-950/80 px-12 py-3 rounded-[2rem] border-2 border-white/10 shadow-lg">
                <span className="text-7xl font-game text-white drop-shadow-md">
                  {score}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 rounded-full border-2 border-slate-950 shadow-lg">
                <Flame size={12} fill="currentColor" className="text-white" />
                <span className="text-[10px] font-game text-white">HEAT {currentSpeed.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 rounded-full border-2 border-slate-950 shadow-lg">
                <TrendingUp size={12} className="text-white" />
                <span className="text-[10px] font-game text-white">LVL {Math.floor((currentSpeed - 3.2) / 0.5)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 w-full h-full">
          {pipes.map(pipe => <Pipe key={pipe.id} data={pipe} config={GAME_CONFIG} />)}
          <Bird y={birdY} rotation={rotation} />
          <div className="absolute bottom-14 w-full h-2 bg-white/5 backdrop-blur-sm z-20" />
        </div>

        {/* START SCREEN - Redesigned */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center z-50 p-6 text-center overflow-hidden">
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-20 left-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-40 right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-red-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Logo Section */}
            <div className="relative mb-6">
              <div className="w-36 h-36 bg-gradient-to-br from-orange-500 via-red-500 to-yellow-500 rounded-[2.5rem] p-1 shadow-2xl shadow-orange-500/30">
                <div className="w-full h-full bg-slate-900 rounded-[2.2rem] flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Nose Roast" className="w-[110%] h-[110%] object-contain" />
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg animate-bounce">
                🔥 VIRAL
              </div>
            </div>

            {/* Title */}
            <h1 className="text-5xl font-game text-white tracking-tight leading-none mb-2">
              NOSE<span className="text-orange-500">ROAST</span>
            </h1>
            <p className="text-white/50 text-xs font-medium tracking-wider mb-6">
              Fly with your face • Get roasted
            </p>

            {/* Username Input */}
            <div className="w-full max-w-xs mb-6">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2 font-medium">Your Name (for sharing)</p>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={15}
                  className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-white text-center text-sm font-medium placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                />
                {username && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">✓</div>
                )}
              </div>
            </div>

            {/* Play Button */}
            <button
              onClick={startCameraAndGame}
              className="group relative bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white px-12 py-5 rounded-full text-2xl font-game transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/30"
            >
              <div className="flex items-center gap-3">
                <Play fill="currentColor" size={28} />
                <span>PLAY NOW</span>
              </div>
            </button>

            {/* High Score Display */}
            {highScore > 0 && (
              <div className="mt-4 flex items-center gap-2 text-white/40 text-xs font-medium">
                <TrendingUp size={14} />
                <span>Best Score: <span className="text-yellow-400 font-bold">{highScore}</span></span>
              </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-6 flex items-center gap-2 text-white/20 text-[9px] font-medium">
              <ShieldCheck size={12} />
              <span>Camera used for face tracking only</span>
            </div>
          </div>
        )}

        {/* AD INTERSTITIAL */}
        {gameState === 'AD_INTERSTITIAL' && (
          <div className="absolute inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-full h-80 bg-slate-900 rounded-[3rem] border-4 border-white/5 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 bg-white/5 px-6 py-2 text-[10px] font-black text-white/30 tracking-widest uppercase">Sponsored Segment</div>
              <div className="relative">
                <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center font-game text-2xl text-white">
                  {adCountdown}
                </div>
              </div>
              <div className="text-center px-10">
                <p className="text-white/60 font-medium text-sm mb-4 leading-relaxed italic">"{preRoastText}"</p>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 animate-[loading_3s_linear_infinite]" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-10 text-white/20 text-[8px] font-black uppercase tracking-[0.6em] animate-pulse">Scanning for skill... none found.</p>
          </div>
        )}

        {/* GAMEOVER SCREEN - Redesigned */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-start z-[70] py-3 px-4 text-center text-white overflow-hidden">

            {/* Top Section - Title */}
            <div className="w-full mb-2">
              <h2 className="text-xl font-game mb-0.5 tracking-tight">
                {score >= highScore && score > 0 ? '🏆 NEW RECORD!' : 'GAME OVER'}
              </h2>
              <p className="text-white/50 text-[10px]">
                {score >= highScore && score > 0 ? 'You beat your best score!' : 'One more try? You got this!'}
              </p>
            </div>

            {/* Share Card - Smaller to fit */}
            <div className="flex-shrink-0 mb-2" style={{ transform: 'scale(0.65)', transformOrigin: 'top center', marginBottom: '-80px' }}>
              <RoastCard score={score} highScore={highScore} roast={commentary} username={username} ref={cardRef} />
            </div>

            {/* Buttons Section - Always visible at bottom */}
            <div className="w-full max-w-xs space-y-2 mt-auto pb-4">
              {/* PLAY AGAIN BUTTON */}
              <button
                onClick={handleRetry}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 py-3.5 px-6 rounded-full text-lg font-game transition-all transform active:scale-95 shadow-xl shadow-emerald-500/30"
              >
                <RefreshCw size={20} />
                <span>PLAY AGAIN</span>
              </button>

              {/* SHARE BUTTON */}
              <button
                onClick={shareRoast}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 py-3 px-6 rounded-full text-base font-game transition-all transform active:scale-95 shadow-xl shadow-indigo-500/30"
              >
                {isSharing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Share2 size={18} />
                    <span>SHARE ROAST</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* CAMERA PERMISSION POPUP */}
        {showPermissionError && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-8">
            <div className="w-full bg-red-950/20 border-2 border-red-500/50 p-8 rounded-[3rem] text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
              <div className="bg-red-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <CameraOff size={48} className="text-red-500" />
              </div>
              <h3 className="text-3xl font-game text-white mb-4">ACCESS DENIED</h3>
              <p className="text-red-200/60 text-sm leading-relaxed mb-8 px-4">
                NoseRoast AI uses your camera to track your nose for flight. Please click the <span className="text-red-400 font-bold underline">Camera Icon</span> in your address bar or app settings to allow access.
              </p>
              <button
                onClick={startCameraAndGame}
                className="bg-white text-slate-950 font-black uppercase tracking-widest py-5 px-10 rounded-full hover:scale-105 transition-transform"
              >
                Retry Access
              </button>
              <button
                onClick={() => setShowPermissionError(false)}
                className="block w-full mt-4 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {gameState === 'LOADING' && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100] text-white">
            <div className="relative">
              <div className="w-24 h-24 border-8 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-8" />
              <div className="absolute inset-0 flex items-center justify-center font-black text-orange-400 text-xs">OS</div>
            </div>
            <p className="text-[10px] font-game tracking-[0.5em] text-white/40 animate-pulse uppercase">Waking up Neural Sensors...</p>
          </div>
        )}

        {/* BOTTOM AD BANNER */}
        <div className="absolute bottom-0 inset-x-0 h-14 bg-slate-950 border-t border-white/5 flex items-center justify-center z-40">
          <div className="text-[9px] text-white/30 font-black uppercase tracking-[0.4em]">Ready for Play Store</div>
        </div>
      </div>
    </div>
  );
};

export default App;
