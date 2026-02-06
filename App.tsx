
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

// 🔥 ABSOLUTELY SAVAGE ROASTS - NO MERCY, NO PRAISE, PURE BRUTALITY
const ROASTS_BEGINNER = [ // Score 0-2 - Complete annihilation
  "Your nose has the reaction time of a Windows Vista laptop. 💀",
  "Bro played like their WiFi was connected to a microwave. Tragic.",
  "That wasn't gaming, that was a public humiliation speedrun.",
  "Even a brick with googly eyes would've scored higher. I'm not joking.",
  "Your face said 'I got this' but your score said 'call 911.' 😭",
  "The pipes took one look at you and went 'free real estate.'",
  "This score belongs in a museum of human failure. Historic L.",
  "You just speedran disappointment. Congrats on the world record. 🏆",
  "Somewhere, a pigeon is laughing at you. And it's justified.",
  "This isn't a skill issue, this is an existential crisis.",
  "The tutorial enemies from 2002 flash games would body you.",
  "Your gameplay just got submitted as evidence for AI supremacy.",
  "That was giving 'first day with a face' energy. Absolutely tragic.",
  "The game's report button is filing a complaint against YOUR existence.",
  "Bro thought this was a participation trophy generator. 💀",
  "Your reflexes are sponsored by Internet Explorer. In 2026.",
  "I've seen better coordination from a broken Roomba.",
  "The 'Play Again' button is scared of you at this point.",
  "You played like your nose owes money to the pipes.",
  "This score is so bad it needs therapy. And so do you.",
  "Your performance just became a training video titled 'What NOT to Do.'",
  "The pipes didn't even try. They felt guilty for existing.",
  "Delete the app, throw your phone in rice, start over.",
  "Your nose moves like it's streaming on 2G in a tunnel.",
  "Congrats! You've unlocked the 'Why Am I Like This' achievement. 🏅",
  "Your face control is giving 'never seen a mirror before' vibes.",
  "This is what happens when talent takes a permanent vacation.",
  "You're the reason games have 'Are you REALLY sure?' prompts.",
  "Your nose just filed for divorce. From your face. It's over.",
  "The game AI wrote an apology for making it look too hard. Kidding.",
  "You make NPCs look like esports world champions. That's a talent.",
  "Your score screams 'I peaked as a sperm cell' and it shows.",
  "This gameplay should be classified as a war crime.",
  "The pipes are writing thank-you notes to you for the free win.",
  "You just set a new record. For most embarrassing failure.",
  "Your ancestors are in heaven pretending they don't know you.",
  "This performance got rejected from the blooper reel for being too sad.",
  "The game literally tried to let you win. You still lost.",
  "Your face is allergic to success and it's terminal.",
  "This isn't rock bottom. You brought a shovel and kept digging.",
];

