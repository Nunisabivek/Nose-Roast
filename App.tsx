
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PipeData } from './types';
import { GAME_CONFIG, INITIAL_BIRD_Y, DIFFICULTY_MAX_SPEED, DIFFICULTY_MIN_GAP, DIFFICULTY_RAMP_SECONDS } from './constants';
import Bird from './components/Bird';
import Pipe from './components/Pipe';
import { Camera, RefreshCw, Skull, Play, Loader2, Zap, AlertCircle, Sparkles, TrendingUp, ShieldCheck, Flame, CameraOff, XCircle } from 'lucide-react';

const PRE_INSTALLED_ROASTS = [
  "Your nose moves like a drunk pigeon.",
  "Is that your face or did you sit on a beehive?",
  "Gravity: 1. Your Ego: 0.",
  "Are you even trying or is this a performance art piece about failure?",
  "Stick to your day job. Unless it's flying. Then please stop.",
  "A potato could track better than you.",
  "Your reflexes are as fast as Internet Explorer.",
  "I've seen rocks with better aerodynamics.",
  "Error 404: Skill not found.",
  "Maybe try moving your head TOWARDS the gap next time?",
  "Your nose is officially a flight risk.",
  "That was... painful to watch.",
  "Gravity is your master now.",
  "Try moving your head, not just your eyes.",
  "My grandma tracks better than this.",
  "Is this a speedrun of failure?",
  "You fly like a brick.",
  "A literal bird would be disappointed.",
  "I've seen better flying from a frozen chicken.",
  "Your flight path looks like a toddler's drawing.",
  "Was that a crash or a strategic landing on a pipe?"
];

