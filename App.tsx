
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PipeData } from './types';
import { GAME_CONFIG, INITIAL_BIRD_Y, DIFFICULTY_MAX_SPEED, DIFFICULTY_MIN_GAP, DIFFICULTY_RAMP_SECONDS } from './constants';
import Bird, { BirdHandle } from './components/Bird';
import Pipe, { PipeHandle } from './components/Pipe';
import AdBlockDetector from './components/AdBlockDetector';
import { RefreshCw, Play, Loader2, TrendingUp, ShieldCheck, Flame, CameraOff, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import RoastCard from './components/RoastCard';
import { AdMobService } from './services/admob';
import { AudioManager } from './services/AudioManager';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';


// Pool size for pipes (recycled for performance)
const PIPE_POOL_SIZE = 15;

// 🔥 ABSOLUTELY SAVAGE ROASTS - No mercy, maximum emotional damage
const ROASTS_BEGINNER = [ // Score 0-2 - Complete devastation
  "Your nose has the reaction time of a Windows Vista laptop. 💀",
  "Bro played like their WiFi was connected to a microwave. Tragic.",
  "That wasn't gaming, that was a confession of your life choices.",
  "Even a brick with googly eyes would've scored higher. I'm not joking.",
  "Your face said 'I got this' but your score said 'no you don't.' 😭",
  "The pipes took one look at you and went 'free kill.' Embarrassing.",
  "This score belongs in a museum of human failure. Historic L.",
  "You just speedran disappointment. New world record? 🏆",
  "Somewhere, a pigeon is laughing at you. And it's right.",
  "This isn't a skill issue, this is a YOU issue. Seek help.",
  "The tutorial enemies from 2002 games would body you.",
  "Your gameplay just got submitted as evidence of why AI is needed.",
  "That was giving 'first day with a face' energy. Rough.",
  "The game's report button is filing a complaint against YOUR skills.",
  "Bro thought this was a participation trophy generator. 💀",
  "Your reflexes are sponsored by Internet Explorer.",
  "I've seen better coordination from a broken ceiling fan.",
  "The 'Play Again' button is scared of you at this point.",
  "You played like your nose is allergic to survival.",
  "This score is so bad it needs therapy. And so do you.",
  "Your performance just got used as a horror story for other players.",
  "The pipes didn't even try. They felt bad making it too easy.",
  "Delete the app and pretend this never happened. Please.",
  "Your nose moves like it's paying rent by the hour.",
  "Congrats! You've unlocked the 'Why Did I Try' achievement. 🏅",
  "Your face control is giving 'never touched a game before' vibes.",
  "This performance is what happens when talent takes a day off. Forever.",
  "You're the reason games have 'Are you sure?' confirmation buttons.",
  "Your nose just filed for unemployment. It's done with you.",
  "The game AI is writing an apology letter for being too hard. Kidding.",
  "You make NPCs look like esports champions. That's impressive.",
  "Your score screams 'I peaked at birth' and it's showing.",
  "This gameplay belongs on a blooper reel. A really long one.",
];

const ROASTS_LEARNING = [ // Score 3-7 - Still cooked but showing promise
  "Okay you're not completely hopeless. Just... mostly. 📈",
  "Your nose is buffering. Please hold while talent loads...",
  "This is giving 'main character allergic to success' vibes.",
  "You're mid, but at least you're consistently mid. That's something?",
  "The pipes are starting to wonder if you have a medical condition.",
  "Loading potential.exe... File corrupted. Retrying.",
  "You're like a participation trophy — present, but not winning.",
  "This score says 'I peaked in elementary school' and it's showing.",
  "Your ancestors didn't survive evolution for THIS. Disappointing.",
  "You're the reason games have 'Easy Mode.' No shade. All shade.",
  "Somewhere, your future self just facepalmed. And they're right.",
  "You're not terrible. You're just aggressively not great.",
  "This is giving 'practice makes... slightly less embarrassing.'",
  "Your nose has potential. Your execution has... issues.",
  "You're the warm-up act for the real players. Keep trying, opener.",
  "The pipes are confused. 'Is this person TRYING or not?'",
  "Your gameplay is like a plot twist nobody asked for.",
  "You're the human equivalent of 'loading please wait...'",
  "This score screams 'I'll get revenge' but we both know you won't.",
  "You're giving beta tester energy. Bugs included.",
  "The leaderboard just filed a restraining order against you.",
  "Skill? Never heard of her. And neither has your nose.",
  "You're the reason 'try again' buttons exist.",
  "Solid C- energy. Your parents would be... not surprised.",
  "The pipes are placing bets on how fast you'll crash next.",
  "You're improving! From 'disaster' to 'mild catastrophe.' Progress!",
  "Your face is trying. Your score? Not convinced yet.",
  "This is the gaming equivalent of 'fake it till you make it.'",
  "You're on the struggle bus and it's stuck in traffic.",
  "The game is lowkey rooting for you. But also laughing.",
  "Your nose said 'maybe today' and the pipes said 'absolutely not.'",
  "You're giving 'I watched one tutorial' energy. Watch another.",
  "This score is the definition of 'almost but not quite.'",
];

const ROASTS_DECENT = [ // Score 8-15 - Actually cooking now
  "WAIT WAIT WAIT — okay you might actually have neurons! 🔥",
  "Your nose just went from NPC to side character. Character arc!",
  "This is giving 'future TikTok flex material.' Screenshot it.",
  "The pipes are starting to sweat. They see the threat.",
  "Your face just graduated from 'hopeless' to 'mildly concerning.'",
  "Double digits?! We didn't know you had it in you. We still don't.",
  "This score is lowkey the glow-up arc we needed. 📈",
  "Your friends WISH they had this nose coordination. Probably.",
  "You're not a pro, but you're not a disaster either. Growth!",
  "The algorithm is starting to notice you. Fame incoming?",
  "This is giving 'protagonist with one working brain cell' energy.",
  "You just proved the haters wrong. And by haters, we mean us.",
  "Certified nose pilot. License pending but you're getting there.",
  "This score is screenshot worthy. Your crush needs to see this.",
  "You're officially better than 60% of our players. That's... something.",
  "Your nose is giving 'hidden talent show audition' energy.",
  "The pipes are calling reinforcements. You scared them.",
  "This is the redemption arc the writers planned. Keep going.",
  "You're evolving. Slowly. Like really slowly. But still.",
  "The game's difficulty is sweating. It didn't prepare for THIS.",
  "Your face just entered the Top 40%. Charts are updating.",
  "This score is giving 'tell your mom' material. She might care.",
  "You're not viral YET. But the potential? *chef's kiss*",
  "The pipes are writing incident reports about your improvement.",
  "You've graduated from 'joke' to 'mild threat.' Congrats! 🎓",
  "Your nose just unlocked 'actually decent' status. Rare achievement!",
  "This is giving 'I've been practicing in secret' energy. Respect.",
  "The game is reconsidering its difficulty settings because of YOU.",
  "You're the plot twist nobody saw coming. Main character energy!",
  "Your face control went from 'questionable' to 'respectable.' Growth!",
  "This score deserves its own highlight reel. Make it happen.",
  "You're making the pipes nervous. They're updating their resumes.",
  "Your nose said 'watch this' and actually delivered. Shocking.",
];

const ROASTS_PRO = [ // Score 16+ - ABSOLUTE LEGEND STATUS
  "WHAT IN THE SUPERHUMAN REFLEXES — NASA needs your nose. NOW. 🚀",
  "You didn't play the game. You VIOLATED its entire existence. 👑",
  "Those pipes are filing a restraining order against your face. 💀",
  "This score is so illegal it got flagged by multiple governments.",
  "Your ancestors are crying tears of pride in the afterlife. All of them.",
  "SHARE THIS OR YOU'RE A COWARD. The world needs to witness greatness.",
  "You broke the game. The developers are having an emergency meeting.",
  "This is WORLD RECORD behavior. Screenshot or it didn't happen. 🏆",
  "Your nose has achieved enlightenment. Dalai Lama is jealous.",
  "This is going VIRAL. Tag everyone. Assert dominance.",
  "You're either a god or a cheater. Either way, we're impressed.",
  "The pipes just retired. They said 'we can't compete with this.'",
  "Your face has more talent than 99% of humanity. Scientific fact.",
  "This performance just got added to the Library of Congress.",
  "You're not human. You're a PHENOMENON. 🔥👑🔥",
  "Scientists want to study your nose. For research. Definitely.",
  "This score just crashed our servers. Worth it.",
  "You're giving 'main character who actually wins' energy.",
  "The difficulty settings just filed for unemployment.",
  "Your nose has its own Wikipedia page now. It's trending.",
  "This is proof that face gaming is a SPORT. Olympic committee incoming.",
  "The pipes are applying for witness protection. They've seen too much.",
  "Your performance is being used to train the next generation.",
  "LEGENDARY doesn't cover this. We need new vocabulary.",
  "The game is considering giving YOU a trophy. Revolutionary.",
  "Your face just became the final boss. Congratulations.",
  "This score is being studied by quantum physicists. It defies logic.",
  "You're the reason difficulty modes exist. To protect others from you.",
  "Your nose control is giving 'built different' energy. Literally.",
  "The pipes are holding a memorial service. You ended their careers.",
  "This gameplay belongs in a museum. Under 'Perfection.'",
  "You just made history. The leaderboard is bowing down.",
  "Your face is a weapon of mass destruction. Register it immediately.",
  "This score is so good it should be illegal. But it's not. Yet.",
];

const PRE_ROASTS_WAITING = [
  "Measuring your disappointment levels...",
  "Consulting the roast council of elders...",
  "Calculating your emotional damage...",
  "Scanning for traces of talent... searching...",
  "Brewing maximum savagery with extra spite...",
  "Loading your personalized destruction...",
  "Asking the pipes for their honest opinion...",
  "Your face is being judged by 47 algorithms...",
  "Generating the perfect insult just for you...",
  "The roast machine is warming up...",
  "Cross-referencing your failures with historical data...",
  "AI is analyzing exactly where you went wrong...",
];

// 💥 INSTANT CRASH ROASTS - Shown immediately when player crashes
const CRASH_ROASTS = [
  "BONK! 💥 Your face just met its match.",
  "Ouch! That pipe didn't even see you as a threat.",
  "WASTED. Your nose coordination just left the chat.",
  "Crash landing! Your pilot license has been revoked.",
  "That pipe said 'not today' and you listened.",
  "GAME OVER. Your face forgot how to face.",
  "Destroyed. The pipe didn't even flinch.",
  "Your nose just rage quit before you did.",
  "Critical failure! Your reflexes filed for bankruptcy.",
  "That wasn't a crash, that was a surrender.",
  "The pipe won. Your dignity lost. Classic.",
  "Your face control just uninstalled itself.",
  "Eliminated. The pipe is celebrating right now.",
  "That pipe is telling its friends about you.",
  "Your nose just became a cautionary tale.",
  "Mission failed. Your face will get 'em next time. Maybe.",
  "The pipe didn't move. You still hit it. Impressive.",
  "Your coordination just called in sick. Permanently.",
  "That crash was personal. The pipe wanted this.",
  "Game over! Your nose is filing a complaint against you.",
];

const getRoastForScore = (score: number): string => {
  let roastPool: string[];
  if (score <= 2) roastPool = ROASTS_BEGINNER;
  else if (score <= 7) roastPool = ROASTS_LEARNING;
  else if (score <= 15) roastPool = ROASTS_DECENT;
  else roastPool = ROASTS_PRO;
  return roastPool[Math.floor(Math.random() * roastPool.length)];
};

const getCrashRoast = (): string => {
  return CRASH_ROASTS[Math.floor(Math.random() * CRASH_ROASTS.length)];
};

// Internal pipe state for the game loop (mutable, not React state)
interface InternalPipeState {
  id: number;
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
  poolIndex: number;
  // Moving pipe properties
  isMoving: boolean;
  moveDirection: 1 | -1; // 1 = down, -1 = up
  moveSpeed: number;
  baseTopHeight: number; // Original position for oscillation limits
  moveRange: number; // How far it can move from base position
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('LOADING');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [commentary, setCommentary] = useState<string>('');
  const [currentSpeed, setCurrentSpeed] = useState(GAME_CONFIG.pipeSpeed);
  const [preRoastText, setPreRoastText] = useState('');
  const [adCountdown, setAdCountdown] = useState(3);
  const [gameCountdown, setGameCountdown] = useState(3); // 3-2-1 countdown before game
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [gameDimensions, setGameDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : GAME_CONFIG.width,
    height: typeof window !== 'undefined' ? window.innerHeight : GAME_CONFIG.height
  });
  const [username, setUsername] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);

  // Refs for direct DOM manipulation
  const birdRef = useRef<BirdHandle>(null);
  const pipeRefs = useRef<(PipeHandle | null)[]>(Array(PIPE_POOL_SIZE).fill(null));
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const scoreDisplayRef = useRef<HTMLSpanElement>(null);

  // Mutable game state refs (not triggering re-renders)
  const requestRef = useRef<number>(0);
  const lastPipeTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const birdYRef = useRef<number>(INITIAL_BIRD_Y);
  const birdRotationRef = useRef<number>(0);
  const pipesRef = useRef<InternalPipeState[]>([]);
  const lastProcessTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(GAME_CONFIG.pipeSpeed);
  const gapRef = useRef<number>(GAME_CONFIG.pipeGap);
  const scoreRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>('LOADING');
  const gameDimensionsRef = useRef(gameDimensions);

  // Keep refs in sync with state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gameDimensionsRef.current = gameDimensions; }, [gameDimensions]);

  // Initialize AdMob
  useEffect(() => {
    const initAds = async () => {
      await AdMobService.initialize();
      await AdMobService.showBanner();
    };
    initAds();
  }, []);

  // Show banner ads on ALL screens including PLAYING for better monetization
  useEffect(() => {
    // Always show banner ads for maximum revenue
    AdMobService.showBanner();
  }, [gameState]);

  // Load username
  useEffect(() => {
    const savedName = localStorage.getItem('noseroast_username');
    if (savedName) setUsername(savedName);
  }, []);

  const handleUsernameChange = (name: string) => {
    setUsername(name);
    localStorage.setItem('noseroast_username', name);
  };

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

  // Initialize Face Tracking
  useEffect(() => {
    const initTracking = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
          outputFaceBlendshapes: false, // Disabled for performance
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5, // Lower confidence for faster detection
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        landmarkerRef.current = faceLandmarker;
        setGameState('START');
      } catch (error) {
        console.error("AI Initialization Failed:", error);
      }
    };
    initTracking();
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => setGameDimensions({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getNextPipePoolIndex = useCallback((): number => {
    const usedIndices = new Set(pipesRef.current.map(p => p.poolIndex));
    for (let i = 0; i < PIPE_POOL_SIZE; i++) {
      if (!usedIndices.has(i)) return i;
    }
    return -1; // No pool slot available
  }, []);

  const resetGame = useCallback(() => {
    // Reset score
    scoreRef.current = 0;
    setScore(0);

    // Reset score display immediately
    if (scoreDisplayRef.current) {
      scoreDisplayRef.current.textContent = '0';
    }

    // Reset bird position - IMPORTANT: set the ref first, then update visually
    birdYRef.current = INITIAL_BIRD_Y;
    birdRotationRef.current = 0;

    // Force immediate visual update of bird position
    requestAnimationFrame(() => {
      birdRef.current?.updatePosition(INITIAL_BIRD_Y, 0);
    });

    // Hide all pipes and clear the array
    pipeRefs.current.forEach(p => p?.setVisibility(false));
    pipesRef.current = [];

    // Spawn initial pipe off-screen to the right
    const dims = gameDimensionsRef.current;
    const safeTopHeight = (dims.height - GAME_CONFIG.pipeGap) / 2;
    const poolIndex = 0;
    const initialPipe: InternalPipeState = {
      id: Date.now(),
      x: dims.width + 100, // Start off-screen
      topHeight: safeTopHeight,
      gap: GAME_CONFIG.pipeGap,
      passed: false,
      poolIndex,
      // Initial pipe is never moving
      isMoving: false,
      moveDirection: 1,
      moveSpeed: 0,
      baseTopHeight: safeTopHeight,
      moveRange: 0,
    };
    pipesRef.current.push(initialPipe);
    const pipeHandle = pipeRefs.current[poolIndex];
    if (pipeHandle) {
      pipeHandle.configure(safeTopHeight, GAME_CONFIG.pipeGap, dims.height, GAME_CONFIG.pipeWidth);
      pipeHandle.updatePosition(dims.width + 100);
      pipeHandle.setVisibility(true);
    }

    // Reset timing and difficulty
    lastPipeTimeRef.current = Date.now();
    gameStartTimeRef.current = Date.now();
    setCommentary('');
    speedRef.current = GAME_CONFIG.pipeSpeed;
    gapRef.current = GAME_CONFIG.pipeGap;
    setCurrentSpeed(GAME_CONFIG.pipeSpeed);
    setAdCountdown(3);

    // NOTE: Do NOT play BGM here - it will be played after ad closes in handleRetry
  }, []);

  const startCameraAndGame = async () => {
    // 1. Audio Interaction Unlock: Play sound IMMEDIATELY on click
    AudioManager.getInstance().unlock();

    if (!videoRef.current) return;
    setShowPermissionError(false);
    try {
      // Optimized camera settings for performance: 320x240 (QVGA) is sufficient for face tracking
      // and significantly reduces CPU/GPU load compared to 640x480 or higher.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => videoRef.current?.play();

      // Reset game state first
      resetGame();

      // Start 3-2-1 countdown
      setGameCountdown(3);
      setGameState('COUNTDOWN');

      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        setGameCountdown(count);
        if (count <= 0) {
          clearInterval(countdownInterval);

          // Reset timing refs to prevent immediate spawn of second pipe (overlapping issue)
          gameStartTimeRef.current = Date.now();
          lastPipeTimeRef.current = Date.now();

          setGameState('PLAYING');
          AudioManager.getInstance().playBGM();
        }
      }, 1000);
    } catch (err) {
      setShowPermissionError(true);
    }
  };

  const handleGameOver = useCallback((reason: string) => {
    // Show instant crash roast
    const crashRoast = getCrashRoast();
    setCommentary(crashRoast);

    setGameState('AD_INTERSTITIAL');
    AudioManager.getInstance().stopBGM();
    AudioManager.getInstance().playSound('crash');
    setPreRoastText(PRE_ROASTS_WAITING[Math.floor(Math.random() * PRE_ROASTS_WAITING.length)]);
    const localRoast = getRoastForScore(scoreRef.current);
    let timer = 3;
    const interval = setInterval(() => {
      timer -= 1;
      setAdCountdown(timer);
      if (timer <= 0) {
        clearInterval(interval);
        setCommentary(localRoast); // Replace crash roast with score-based roast
        setScore(scoreRef.current); // Sync final score
        setGameState('GAMEOVER');
        setHighScore(prev => Math.max(prev, scoreRef.current));
      }
    }, 1000);
  }, []);

  const handleRetry = useCallback(async () => {
    // Create a promise that resolves when ad is dismissed
    let adDismissedResolve: () => void;
    const adDismissedPromise = new Promise<void>((resolve) => {
      adDismissedResolve = resolve;
    });

    // Listen for ad dismissed event
    const dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      console.log('🎯 Ad dismissed - starting game reset');
      adDismissedResolve();
    });

    // 1. Show interstitial ad FIRST
    try {
      await AdMobService.showInterstitial();
      console.log('📺 Waiting for ad to be dismissed...');

      // Wait for ad to be dismissed OR timeout after 15 seconds
      const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, 15000));
      await Promise.race([adDismissedPromise, timeoutPromise]);
    } catch (e) {
      console.error("Ad failed or timed out", e);
    } finally {
      // Always remove the listener
      await dismissListener.remove();
    }

    // 2. Small delay to ensure ad UI is fully cleared
    await new Promise(resolve => setTimeout(resolve, 300));

    // 3. NOW reset game state completely (after ad is closed)
    console.log('🔄 Resetting game after ad...');
    AdMobService.hideBanner();
    resetGame();

    // 4. Start 3-2-1 countdown ONLY after ad is fully closed
    setGameCountdown(3);
    setGameState('COUNTDOWN');

    // Countdown timer
    let count = 3;
    const countdownInterval = setInterval(() => {
      count -= 1;
      setGameCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        // Reset timing refs right before playing to ensure fresh start
        gameStartTimeRef.current = Date.now();
        lastPipeTimeRef.current = Date.now();
        setGameState('PLAYING');
        AudioManager.getInstance().playBGM();
      }
    }, 1000);
  }, [resetGame]);

  // --- THE OPTIMIZED GAME LOOP ---
  const update = useCallback(() => {
    requestRef.current = requestAnimationFrame(update);

    // Allow face tracking during COUNTDOWN so bird is ready when game starts
    const isTrackingAllowed = gameStateRef.current === 'PLAYING' || gameStateRef.current === 'COUNTDOWN';
    const isGameRunning = gameStateRef.current === 'PLAYING';

    if (!isTrackingAllowed) return;

    const dims = gameDimensionsRef.current;
    const now = performance.now();

    // --- DIFFICULTY RAMPING ---
    const elapsedSeconds = (Date.now() - gameStartTimeRef.current) / 1000;
    const progress = Math.min(1, elapsedSeconds / DIFFICULTY_RAMP_SECONDS);
    speedRef.current = GAME_CONFIG.pipeSpeed + (DIFFICULTY_MAX_SPEED - GAME_CONFIG.pipeSpeed) * progress;
    gapRef.current = GAME_CONFIG.pipeGap - (GAME_CONFIG.pipeGap - DIFFICULTY_MIN_GAP) * progress;

    // --- FACE TRACKING (Optimized: 30 FPS detection for low-end devices) ---
    // Run face detection at 30 FPS (33ms) - balanced between speed and smoothness
    if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
      if (now - lastProcessTimeRef.current > 33) {
        lastProcessTimeRef.current = now;
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, now);
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const faceY = results.faceLandmarks[0][4].y;
            const normalizedY = (faceY - 0.2) / 0.6;
            const targetY = normalizedY * dims.height;
            const clampedY = Math.max(0, Math.min(dims.height - GAME_CONFIG.birdHeight, targetY));
            // Tuned interpolation for 30FPS tracking input: smoother 0.3 (was 0.4)
            // This prevents "snapping" when new data arrives
            const newY = birdYRef.current + (clampedY - birdYRef.current) * 0.3;
            birdRotationRef.current = (newY - birdYRef.current) * 2.5;
            birdYRef.current = newY;
          }
        } catch (e) { /* ignore */ }
      }
    }

    // --- UPDATE BIRD (Direct DOM) - Always update visual position ---
    birdRef.current?.updatePosition(birdYRef.current, birdRotationRef.current);

    // Stop here if we're in COUNTDOWN - only track face, don't run game logic
    if (!isGameRunning) return;

    // --- SPAWN NEW PIPES (More distance at start, closer as difficulty increases) ---
    const baseInterval = 2500; // Start with 2.5 seconds between pipes
    const minInterval = 1800; // Increased minimum interval for better spacing
    const spawnInterval = Math.max(minInterval, baseInterval - (speedRef.current * 100));
    if (Date.now() - lastPipeTimeRef.current > spawnInterval) {
      // GUARANTEED GAP LOGIC
      const pipeGap = Math.max(160, gapRef.current);
      const minWall = 60; // Absolute minimum height for top/bottom pipes

      // Available Random Space = Total Height - Gap - (TopWall + BottomWall)
      let availableSpace = dims.height - pipeGap - (minWall * 2);

      // Sanity check: if availableSpace < 0 (tiny screen), just center the gap
      if (availableSpace < 0) availableSpace = 0;

      const randomOffset = Math.floor(Math.random() * availableSpace);

      // Top Height = MinWall + RandomOffset
      let topHeight = minWall + randomOffset;

      // Double check constraints (clamp)
      topHeight = Math.max(minWall, Math.min(topHeight, dims.height - pipeGap - minWall));

      const poolIndex = getNextPipePoolIndex();
      if (poolIndex === -1) return; // Safety check: Skip spawn if pool is full

      // MOVING PIPE LOGIC - starts after score 3 (earlier to make it exciting!)
      const currentScore = scoreRef.current;
      let isMoving = false;
      let moveSpeed = 0;
      let moveRange = 0;

      if (currentScore >= 3) {
        // Chance of moving pipe increases with score
        // Score 3-6: 25% chance, Score 7-10: 45% chance, Score 10-15: 60%, Score 15+: 75%
        const movingChance = currentScore >= 15 ? 0.75 : currentScore >= 10 ? 0.6 : currentScore >= 7 ? 0.45 : 0.25;
        isMoving = Math.random() < movingChance;

        if (isMoving) {
          // Speed increases with score: 0.8 at score 3, up to 2.5 at score 20+
          moveSpeed = Math.min(2.5, 0.8 + (currentScore - 3) * 0.12);
          // Range increases with score: 35px at score 3, up to 90px at score 20+
          moveRange = Math.min(90, 35 + (currentScore - 3) * 4);

          // Adjust topHeight to allow room for movement
          const movementBuffer = moveRange + 20;
          topHeight = Math.max(minWall + movementBuffer, Math.min(topHeight, dims.height - pipeGap - minWall - movementBuffer));
        }
      }

      const newPipe: InternalPipeState = {
        id: Date.now(),
        x: dims.width,
        topHeight,
        gap: pipeGap,
        passed: false,
        poolIndex,
        isMoving,
        moveDirection: Math.random() < 0.5 ? 1 : -1, // Random start direction
        moveSpeed,
        baseTopHeight: topHeight,
        moveRange,
      };
      pipesRef.current.push(newPipe);

      const pipeHandle = pipeRefs.current[poolIndex];
      if (pipeHandle) {
        pipeHandle.configure(topHeight, pipeGap, dims.height, GAME_CONFIG.pipeWidth);
        pipeHandle.updatePosition(dims.width);
        pipeHandle.setVisibility(true);
      }
      lastPipeTimeRef.current = Date.now();
    }

    // --- MOVE PIPES & CHECK COLLISIONS ---
    const birdRect = {
      left: 50 + 12,
      right: 50 + GAME_CONFIG.birdWidth - 12,
      top: birdYRef.current + 8,
      bottom: birdYRef.current + GAME_CONFIG.birdHeight - 8
    };
    let passOccurred = 0;

    // Optimized loop: Backwards iteration to allow splicing without index issues
    // and avoiding allocating new array with .filter() every frame
    const pipes = pipesRef.current;
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];

      // Horizontal movement
      p.x -= speedRef.current;

      // VERTICAL MOVEMENT for moving pipes
      if (p.isMoving) {
        // Move in current direction
        p.topHeight += p.moveSpeed * p.moveDirection;

        // Reverse direction if hitting bounds
        const minBound = p.baseTopHeight - p.moveRange;
        const maxBound = p.baseTopHeight + p.moveRange;

        if (p.topHeight <= minBound) {
          p.topHeight = minBound;
          p.moveDirection = 1; // Start moving down
        } else if (p.topHeight >= maxBound) {
          p.topHeight = maxBound;
          p.moveDirection = -1; // Start moving up
        }

        // OPTIMIZATION: Only reconfigure pipe when it actually moved
        const pipeHandle = pipeRefs.current[p.poolIndex];
        if (pipeHandle) {
          pipeHandle.configure(p.topHeight, p.gap, dims.height, GAME_CONFIG.pipeWidth);
        }
      }

      // Update horizontal position (always happens)
      pipeRefs.current[p.poolIndex]?.updatePosition(p.x);

      // Check pass
      if (!p.passed && p.x + GAME_CONFIG.pipeWidth < 50) {
        p.passed = true;
        passOccurred++;
      }

      // Check collision (uses current topHeight which may have changed for moving pipes)
      if (birdRect.right > p.x && birdRect.left < p.x + GAME_CONFIG.pipeWidth) {
        if (birdRect.top < p.topHeight || birdRect.bottom > p.topHeight + p.gap) {
          handleGameOver("crashed");
        }
      }

      // Remove off-screen pipes
      if (p.x < -GAME_CONFIG.pipeWidth) {
        pipeRefs.current[p.poolIndex]?.setVisibility(false);
        // Remove from array (efficient splice since we are iterating backwards)
        pipes.splice(i, 1);
      }
    }

    if (passOccurred > 0) {
      scoreRef.current += passOccurred;
      if (scoreDisplayRef.current) scoreDisplayRef.current.textContent = String(scoreRef.current);
      AudioManager.getInstance().playSound('score');
    }

    // --- BOUNDARY CHECK ---
    if (birdYRef.current <= -40 || birdYRef.current >= dims.height - GAME_CONFIG.birdHeight + 40) {
      handleGameOver("out of bounds");
    }
  }, [handleGameOver, getNextPipePoolIndex]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  return (
    <div className="w-screen h-screen bg-slate-950 p-0 font-inter overflow-hidden">
      <AdBlockDetector />
      <div className="relative w-full h-full bg-slate-900 overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
        {/* Video Background */}
        <div className="absolute inset-0 z-0">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" style={{ willChange: 'auto' }} />
          {/* Simplified overlay for better performance */}
          <div className="absolute inset-0 bg-slate-950/20" />
        </div>

        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-10 inset-x-0 flex flex-col items-center z-30 pointer-events-none">
            <div className="bg-slate-950/80 px-12 py-3 rounded-[2rem] border-2 border-white/10 shadow-lg">
              <span ref={scoreDisplayRef} className="text-7xl font-game text-white drop-shadow-md">0</span>
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

        {/* Game Layer */}
        <div className="relative z-10 w-full h-full">
          {/* Pipe Pool */}
          {Array.from({ length: PIPE_POOL_SIZE }).map((_, i) => (
            <Pipe key={i} ref={el => { pipeRefs.current[i] = el; }} pipeWidth={GAME_CONFIG.pipeWidth} />
          ))}
          <Bird ref={birdRef} />
          <div className="absolute bottom-14 w-full h-2 bg-white/5 backdrop-blur-sm z-20" />
        </div>

        {/* START SCREEN */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center z-50 text-center overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-6 px-6 w-full relative">
              {/* Animated background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-40 right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>

              {/* Logo Section */}
              <div className="relative mb-5">
                <div className="w-32 h-32 bg-gradient-to-br from-orange-500 via-red-500 to-yellow-500 rounded-[2.5rem] p-1 shadow-2xl shadow-orange-500/30">
                  <div className="w-full h-full bg-slate-900 rounded-[2.2rem] flex items-center justify-center overflow-hidden">
                    <img src="/logo.png" alt="Nose Roast" className="w-[110%] h-[110%] object-contain" />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg animate-bounce">🔥 VIRAL</div>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-game text-white tracking-tight leading-none mb-1">NOSE<span className="text-orange-500">ROAST</span></h1>
              <p className="text-white/50 text-xs font-medium tracking-wider mb-5">Fly with your face • Get roasted</p>

              {/* Username Input */}
              <div className="w-full max-w-xs mb-5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2 font-medium">Your Name (for sharing)</p>
                <input type="text" value={username} onChange={(e) => handleUsernameChange(e.target.value)} placeholder="Enter your name..." maxLength={15} className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-white text-center text-sm font-medium placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all" />
              </div>

              {/* Play Button */}
              <button onClick={startCameraAndGame} className="group relative bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white px-10 py-4 rounded-full text-xl font-game transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/30">
                <div className="flex items-center gap-3"><Play fill="currentColor" size={24} /><span>PLAY NOW</span></div>
              </button>

              {/* High Score */}
              {highScore > 0 && <div className="mt-3 flex items-center gap-2 text-white/40 text-xs font-medium"><TrendingUp size={14} /><span>Best Score: <span className="text-yellow-400 font-bold">{highScore}</span></span></div>}

              {/* Footer */}
              <div className="mt-4 flex items-center gap-2 text-white/20 text-[9px] font-medium"><ShieldCheck size={12} /><span>Camera used for face tracking only</span></div>
            </div>

            {/* BOTTOM BANNER AD SPACE */}
            <div className="w-full h-14 bg-slate-950/90 border-t border-white/5 flex-shrink-0">
            </div>
          </div>
        )}

        {/* AD INTERSTITIAL */}
        {gameState === 'AD_INTERSTITIAL' && (
          <div className="absolute inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-full h-80 bg-slate-900 rounded-[3rem] border-4 border-white/5 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center font-game text-2xl text-white">{adCountdown}</div>
              </div>
              <p className="text-white/60 font-medium text-sm italic px-10">"{preRoastText}"</p>
            </div>
            <p className="mt-10 text-white/20 text-[8px] font-black uppercase tracking-[0.6em] animate-pulse">Scanning for skill... none found.</p>
          </div>
        )}

        {/* COUNTDOWN SCREEN - 3-2-1 before game starts */}
        {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 z-[55] flex flex-col items-center justify-center pointer-events-none">
            {/* Semi-transparent overlay */}
            <div className="absolute inset-0 bg-slate-950/70" />

            {/* Countdown content */}
            <div className="relative flex flex-col items-center justify-center">
              {/* Big countdown number */}
              <div className="relative">
                <div className="text-[12rem] font-game text-white drop-shadow-2xl animate-pulse"
                  style={{
                    textShadow: '0 0 60px rgba(249, 115, 22, 0.8), 0 0 120px rgba(249, 115, 22, 0.4)',
                    animation: 'pulse 0.5s ease-in-out'
                  }}>
                  {gameCountdown > 0 ? gameCountdown : 'GO!'}
                </div>
              </div>

              {/* Get ready text */}
              <p className="text-2xl font-game text-orange-400 mt-4 uppercase tracking-[0.3em]">
                {gameCountdown > 0 ? 'GET READY' : 'FLY!'}
              </p>

              {/* Tip */}
              <p className="text-white/40 text-sm mt-8 max-w-xs text-center">
                Move your nose up and down to control the bird
              </p>
            </div>
          </div>
        )}

        {/* GAMEOVER SCREEN */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center z-[70] text-center text-white overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-6 px-4 w-full">
              {/* Title */}
              <div className="w-full mb-3">
                <h2 className="text-2xl font-game mb-1 tracking-tight">
                  {score >= highScore && score > 0 ? '🏆 NEW RECORD!' : 'GAME OVER'}
                </h2>
                <p className="text-white/50 text-xs">
                  {score >= highScore && score > 0 ? 'You absolutely CRUSHED it!' : 'One more try? You got this!'}
                </p>
              </div>

              {/* RoastCard - Bigger now */}
              <div className="flex-shrink-0" style={{ transform: 'scale(0.85)', transformOrigin: 'center center' }}>
                <RoastCard score={score} highScore={highScore} roast={commentary} username={username} ref={cardRef} />
              </div>

              {/* Buttons */}
              <div className="w-full max-w-xs space-y-3 mt-4">
                <button onClick={handleRetry} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 py-4 px-6 rounded-full text-xl font-game transition-all transform active:scale-95 shadow-xl shadow-emerald-500/30">
                  <RefreshCw size={22} />
                  <span>PLAY AGAIN</span>
                </button>
                <button onClick={shareRoast} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 py-3.5 px-6 rounded-full text-lg font-game transition-all transform active:scale-95 shadow-xl shadow-indigo-500/30">
                  {isSharing ? <Loader2 className="animate-spin" size={20} /> : <><Share2 size={20} /><span>SHARE ROAST</span></>}
                </button>
              </div>
            </div>

            {/* BOTTOM BANNER AD */}
            <div className="w-full h-14 bg-slate-950/90 border-t border-white/5 flex items-center justify-center flex-shrink-0">
            </div>
          </div>
        )}

        {/* CAMERA PERMISSION POPUP */}
        {showPermissionError && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-8">
            <div className="w-full bg-red-950/20 border-2 border-red-500/50 p-8 rounded-[3rem] text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
              <div className="bg-red-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"><CameraOff size={48} className="text-red-500" /></div>
              <h3 className="text-3xl font-game text-white mb-4">ACCESS DENIED</h3>
              <p className="text-red-200/60 text-sm leading-relaxed mb-8 px-4">NoseRoast AI uses your camera to track your nose for flight. Please click the <span className="text-red-400 font-bold underline">Camera Icon</span> in your address bar or app settings to allow access.</p>
              <button onClick={startCameraAndGame} className="bg-white text-slate-950 font-black uppercase tracking-widest py-5 px-10 rounded-full hover:scale-105 transition-transform">Retry Access</button>
              <button onClick={() => setShowPermissionError(false)} className="block w-full mt-4 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white">Close</button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {gameState === 'LOADING' && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100] text-white">
            <div className="relative"><div className="w-24 h-24 border-8 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-8" /><div className="absolute inset-0 flex items-center justify-center font-black text-orange-400 text-xs">OS</div></div>
            <p className="text-[10px] font-game tracking-[0.5em] text-white/40 animate-pulse uppercase">Waking up Neural Sensors...</p>
          </div>
        )}

        {/* BOTTOM AD BANNER */}
        <div className="absolute bottom-0 inset-x-0 h-14 bg-slate-950 border-t border-white/5 flex flex-col items-center justify-center z-40">
          <span className="text-[10px] text-white/20 font-sans tracking-widest uppercase mb-auto pt-1">Advertisement</span>
        </div>
      </div>
    </div>
  );
};

export default App;