const ROASTS_LEARNING = [ // Score 3-7 - Still brutal, slightly acknowledging survival
  "Score 3-7? So you're evolving... from terrible to just really bad. 📉",
  "Your nose is buffering. Talent.exe not found. Abort? Y/N",
  "This is giving 'main character who dies in episode 2' vibes.",
  "You're mid. Aggressively, consistently, painfully mid.",
  "The pipes are starting to wonder if you need a wellness check.",
  "Loading potential.exe... ERROR 404: File does not exist.",
  "You're like a participation trophy that got left in the rain.",
  "This score says 'I peaked in the womb' and it's showing.",
  "Your ancestors didn't survive evolution for THIS performance.",
  "You're the reason games have 'Story Mode' with zero combat.",
  "Somewhere, your future self just blocked your number.",
  "You're not terrible anymore. You're just professionally not good.",
  "This is giving 'practice makes permanent mediocrity' energy.",
  "Your nose has potential. Too bad your brain doesn't.",
  "You're the warm-up act nobody asked for. Forever opener.",
  "The pipes are confused. 'Are they lagging or just... like this?'",
  "Your gameplay is like a plot twist from a low-budget horror film.",
  "You're the human equivalent of buffering at 99%.",
  "This score screams 'I'll practice later' but later never comes.",
  "You're giving beta tester energy. All bugs, zero features.",
  "The leaderboard just filed a restraining order. Again.",
  "Skill? She left. She's not coming back. Accept it.",
  "You're the reason 'retry' buttons exist. Job security.",
  "Solid D+ energy. Your parents knew this day would come.",
  "The pipes are literally betting on when you'll crash next.",
  "You're improving! From 'disaster' to 'unfortunate incident.' Baby steps!",
  "Your face is trying. Your score is filing a formal complaint.",
  "This is the gaming equivalent of catfishing yourself.",
  "You're on the struggle bus and it ran out of gas in 2019.",
  "The game is rooting for you out of pity. It's that bad.",
  "Your nose said 'today's the day' and the universe said 'lol no.'",
  "You're giving 'I Googled how to play' but didn't read the result.",
  "This score is the definition of 'almost competent but not really.'",
  "You're stuck in tutorial purgatory and it's self-inflicted.",
  "The pipes started a support group because of players like you.",
  "You just unlocked: 'Everyone's had better days' achievement.",
  "Your gameplay looks like lag but it's actually just you.",
  "This is what happens when coordination takes a sick day. Forever.",
  "You're the NPC energy everyone warned you about.",
  "The game difficulty is set to 'Easy' and you're still struggling.",
];

const ROASTS_DECENT = [ // Score 8-15 - Brutal acknowledgment that they're still not that good
  "Score 8-15? Okay so you're not completely braindead. Just mostly. 🔥",
  "Your nose went from 'disaster' to 'mild inconvenience.' Character development!",
  "This is giving 'I might screenshot this but probably won't' vibes.",
  "The pipes are sweating. Slightly. Like barely noticeable.",
  "Your face just graduated from 'hopeless' to 'questionable.'",
  "Double digits?! We're shocked. Genuinely. Still not impressed though.",
  "This score is mid-tier. Peak mediocrity. Congrats? 📈",
  "Your friends WISH they had this. But only because they're worse.",
  "You're not a pro. You're not even semi-pro. You're amateur hour.",
  "The algorithm noticed you. Then immediately forgot about you.",
  "This is giving 'protagonist who survives on pure luck' energy.",
  "You proved the haters wrong. Barely. By like 0.2%. Technically.",
  "Certified nose pilot. Expired license. Pending review. Probably denied.",
  "This score is screenshot-worthy if you have zero standards.",
  "You're officially better than 60% of players. The bottom 60%.",
  "Your nose is giving 'auditioned for a talent show, didn't make it' vibes.",
  "The pipes called reinforcements. Then canceled them. False alarm.",
  "This is the redemption arc nobody asked for or wants to see.",
  "You're evolving. At the pace of continental drift. Glacially slow.",
  "The game's difficulty is sweating. From laughter. At you.",
  "Your face just entered the Top 40%. Of the bottom 50%.",
  "This score is giving 'tell your mom but she won't care' material.",
  "You're not viral. You're not even bacterial. You're just... there.",
  "The pipes are writing incident reports. To document your mediocrity.",
  "You've graduated from 'joke' to 'punchline.' Congrats! 🎓",
  "Your nose unlocked 'actually decent' status. Trial version. Expires soon.",
  "This is giving 'I practiced once in 2019' energy. It shows.",
  "The game is reconsidering its difficulty. Should it be easier? For you?",
  "You're the plot twist nobody saw coming because nobody was watching.",
  "Your face control went from 'questionable' to 'under investigation.'",
  "This score deserves its own highlight reel. On a blooper channel.",
  "You're making the pipes nervous. Nervous you'll actually survive. Scary.",
  "Your nose said 'watch this' and we did. We regret watching.",
  "You're giving 'peaked in this one game session' energy. Sad.",
  "The pipes are placing bets on your life expectancy. Looking grim.",
  "You just proved that practice makes... slightly less embarrassing.",
  "This is the gaming equivalent of a participation certificate. Laminated.",
  "You're the cautionary tale parents tell their kids about effort.",
  "Your score says 'I'm trying my best.' Your best is... concerning.",
  "The game gave you a pity point. Actually several. Thank the algorithm.",
];