const PRE_ROASTS_WAITING = [
  "Analyzing your pathetic flight path...",
  "Recalibrating failure sensors...",
  "Checking for pilot brain cells... none found.",
  "Preparing the scoreboard of shame...",
  "Consulting gravity on why you fell...",
  "Converting embarrassment to digital disappointment...",
];

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastPipeTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const birdYRef = useRef<number>(INITIAL_BIRD_Y);
  const pipesRef = useRef<PipeData[]>([]);
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

  const resetGame = useCallback(() => {
    setScore(0);
    setBirdY(INITIAL_BIRD_Y);
    birdYRef.current = INITIAL_BIRD_Y;
    setRotation(0);
    setPipes([]);
    pipesRef.current = [];
    lastPipeTimeRef.current = Date.now();
    gameStartTimeRef.current = Date.now();
    setCommentary('');
    speedRef.current = GAME_CONFIG.pipeSpeed;
    gapRef.current = GAME_CONFIG.pipeGap;
    setCurrentSpeed(GAME_CONFIG.pipeSpeed);
    setCurrentGap(GAME_CONFIG.pipeGap);
    setAdCountdown(3);
  }, []);

  const startCameraAndGame = async () => {
    if (!videoRef.current) return;
    setShowPermissionError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, frameRate: 60 } 
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      resetGame();
      setGameState('PLAYING');
    } catch (err) {
      setShowPermissionError(true);
    }
  };

  const handleGameOver = useCallback((reason: string) => {
    setGameState('AD_INTERSTITIAL');
    setPreRoastText(PRE_ROASTS_WAITING[Math.floor(Math.random() * PRE_ROASTS_WAITING.length)]);
    
    // Pick a local roast instead of calling Gemini API
    const localRoast = PRE_INSTALLED_ROASTS[Math.floor(Math.random() * PRE_INSTALLED_ROASTS.length)];

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

  const handleRetry = useCallback(() => {
    resetGame();
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
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const faceY = results.faceLandmarks[0][4].y; 
        const normalizedY = (faceY - 0.2) / 0.6;
        const targetY = normalizedY * GAME_CONFIG.height;
        const clampedY = Math.max(0, Math.min(GAME_CONFIG.height - GAME_CONFIG.birdHeight, targetY));
        const newY = birdYRef.current + (clampedY - birdYRef.current) * 0.22;
        setRotation((newY - birdYRef.current) * 6);
        birdYRef.current = newY;
        setBirdY(newY);
      }
    }

    const now = Date.now();
    const spawnInterval = Math.max(750, 1800 - (speedRef.current * 100));
    if (now - lastPipeTimeRef.current > spawnInterval) {
      const padding = 60;
      const topHeight = Math.random() * (GAME_CONFIG.height - gapRef.current - (padding * 2)) + padding;
      pipesRef.current.push({
        id: now,
        x: GAME_CONFIG.width,
        topHeight,
        gap: gapRef.current,
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
    <div className="flex items-center justify-center w-screen h-screen bg-slate-950 p-0 sm:p-4 font-inter">
      <div 
        className="relative overflow-hidden bg-slate-900 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-none sm:rounded-[3.5rem] border-0 sm:border-[16px] border-slate-950"
        style={{ width: GAME_CONFIG.width, height: GAME_CONFIG.height }}
      >
        {/* NEURAL BACKGROUND FEED */}
        <div className="absolute inset-0 z-0">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute inset-0 bg-red-500/10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
          <div className="scanline" />
        </div>

        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-10 inset-x-0 flex flex-col items-center z-30 pointer-events-none">
            <div className={`transition-all duration-300 ${speedRef.current > 7 ? 'scale-125' : 'scale-100'}`}>
              <div className="bg-slate-950/70 px-12 py-3 rounded-[2rem] border-2 border-white/10 backdrop-blur-2xl shadow-2xl">
                <span className="text-7xl font-game text-white drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">
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

        {/* START SCREEN */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center z-50 p-10 text-center">
            <div className="relative mb-10">
              <div className="w-44 h-44 bg-gradient-to-tr from-orange-600 via-red-500 to-yellow-400 rounded-[3rem] p-4 shadow-[0_30px_60px_rgba(0,0,0,0.6)] border-4 border-white/20 flex items-center justify-center">
                 <div className="absolute -top-4 -left-4 bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-white shadow-xl animate-bounce">VIRAL</div>
                 <Bird y={15} rotation={-15} />
              </div>
            </div>
            <h1 className="text-6xl font-game text-white tracking-tighter leading-[0.85] mb-4">
              NOSE<br/><span className="text-orange-500">ROAST</span>
            </h1>
            <p className="text-white/40 font-bold tracking-[0.4em] text-[9px] uppercase mb-10 text-center">Face-Flight & Neural Roasts</p>
            
            <button 
              onClick={startCameraAndGame}
              className="group relative bg-orange-600 hover:bg-orange-500 text-white px-14 py-6 rounded-[2.5rem] text-3xl font-game transition-all transform hover:scale-105 active:scale-95 shadow-[0_12px_0_rgb(154,52,18)] active:shadow-none translate-y-[-12px] active:translate-y-0"
            >
              <Play fill="currentColor" size={32} className="inline mr-2" /> START GAME
            </button>
            <div className="mt-12 flex items-center gap-2 text-white/30 text-[10px] uppercase font-black tracking-widest">
              <ShieldCheck size={16} /> Privacy-First Neural Tracking
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
                        <div className="h-full bg-orange-500 animate-[loading_3s_linear_infinite]" style={{width: '60%'}} />
                      </div>
                   </div>
                </div>
             </div>
             <p className="mt-10 text-white/20 text-[8px] font-black uppercase tracking-[0.6em] animate-pulse">Scanning for skill... none found.</p>
          </div>
        )}

        {/* GAMEOVER SCREEN */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-3xl flex flex-col items-center justify-center z-[70] p-10 text-center text-white">
            <div className="bg-white/10 p-6 rounded-full mb-6 border border-white/20 shadow-2xl"><Skull size={64} className="text-orange-500" /></div>
            <h2 className="text-5xl font-game mb-8 tracking-tighter">ROASTED!</h2>
            
            <div className="flex gap-4 w-full max-w-sm mb-8">
               <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] uppercase text-white/40 font-black mb-1 tracking-widest">Points</p>
                  <p className="text-5xl font-game text-yellow-400">{score}</p>
               </div>
               <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] uppercase text-white/40 font-black mb-1 tracking-widest">Best</p>
                  <p className="text-5xl font-game text-emerald-400">{highScore}</p>
               </div>
            </div>

            <div className="w-full bg-slate-950/60 p-6 rounded-[2rem] mb-10 relative border border-white/10 shadow-2xl">
               <div className="absolute -top-3 left-8 bg-orange-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase shadow-lg">Final Judgment</div>
               <p className="text-xl leading-relaxed italic text-white/90">"{commentary}"</p>
            </div>

            <button 
              onClick={handleRetry}
              className="group flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 px-14 py-7 rounded-[2.5rem] text-3xl font-game transition-all transform hover:scale-105 active:scale-95 shadow-[0_12px_0_rgb(5,150,105)] active:shadow-none translate-y-[-12px] active:translate-y-0"
            >
              <RefreshCw size={32} /> RE-FLAP
            </button>
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