const ROASTS_PRO = [ // Score 16+ - MOST BRUTAL - Roasting them for thinking they're elite
  "Score 16+? Okay hotshot, don't let it go to your head. We've seen better. 🙄",
  "You didn't break the game. You just got lucky. Don't quit your day job.",
  "Those pipes are filing a complaint. For harassment. You're TOO tryhard.",
  "This score is 'good' but we've seen LEGENDARY. This ain't it, chief.",
  "Your ancestors are watching. They're... confused why you're so proud of THIS.",
  "Share this if you want. Nobody will care. But go off, king. 👑",
  "You 'broke the game'? Nah. The game let you win out of pity.",
  "World record behavior? More like 'local community center tournament' vibes.",
  "Your nose achieved enlightenment? Bold claim for someone who almost died 8 times.",
  "This is going viral? In your dreams. And only the embarrassing ones.",
  "You're either skillful or the game glitched. We're betting on glitch.",
  "The pipes retired? No. They're just taking a break. From laughing at you.",
  "Your face has talent? Sure. Talent for making this look harder than it is.",
  "This performance got added to the Library of 'Could've Been Better.'",
  "You're not human? True. Humans have humility. You have delusion. 🔥",
  "Scientists want to study your nose. To figure out why you think you're special.",
  "This score crashed our servers. With secondhand embarrassment.",
  "You're giving 'main character who thinks they're the hero' energy. You're not.",
  "The difficulty settings filed unemployment? No. They filed a complaint. About YOU.",
  "Your nose has a Wikipedia page? Yeah, under 'Overconfidence: A Case Study.'",
  "Face gaming is a sport? Sure. And you just placed 47th. Out of 50.",
  "The pipes applied for witness protection. From your ego. It's suffocating.",
  "Your performance trains the next generation. On what NOT to be proud of.",
  "LEGENDARY? More like 'Participated.' We need new vocabulary for mediocrity.",
  "The game considered giving YOU a trophy. Then remembered you're not that good.",
  "Your face became the final boss. Of overestimating your own abilities.",
  "This score is being studied. As evidence of the Dunning-Kruger effect.",
  "You're the reason difficulty modes exist. To protect your fragile ego.",
  "Your nose control is giving 'built different' energy. Different. Not better.",
  "The pipes held a memorial service. For the humility you clearly lack.",
  "This gameplay belongs in a museum. Under 'Inflated Self-Worth: Exhibit A.'",
  "You made history. As the person who thought 16 points was impressive.",
  "Your face is a weapon of mass destruction. Of your own credibility.",
  "This score is so 'good' it should be illegal. To brag about. Please stop.",
  "You're proud of THIS? Set higher standards. Actually, set ANY standards.",
  "The pipes are writing your biography. Title: 'Tried Hard, Stayed Mid.'",
  "This is your peak. It's all downhill from here. Enjoy the moment. It's over.",
  "You think you're Him. You're not. You're 'him-adjacent' at best.",
  "The game is impressed. That you managed to be THIS cocky with THIS score.",
  "Your nose deserves an award. For dealing with your inflated ego all day.",
];

const PRE_ROASTS_WAITING = [
  "Measuring your disappointment levels...",
  "Consulting the roast council of elders...",
  "Calculating your emotional damage...",
  "Scanning for traces of talent... still searching...",
  "Brewing maximum savagery with extra spite...",
  "Loading your personalized destruction...",
  "Asking the pipes for their brutally honest opinion...",
  "Your face is being judged by 47 algorithms... verdict: guilty.",
  "Generating the perfect insult customized just for you...",
  "The roast machine is warming up... it's getting HOT.",
  "Cross-referencing your failures with historical data...",
  "AI is analyzing exactly where you went wrong... everywhere.",
  "Preparing your roast... this might hurt a little. A lot.",
  "Compiling evidence of your incompetence...",
  "The judges are deliberating... it's not looking good for you.",
];

// 💥 INSTANT CRASH ROASTS - Shown immediately when player crashes (EXPANDED TO 50)
const CRASH_ROASTS = [
  "BONK! 💥 Your face just met its soulmate: failure.",
  "Ouch! That pipe didn't even acknowledge your existence.",
  "WASTED. Your nose coordination just uninstalled itself.",
  "Crash landing! Your pilot license was fake anyway.",
  "That pipe said 'not today' and you, the obedient servant, listened.",
  "GAME OVER. Your face forgot how to face. Again.",
  "Destroyed. The pipe didn't even try. You still lost.",
  "Your nose rage quit before you could. Coward.",
  "Critical failure! Your reflexes filed for bankruptcy. Chapter 11.",
  "That wasn't a crash, that was a white flag. You surrendered.",
  "The pipe won. Your dignity is in the morgue. RIP.",
  "Your face control just factory reset itself. Back to zero.",
  "Eliminated. The pipe is doing a victory dance right now.",
  "That pipe is telling its grandchildren about this moment.",
  "Your nose just became a cautionary tale for other noses.",
  "Mission failed. Your face will get 'em next time. (Spoiler: it won't.)",
  "The pipe didn't move. You still crashed into it. Legendary stupidity.",
  "Your coordination just called in sick. It's terminal.",
  "That crash was personal. The pipe remembered you from last time.",
  "Game over! Your nose is filing a lawsuit against your brain.",
  "You got absolutely VIOLATED by that pipe. Call the authorities.",
  "That pipe said 'ez' in chat. You can't even respond.",
  "Your face just got sent to the shadow realm. No passport needed.",
  "Congratulations! You found the pipe. With your nose. Painfully.",
  "That wasn't even close. That was a crime against physics.",
  "Your nose saw the pipe. Your brain said 'hit it anyway.' Why.",
  "REKT. The pipe didn't even know you existed until you crashed.",
  "You just got humbled by an inanimate object. Think about that.",
  "The pipe won. You lost. Your therapist needs to know about this.",
  "Your nose is filing a complaint with HR. Hostile work environment.",
  "That crash was so bad it violated the Geneva Convention.",
  "You aimed for the gap. You hit the pipe. Every single time.",
  "The pipe is the main character. You're the comedic relief. Dead comedian.",
  "Your reflexes are slower than a Windows 95 bootup. 💀",
  "That pipe put you in a highlight reel. A 'what NOT to do' reel.",
  "You crashed harder than the stock market in 1929.",
  "The pipe didn't respect you before. It definitely doesn't now.",
  "Your nose just set a new record: Fastest Crash Speedrun. WR! 🏆",
  "Game over. Your face control is buffering. Forever.",
  "The pipe called its friends over. 'Watch this loser crash again.'",
  "You hit that pipe like you WANTED to lose. Self-sabotage is real.",
  "That wasn't a crash. That was an execution. Public. Brutal.",
  "Your coordination left the server. Connection timeout: 999ms.",
  "The pipe is laughing. We're laughing. Your nose is crying.",
  "You just got sent back to the main menu. And to therapy.",
  "That crash was so predictable, we saw it coming in 4K HDR.",
  "Your face control is lagging. Ping: ∞. Unplayable.",
  "The pipe wrote a diss track about you. It's on Spotify. Charting.",
  "You crashed so hard your ancestors felt it. They're disappointed.",
  "Game over. Your nose is requesting a transfer to a different face.",
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
