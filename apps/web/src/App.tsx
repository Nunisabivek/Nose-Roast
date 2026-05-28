import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameState, GAME_CONFIG, INITIAL_BIRD_Y, DIFFICULTY_MAX_SPEED, DIFFICULTY_MIN_GAP, DIFFICULTY_RAMP_SECONDS, CAMERA_CONFIG, FACE_DETECTION_CONFIG, GAME_LOOP_CONFIG, ADSTERRA_CONFIG, PRE_ROASTS_WAITING, getRoastForScore, getCrashRoast, getDuoRoast } from '@noseroast/shared';
import AdBlockDetector from './components/AdBlockDetector';
import AdsterraAd from './components/AdsterraAd';
import { RefreshCw, Play, Loader2, TrendingUp, ShieldCheck, Flame, CameraOff, Share2, Download, Copy, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import RoastCard from './components/RoastCard';
import { AdMobService } from './services/admob';
import { AudioManager } from './services/AudioManager';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import GameCanvas, { PipeData, PlayerRenderData } from './components/GameCanvas';
import { Peer, DataConnection, MediaConnection } from 'peerjs';

const IS_NATIVE = Capacitor.isNativePlatform();
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.noseroast.game';
const PRIVACY_URL = '/privacy.html';

// Version info for tracking
const APP_VERSION = '2.1.0-WebRTC';
const BUILD_DATE = '2026-05-21';

// WebRTC custom signaling server configuration (deployed to Railway)
// Toggle to true to use your own secure Railway server to bypass public rate limits.
const USE_CUSTOM_SIGNALING = false; 
const SIGNALING_HOST = 'your-signaling-app.up.railway.app'; // Change this to your deployed Railway domain!
const SIGNALING_PORT = 443;
const SIGNALING_PATH = '/noseroast';

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

// Boost stream quality dynamically over WebRTC by raising maxBitrate to 4 Mbps for HD resolution
const boostStreamQuality = (pc: RTCPeerConnection) => {
  if (!pc) return;
  const applyBoost = () => {
    try {
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          // Enforce a premium 4 Mbps maximum bitrate for sharp high-definition video capture
          params.encodings[0].maxBitrate = 4000000;
          sender.setParameters(params)
            .then(() => console.log("🚀 WebRTC Video Bitrate boosted to 4Mbps for HD Stream quality!"))
            .catch(err => console.warn("⚠️ Failed to set maxBitrate on track:", err));
        }
      }
    } catch (e) {
      console.warn("⚠️ Error boosting video quality:", e);
    }
  };

  // Apply immediately and on iceconnectionstatechange to guarantee application after renegotiation
  applyBoost();
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      setTimeout(applyBoost, 1000);
    }
  });
};

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

  // --- ONLINE WEBRTC STATES ---
  const [gameMode, setGameMode] = useState<'SOLO' | 'DUO'>('SOLO');
  const [roastVoiceProfile, setRoastVoiceProfile] = useState<'sarcastic' | 'hype' | 'deadpan'>(() => {
    return (localStorage.getItem('noseroast_voice_profile') as any) || 'sarcastic';
  });
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CREATING' | 'WAITING' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const [opponentStream, setOpponentStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOpponentReady, setIsOpponentReady] = useState(false);
  const [matchVerdict, setMatchVerdict] = useState<'WIN' | 'LOSE' | 'DRAW' | null>(null);
  const [finalScoreP1, setFinalScoreP1] = useState(0);
  const [finalScoreP2, setFinalScoreP2] = useState(0);
  const [firstCrashed, setFirstCrashed] = useState<'P1' | 'P2' | 'BOTH' | null>(null);
  // Omegle-style duel flow
  const [showMatchFound, setShowMatchFound] = useState(false);
  const [opponentName, setOpponentName] = useState('CHALLENGER');
  const [isSearchingNext, setIsSearchingNext] = useState(false);
  const [duoRoastCountdown, setDuoRoastCountdown] = useState(0);

  // Visual sensory effects
  const [shakeLeft, setShakeLeft] = useState(false);
  const [shakeRight, setShakeRight] = useState(false);
  const [flashLeft, setFlashLeft] = useState(false);
  const [flashRight, setFlashRight] = useState(false);

  // Refs for DOM nodes
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  // WebRTC Connection refs
  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

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

  // Local player physics refs (P1)
  const lastCountdownRef = useRef<number>(-1);
  const birdYRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const targetBirdYRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const birdRotationRef = useRef<number>(0);
  const isLocalDeadRef = useRef(false);
  const calibrationNoseYRef = useRef<number | null>(null);
  const lastFaceDetectedTimeRef = useRef<number>(0);

  // Opponent player physics refs (P2)
  const bird2YRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const targetBird2YRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight / 2 - GAME_CONFIG.birdHeight / 2 : 300);
  const bird2RotationRef = useRef<number>(0);
  const score2Ref = useRef<number>(0);
  const isOpponentDeadRef = useRef(false);
  const firstCrashedRef = useRef<'P1' | 'P2' | 'BOTH' | null>(null);

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

  // Component unmount cleanup hook to prevent camera track leak and peer leak!
  useEffect(() => {
    return () => {
      // 1. Stop all webcam tracks cleanly
      if (localStreamRef.current) {
        try {
          localStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {
          console.error("Error stopping track", e);
        }
        localStreamRef.current = null;
      }
      
      // 2. Destroy peer connection cleanly
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying peer", e);
        }
        peerRef.current = null;
      }

      // 3. Stop BGM loop
      AudioManager.getInstance().stopBGM();
    };
  }, []);

  // Load Saved Data
  useEffect(() => {
    const savedName = localStorage.getItem('noseroast_username');
    if (savedName) setUsername(savedName);

    const savedHighScore = localStorage.getItem('noseroast_highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));

    console.log(`Nose Roast v${APP_VERSION} - Built: ${BUILD_DATE}`);
  }, []);

  // Check URL parameter for automated online joining
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && !IS_NATIVE) {
      console.log('🔗 Automatic Join URL parsed. Joining room:', roomParam);
      setGameMode('DUO');
      setRoomCode(roomParam.toUpperCase());
      // Wait for landmarker/camera to initialize before connecting
      const timer = setInterval(() => {
        if (landmarkerRef.current && videoRef.current?.srcObject) {
          clearInterval(timer);
          joinDuelRoom(roomParam.toUpperCase());
        }
      }, 500);
      return () => clearInterval(timer);
    }
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

  // Initialize Face Tracking & Local Camera Feed in Parallel for 2x faster startup!
  useEffect(() => {
    const initTracking = async () => {
      // 1. Start camera request immediately without blocking model download
      const cameraPromise = (async () => {
        try {
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: isMobileDevice ? { ideal: 640 } : CAMERA_CONFIG.width,
              height: isMobileDevice ? { ideal: 480 } : CAMERA_CONFIG.height,
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

      // 2. Load neural network model concurrently
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
        // Wait for both concurrent operations (gracefully catching camera denial so model can still load)
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

  // Self-Healing Effect: Keep local camera stream attached to the video element even on mode/state transitions
  useEffect(() => {
    if (videoRef.current && localStreamRef.current && videoRef.current.srcObject !== localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
      videoRef.current.play().catch(e => console.error("Error auto-playing local stream:", e));
      console.log('🔗 Self-healing: Attached cached stream to local video element');
    }
  }, [gameState, gameMode, opponentStream, connectionStatus]);

  // Handle screen sizing
  useEffect(() => {
    const handleResize = () => setGameDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    score2Ref.current = 0;
    setScore(0);

    const dims = gameDimensionsRef.current;
    const initialY = dims.height / 2 - GAME_CONFIG.birdHeight / 2;

    birdYRef.current = initialY;
    targetBirdYRef.current = initialY;
    birdRotationRef.current = 0;

    bird2YRef.current = initialY;
    targetBird2YRef.current = initialY;
    bird2RotationRef.current = 0;

    calibrationNoseYRef.current = null;

    isLocalDeadRef.current = false;
    isOpponentDeadRef.current = false;
    firstCrashedRef.current = null;
    setFirstCrashed(null);

    pipesRef.current = [];

    lastPipeTimeRef.current = performance.now() - 1100; // First pipe spawns earlier (500ms after game start)
    gameStartTimeRef.current = performance.now();
    setCommentary('');
    speedRef.current = GAME_CONFIG.pipeSpeed;
    gapRef.current = GAME_CONFIG.pipeGap;
    setCurrentSpeed(GAME_CONFIG.pipeSpeed);
    setAdCountdown(1);
    
    // Ensure background music volume is fully restored to normal level
    AudioManager.getInstance().setBGMVolume(0.5);

    canvasRef.current?.clear();
  }, []);

  // --- WEBRTC NETWORKING LOGIC ---
  const createDuelRoom = async () => {
    setConnectionStatus('CREATING');
    setGameMode('DUO');

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);

    const p = new Peer(`noseroast-${code}`, {
      debug: 1,
      ...(USE_CUSTOM_SIGNALING ? {
        host: SIGNALING_HOST,
        port: SIGNALING_PORT,
        path: SIGNALING_PATH,
        secure: true
      } : {}),
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });
    peerRef.current = p;

    p.on('open', (id) => {
      setConnectionStatus('WAITING');
      console.log('✅ Host Peer generated with ID:', id);
    });

    p.on('connection', (conn) => {
      dataConnRef.current = conn;
      setConnectionStatus('CONNECTING');
      setupDataConnection(conn);
    });

    p.on('call', (call) => {
      console.log('📞 Received call from opponent. Answering...');
      call.answer(localStreamRef.current || undefined);
      mediaConnRef.current = call;

      // Enforce high-definition, high-bitrate WebRTC video channel quality!
      if (call.peerConnection) {
        boostStreamQuality(call.peerConnection);
      }

      call.on('stream', (remoteStream) => {
        console.log('📹 Opponent camera stream received!');
        setOpponentStream(remoteStream);
        setConnectionStatus('CONNECTED');
      });
    });

    p.on('error', (err) => {
      console.error('❌ Host Peer Error:', err);
      setConnectionStatus('ERROR');
      setErrorMessage('Failed to connect to signaling cloud.');
    });
  };

  const joinDuelRoom = async (code: string) => {
    setConnectionStatus('CONNECTING');
    setGameMode('DUO');
    setRoomCode(code);

    const clientCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const p = new Peer(`noseroast-client-${clientCode}`, {
      debug: 1,
      ...(USE_CUSTOM_SIGNALING ? {
        host: SIGNALING_HOST,
        port: SIGNALING_PORT,
        path: SIGNALING_PATH,
        secure: true
      } : {}),
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });
    peerRef.current = p;

    p.on('open', (id) => {
      console.log('✅ Client Peer generated with ID:', id);

      // 1. Establish data connection to Host
      const conn = p.connect(`noseroast-${code}`);
      dataConnRef.current = conn;
      setupDataConnection(conn);

      // 2. Establish video stream to Host
      if (localStreamRef.current) {
        console.log('📞 Stream dial-out to Host...');
        const call = p.call(`noseroast-${code}`, localStreamRef.current);
        mediaConnRef.current = call;

        // Enforce high-definition, high-bitrate WebRTC video channel quality!
        if (call.peerConnection) {
          boostStreamQuality(call.peerConnection);
        }

        call.on('stream', (remoteStream) => {
          console.log('📹 Remote Host camera received!');
          setOpponentStream(remoteStream);
          setConnectionStatus('CONNECTED');
        });
      }
    });

    p.on('error', (err) => {
      console.error('❌ Client Peer Error:', err);
      setConnectionStatus('ERROR');
      setErrorMessage('Could not connect to room. Double check Room Code.');
    });
  };

  const setupDataConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      console.log('🤝 WebRTC P2P Data Connection fully open!');
      setConnectionStatus('CONNECTED');
      // Exchange usernames as soon as data channel opens
      conn.send({ type: 'hello', name: username || 'ANONYMOUS' });
      // Show epic MATCH FOUND animation
      setShowMatchFound(true);
      setTimeout(() => setShowMatchFound(false), 3200);
    });

    conn.on('data', (data: any) => {
      if (data.type === 'hello') {
        setOpponentName((data.name as string)?.toUpperCase() || 'CHALLENGER');
        // Echo back our own name
        if (conn.open) conn.send({ type: 'hello', name: username || 'ANONYMOUS' });
      }
      else if (data.type === 'pos') {
        const dims = gameDimensionsRef.current;
        // Sync opponent's real-time position
        targetBird2YRef.current = data.y * dims.height;
        bird2RotationRef.current = data.rot;
        score2Ref.current = data.score;
      }
      else if (data.type === 'crash') {
        // Opponent crashed!
        isOpponentDeadRef.current = true;
        if (firstCrashedRef.current === null) {
          if (!isLocalDeadRef.current) {
            firstCrashedRef.current = 'P2'; // P2 (Opponent) crashed first!
          }
        }
        setShakeRight(true);
        setFlashRight(true);
        setTimeout(() => {
          setShakeRight(false);
          setFlashRight(false);
        }, 500);
        AudioManager.getInstance().playSound('crash');

        // Check if round ends (both dead)
        if (isLocalDeadRef.current && isOpponentDeadRef.current) {
          handleDuoGameOver();
        }
      }
      else if (data.type === 'spawn_pipe') {
        // Sync obstacles coordinates from Host
        const newPipe: InternalPipeState = {
          id: data.id,
          x: gameDimensionsRef.current.width / 2, // starts at client's relative right bounds
          topHeight: data.topHeight,
          gap: data.gap,
          passed: false,
          isMoving: data.isMoving,
          moveDirection: 1,
          moveSpeed: data.moveSpeed,
          baseTopHeight: data.topHeight,
          moveRange: data.moveRange,
        };
        pipesRef.current.push(newPipe);
      }
      else if (data.type === 'ping') {
        // Client side: receive ping and reply immediately with pong
        if (conn.open) {
          conn.send({ type: 'pong', sentAt: data.sentAt });
        }
      }
      else if (data.type === 'pong') {
        // Host side: receive pong, compute latency and sync start
        const latency = (performance.now() - data.sentAt) / 2;
        console.log(`⏱️ One-way network latency calculated: ${latency.toFixed(1)}ms`);
        
        const delay = Math.max(300, latency + 100);
        const relativeStart = delay + 3000;
        
        // Host sets its target start time
        gameStartTimeRef.current = performance.now() + relativeStart;
        startCountdownFlow(relativeStart);
        
        // Host tells client to start at the exact same target time
        if (conn.open) {
          conn.send({
            type: 'sync_start',
            relativeStart: relativeStart,
            latency: latency
          });
        }
      }
      else if (data.type === 'sync_start') {
        // Client side: receive synced target start time
        const targetRelative = data.relativeStart - data.latency;
        gameStartTimeRef.current = performance.now() + targetRelative;
        console.log(`🤝 Synced target start time. Starting in ${targetRelative.toFixed(1)}ms`);
        startCountdownFlow(targetRelative);
      }
      else if (data.type === 'retry') {
        console.log('🔄 Opponent clicked Play Again. Opponent is ready!');
        setIsOpponentReady(true);
        // If we are Host and are currently waiting, both players are ready—start the battle!
        if (connectionStatusRef.current === 'WAITING' || connectionStatusRef.current === 'CONNECTED') {
          if (peerRef.current && !peerRef.current.id.startsWith('noseroast-client-')) {
            setIsOpponentReady(false);
            startCameraAndGame();
          }
        }
      }
    });

    conn.on('close', () => {
      console.warn('❌ Partner disconnected from room.');
      setConnectionStatus('DISCONNECTED');
      setOpponentStream(null);
      if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'COUNTDOWN') {
        setGameState('START');
        alert('⚠️ Opponent disconnected. Returned to lobby.');
      }
    });
  };

  const startCameraAndGame = async () => {
    AudioManager.getInstance().unlock();

    if (gameMode === 'DUO') {
      // If we are Host, initiate ping-pong handshake to measure latency
      if (peerRef.current && !peerRef.current.id.startsWith('noseroast-client-')) {
        if (dataConnRef.current && dataConnRef.current.open) {
          console.log('📡 Host sending ping request...');
          dataConnRef.current.send({ type: 'ping', sentAt: performance.now() });
        }
        return;
      }
    }

    // Solo mode: start countdown immediately
    startCountdownFlow();
  };

  const startCountdownFlow = (countdownMs: number = 3000) => {
    resetGame();
    lastCountdownRef.current = -1;
    gameStartTimeRef.current = performance.now() + countdownMs;
    setGameCountdown(3);
    setGameState('COUNTDOWN');
    AudioManager.getInstance().playBGM();
  };

  const handleGameOver = useCallback((reason: string) => {
    const crashRoast = getCrashRoast();
    setCommentary(crashRoast);

    setGameState('AD_INTERSTITIAL');
    AudioManager.getInstance().stopBGM();
    AudioManager.getInstance().playSound('crash');
    
    // Speak the quick crash roast 250ms after the crash sound, loud and clear!
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
        
        // Speak the final performance roast when the scorecard displays
        setTimeout(() => {
          speakRoast(localRoast);
        }, 150);

        setHighScore(prev => {
          const newHigh = Math.max(prev, scoreRef.current);
          localStorage.setItem('noseroast_highscore', newHigh.toString());
          return newHigh;
        });
      }
    }, 1000);
  }, [speakRoast]);

  const handleDuoGameOver = useCallback(() => {
    AudioManager.getInstance().stopBGM();

    const p1Score = scoreRef.current;
    const p2Score = score2Ref.current;
    setFinalScoreP1(p1Score);
    setFinalScoreP2(p2Score);

    // If somehow firstCrashed is still null (both died simultaneously)
    if (firstCrashedRef.current === null) {
      firstCrashedRef.current = 'BOTH';
    }
    setFirstCrashed(firstCrashedRef.current);

    // Determine local victory
    let verdictSpoken = "";
    if (p1Score > p2Score) {
      setMatchVerdict('WIN');
      verdictSpoken = "Victory! You dominated the duel.";
    } else if (p1Score < p2Score) {
      setMatchVerdict('LOSE');
      verdictSpoken = "Defeat! You got absolutely clipped.";
    } else {
      setMatchVerdict('DRAW');
      verdictSpoken = "It is a tie! You both played equally bad.";
    }

    const finalDuoRoast = getDuoRoast(p1Score, p2Score);
    setCommentary(finalDuoRoast);
    setGameState('GAMEOVER');

    // Savagely announce match results and 1v1 roast!
    setTimeout(() => {
      speakRoast(`${verdictSpoken} ${finalDuoRoast}`);
    }, 300);

    // Omegle-style: auto search for next opponent after roast display
    let countdown = 8;
    setDuoRoastCountdown(countdown);
    const timer = setInterval(() => {
      countdown -= 1;
      setDuoRoastCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        setIsSearchingNext(true);
        // Destroy peer and start new room as host
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        setOpponentStream(null);
        setOpponentName('CHALLENGER');
        setConnectionStatus('DISCONNECTED');
        setMatchVerdict(null);
        setFirstCrashed(null);
        setGameState('START');
        setTimeout(() => {
          setIsSearchingNext(false);
        }, 500);
      }
    }, 1000);
  }, [speakRoast]);

  const handleRetry = useCallback(async () => {
    if (gameMode === 'DUO') {
      // Send retry click signal
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({ type: 'retry' });
      }

      if (isOpponentReady) {
        // Both players ready, initialize
        setIsOpponentReady(false);
        startCameraAndGame();
      } else {
        // Disabled waiting button
        setConnectionStatus('WAITING');
      }
      return;
    }

    // --- SOLO MODE: Mobile Capacitor and Admob logic ---
    if (IS_NATIVE) {
      let adDismissedResolve: () => void;
      const adDismissedPromise = new Promise<void>((resolve) => {
        adDismissedResolve = resolve;
      });

      const dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        console.log('Ad dismissed - starting game reset');
        adDismissedResolve();
      });

      try {
        await AdMobService.showInterstitial();
        console.log('Waiting for ad to be dismissed...');
        const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, 15000));
        await Promise.race([adDismissedPromise, timeoutPromise]);
      } catch (e) {
        console.error("Ad failed or timed out", e);
      } finally {
        await dismissListener.remove();
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      AdMobService.hideBanner();
    }

    // Reset Solo Game immediately
    console.log('Resetting game...');
    startCountdownFlow(3000);
  }, [gameMode, isOpponentReady, resetGame, startCameraAndGame]);

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

    // Handle countdown phase dynamically in requestAnimationFrame for driftless 1v1 starting synchronization
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

    const dims = gameDimensionsRef.current;
    const playWidth = gameMode === 'SOLO' ? dims.width : dims.width / 2;

    // Difficulty multiplier
    const elapsedSeconds = (currentTime - gameStartTimeRef.current) / 1000;
    const progress = Math.min(1, elapsedSeconds / DIFFICULTY_RAMP_SECONDS);
    speedRef.current = GAME_CONFIG.pipeSpeed + (DIFFICULTY_MAX_SPEED - GAME_CONFIG.pipeSpeed) * progress;
    gapRef.current = GAME_CONFIG.pipeGap - (GAME_CONFIG.pipeGap - DIFFICULTY_MIN_GAP) * progress;

    // Throttled React state update for real-time speedometer HUD
    if (currentTime - lastSpeedUpdateRef.current > 250) {
      lastSpeedUpdateRef.current = currentTime;
      setCurrentSpeed(speedRef.current);
    }

    // --- FACE TRACKING (Nose Y Position calculation) ---
    if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      const targetInterval = isMobileDevice ? 40 : FACE_DETECTION_CONFIG.detectionIntervalMs; // 40ms dynamic throttle on mobile, 0ms on PC
      if (currentTime - lastProcessTimeRef.current > targetInterval) {
        lastProcessTimeRef.current = currentTime;
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, currentTime);
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Auto-recalibrate if tracking was lost for more than 1.5 seconds to prevent violent snapping
            if (currentTime - lastFaceDetectedTimeRef.current > 1500 && lastFaceDetectedTimeRef.current > 0) {
              console.log("⚠️ Regained tracking after dropout. Auto-recalibrating!");
              calibrationNoseYRef.current = null;
            }
            lastFaceDetectedTimeRef.current = currentTime;

            const faceY = results.faceLandmarks[0][FACE_DETECTION_CONFIG.noseLandmarkIndex].y;
            
            if (gameStateRef.current === 'PLAYING') {
              // Auto-calibrate center nose Y position on the first detected frame when gameplay starts
              // This avoids calibration getting messed up if the user is looking down at their mouse to click start!
              if (calibrationNoseYRef.current === null) {
                calibrationNoseYRef.current = faceY;
              }
              
              // Calculate relative displacement from the calibrated center nose Y
              // Lower nose landmark coordinate (closer to 0) means head is raised (fly up)
              // Higher nose landmark coordinate (closer to 1) means head is lowered (fly down)
              const displacement = faceY - calibrationNoseYRef.current;
              
              // Map the displacement to screen movement
              // A sensitivity of 2.2 is highly comfortable and smooth
              const sensitivity = 2.2;
              const normalizedDisplacement = displacement * sensitivity;
              
              const centerY = dims.height / 2 - GAME_CONFIG.birdHeight / 2;
              const targetY = centerY + normalizedDisplacement * dims.height;
              
              targetBirdYRef.current = Math.max(0, Math.min(dims.height - GAME_CONFIG.birdHeight, targetY));
            } else {
              // During countdown, hold the bird smoothly in the middle of the screen
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

    // Smooth remote opponent bird interpolation (Duo Mode)
    if (gameMode === 'DUO' && !isOpponentDeadRef.current) {
      // Time-corrected exponential decay for remote player
      const remoteCoeff = 12.0; 
      const remoteLerp = 1 - Math.exp(-remoteCoeff * deltaSeconds);
      bird2YRef.current = bird2YRef.current + (targetBird2YRef.current - bird2YRef.current) * remoteLerp;
    }

    // Broadcast our local coordinates to opponent (DUO Mode) - Normalize coordinates for different screen heights
    if (gameMode === 'DUO' && connectionStatus === 'CONNECTED' && isGameRunning && !isLocalDeadRef.current) {
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          type: 'pos',
          y: birdYRef.current / dims.height,
          rot: birdRotationRef.current,
          score: scoreRef.current
        });
      }
    }

    // Stop physics update during countdown, but keep drawing
    if (!isGameRunning) {
      const p1Data: PlayerRenderData = { birdY: birdYRef.current, birdRotation: birdRotationRef.current, score: scoreRef.current, isDead: isLocalDeadRef.current };
      const p2Data: PlayerRenderData = { birdY: bird2YRef.current, birdRotation: bird2RotationRef.current, score: score2Ref.current, isDead: isOpponentDeadRef.current };
      canvasRef.current?.render(gameMode, p1Data, p2Data, pipesRef.current, highScore);
      return;
    }

    // --- PIPES SPAWNING ---
    // Only Host (Player 1) spawns pipes and broadcasts coordinates to Client (Player 2)
    const isHost = peerRef.current ? !peerRef.current.id.startsWith('noseroast-client-') : true;

    if (isHost) {
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

        // Sync with opponent
        if (gameMode === 'DUO' && dataConnRef.current && dataConnRef.current.open) {
          dataConnRef.current.send({
            type: 'spawn_pipe',
            id: newId,
            topHeight,
            gap: pipeGap,
            isMoving,
            moveSpeed,
            moveRange
          });
        }

        lastPipeTimeRef.current = currentTime;
      }
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

      // Vertical oscillation
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
    const p2Data: PlayerRenderData = { birdY: bird2YRef.current, birdRotation: bird2RotationRef.current, score: score2Ref.current, isDead: isOpponentDeadRef.current };
    canvasRef.current?.render(gameMode, p1Data, p2Data, pipesRef.current, highScore);
  }, [gameMode, connectionStatus, handleGameOver, handleDuoGameOver, highScore]);

  const triggerLocalCrash = () => {
    if (gameMode === 'SOLO') {
      handleGameOver("crashed");
    } else {
      isLocalDeadRef.current = true;
      if (firstCrashedRef.current === null) {
        if (!isOpponentDeadRef.current) {
          firstCrashedRef.current = 'P1'; // P1 (You) crashed first!
        }
      }
      setShakeLeft(true);
      setFlashLeft(true);
      setTimeout(() => {
        setShakeLeft(false);
        setFlashLeft(false);
      }, 500);
      AudioManager.getInstance().playSound('crash');

      // Send crash state to remote opponent
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          type: 'crash',
          score: scoreRef.current
        });
      }

      // If both dead, end round
      if (isLocalDeadRef.current && isOpponentDeadRef.current) {
        handleDuoGameOver();
      }
    }
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

  const showAds = !IS_NATIVE && ADSTERRA_CONFIG.enabled && gameMode === 'SOLO' && gameState === 'START';

  return (
    <div className={`flex h-screen w-screen overflow-hidden text-white font-inter select-none transition-all duration-700 relative ${gameState === 'START' ? 'mesh-gradient-bg' : 'bg-slate-950'}`}>
      
      {/* GLOBAL WEBCAM FEED BACKGROUND */}
      <div className="absolute inset-0 w-screen h-screen z-0 pointer-events-none flex flex-col lg:flex-row overflow-hidden bg-slate-950">
        {gameMode === 'SOLO' ? (
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
        ) : (
          <>
            {/* Left/Top Screen: Player 1 (Local) camera feed */}
            <div className={`w-full h-1/2 lg:w-1/2 lg:h-full relative overflow-hidden transition-all duration-300 local-camera-glow ${shakeLeft ? 'animate-shake' : ''} ${isHyperDrive ? 'hyper-drive-glow' : ''}`}>
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

            {/* Right/Bottom Screen: Player 2 (Remote Opponent) camera feed */}
            <div className={`w-full h-1/2 lg:w-1/2 lg:h-full relative overflow-hidden flex items-center justify-center transition-all duration-300 remote-camera-glow ${shakeRight ? 'animate-shake' : ''} ${isHyperDrive ? 'hyper-drive-glow' : ''}`}>
              {opponentStream ? (
                <video
                  ref={(el) => {
                    if (el && opponentStream && el.srcObject !== opponentStream) {
                      el.srcObject = opponentStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover webcam-feed-clear"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="text-white/30 text-xs font-game animate-pulse text-center leading-loose">
                  <p>WAITING FOR</p>
                  <p className="text-indigo-400">CHALLENGER STREAM...</p>
                </div>
              )}
              {isHyperDrive && renderSpeedLines()}
              {flashRight && <div className="absolute inset-0 bg-red-600 animate-flash-red z-10" />}
            </div>
          </>
        )}
      </div>

      {/* Left Skribbl ad banner (Desktop only) */}
      {showAds && (
        <div className="hidden lg:flex flex-col items-center justify-center w-[180px] h-full p-4 flex-shrink-0 z-20">
          <AdsterraAd id={ADSTERRA_CONFIG.sidebarHash} format="sidebar" />
        </div>
      )}

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-transparent">
        
        {/* UPPER VIEWPORT: HUD / WEBCAMS / CANVAS */}
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
              className="absolute pointer-events-none z-50 animate-score-alert text-center font-game font-black uppercase tracking-wider text-gradient-orange"
              style={{
                left: gameMode === 'SOLO' ? '50%' : (gameDimensions.width < gameDimensions.height ? '50%' : '25%'),
                top: gameMode === 'SOLO' ? '30%' : (gameDimensions.width < gameDimensions.height ? '15%' : '30%'),
                transform: 'translate(-50%, -50%)',
                fontSize: gameMode === 'SOLO' ? '28px' : '18px',
              }}
            >
              {scoreAlert.text}
            </div>
          )}

          {/* FPS Debug Counter */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute top-2 right-2 z-50 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
              FPS: {fps} | v{APP_VERSION}
            </div>
          )}

          {/* ? MATCH FOUND OVERLAY */}
          {showMatchFound && !IS_NATIVE && (
            <div className="absolute inset-0 z-[90] flex items-center justify-center"
              style={{ background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(12px)' }}>
              <div className="scan-sweep" />
              <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-emerald-400/60" />
              <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-emerald-400/60" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-emerald-400/60" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-emerald-400/60" />
              <div className="animate-match-reveal flex flex-col items-center gap-6 px-6 w-full max-w-md">
                <div className="animate-match-pulse bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl px-8 py-3 text-center">
                  <p className="text-emerald-300 text-[9px] font-game uppercase tracking-[0.5em] mb-1 animate-pulse">?? LIVE OPPONENT CONNECTED</p>
                  <p className="text-white text-2xl font-game font-black tracking-widest drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">MATCH FOUND!</p>
                </div>
                <div className="flex items-center justify-center gap-4 w-full">
                  <div className="animate-vs-left flex-1 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
                    <div className="text-3xl mb-2">??</div>
                    <p className="text-orange-300 text-[9px] font-game uppercase tracking-widest mb-1">YOU</p>
                    <p className="text-white font-game text-sm font-black truncate">{(username?.toUpperCase() || 'ANONYMOUS')}</p>
                  </div>
                  <div className="animate-vs-badge flex-shrink-0 w-14 h-14 rounded-full bg-slate-950 border-2 border-white/20 flex items-center justify-center shadow-2xl">
                    <span className="text-white font-game text-lg font-black">VS</span>
                  </div>
                  <div className="animate-vs-right flex-1 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 text-center">
                    <div className="text-3xl mb-2">??</div>
                    <p className="text-indigo-300 text-[9px] font-game uppercase tracking-widest mb-1">OPPONENT</p>
                    <p className="text-white font-game text-sm font-black truncate">{opponentName}</p>
                  </div>
                </div>
                <p className="text-white/60 text-[10px] font-game uppercase tracking-[0.3em] animate-pulse">?? Preparing Battle Arena...</p>
              </div>
            </div>
          )}

          {/* HUD Accents */}
          {gameState === 'PLAYING' && (
            <div className="absolute top-24 inset-x-0 flex flex-col items-center gap-3 z-30 pointer-events-none">
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
              
              {/* Hyper-Drive Banner Overlay */}
              {isHyperDrive && (
                <div className="bg-gradient-to-r from-red-600 via-orange-500 to-indigo-600 px-6 py-2 rounded-full border-2 border-white shadow-2xl animate-hyper-text text-white text-[10px] font-game font-black tracking-widest flex items-center gap-2">
                  <span>⚡</span> HYPER DRIVE ACTIVATED! <span>⚡</span>
                </div>
              )}
            </div>
          )}

          {/* Duo Online Connection Warning Banner */}
          {gameState === 'PLAYING' && gameMode === 'DUO' && connectionStatus !== 'CONNECTED' && (
            <div className="absolute top-24 inset-x-0 flex justify-center z-30 pointer-events-none">
              <div className="bg-red-500 text-white text-xs px-6 py-2 rounded-full font-game shadow-lg animate-pulse border-2 border-slate-950">
                ⚠️ CONNECTION INTERRUPTED! ATTEMPTING RECONNECT...
              </div>
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
                  <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl floating-blob" style={{ animationDelay: '-8s' }} />
                </div>

                {/* Centered content wrapper that dynamically scrolls and prevents scaling/cutoff issues */}
                <div className="my-auto w-full max-w-sm flex flex-col items-center flex-shrink-0 relative">

                  {/* Logo Section */}
                  <div className="relative mb-1.5 sm:mb-3 animate-float">
                  <div className="w-14 h-14 sm:w-28 sm:h-28 bg-gradient-to-br from-orange-500 via-red-500 to-indigo-500 rounded-[1.1rem] sm:rounded-[2.2rem] p-1 shadow-2xl shadow-orange-500/30 hover:rotate-6 transition-all duration-300">
                    <div className="w-full h-full bg-slate-950 rounded-[0.95rem] sm:rounded-[2rem] flex items-center justify-center overflow-hidden">
                      <img src="/logo.png" alt="Nose Roast" className="w-[110%] h-[110%] object-contain hover:scale-105 transition-transform duration-300" />
                    </div>
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-gradient-to-r from-red-500 to-indigo-500 text-white text-[7px] sm:text-[8px] font-black px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-lg animate-bounce">🔥 DUEL</div>
                </div>

                {/* Title */}
                <h1 className="text-2xl sm:text-4xl font-game text-white tracking-tight leading-none mb-0.5 sm:mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]">
                  NOSE<span className="text-gradient-orange">ROAST</span>
                </h1>
                <p className="text-white/95 text-[9px] sm:text-[11px] uppercase font-extrabold tracking-[0.16em] mb-2 sm:mb-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Fly with your face • Live Online P2P Matchmaking</p>

                {/* Glass Main UI Container */}
                <div className="w-full max-w-sm p-3.5 sm:p-6 glass-panel glass-panel-animated rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-2xl flex flex-col items-center flex-shrink-0">
                  
                  {/* Username Input */}
                  <div className="w-full mb-2 sm:mb-4 relative">
                    <p className="text-white/90 text-[9px] sm:text-[11px] uppercase tracking-[0.15em] mb-1 sm:mb-2 font-black text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">Your Duelist Name</p>
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

                  {/* Game Mode Selector — Online Duel is web-only */}
                  <div className="w-full mb-2 sm:mb-4">
                    <p className="text-white/90 text-[9px] sm:text-[11px] uppercase tracking-[0.15em] mb-1 sm:mb-2 font-black text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">Select Game Mode</p>
                    <div className={`grid gap-1.5 p-1 bg-slate-950/40 border border-white/8 rounded-full ${IS_NATIVE ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <button
                        onClick={() => { setGameMode('SOLO'); setConnectionStatus('DISCONNECTED'); }}
                        className={`genz-tab py-1.5 sm:py-2 px-3 sm:px-4 rounded-full text-[10px] sm:text-[11px] font-game transition-all duration-300 ${
                          gameMode === 'SOLO'
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20 font-bold scale-102'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        🎯 SOLO PLAY
                      </button>
                      {/* Online Duel — Web Only (WebRTC/P2P not supported in native build) */}
                      {!IS_NATIVE && (
                        <button
                          onClick={() => { setGameMode('DUO'); setConnectionStatus('DISCONNECTED'); }}
                          className={`genz-tab py-1.5 sm:py-2 px-3 sm:px-4 rounded-full text-[10px] sm:text-[11px] font-game transition-all duration-300 ${
                            gameMode === 'DUO'
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20 font-bold scale-102'
                              : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          👥 ONLINE DUEL
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Roastmaster Voice Personality Selector */}
                  <div className="w-full mb-2 sm:mb-4">
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
                        title="Deep, resonant sarcastic tone (Default)"
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
                        title="High-energy, fast-speaking critic"
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
                        title="Slow, monotone deadpan robot critic"
                      >
                        😴 DEADPAN
                      </button>
                    </div>
                  </div>

                  {/* Matchmaking Lobby Block (Only shown in DUO Mode) */}
                  {gameMode === 'DUO' && (
                    <div className="w-full mt-1.5 p-3 bg-slate-950/40 border border-white/5 rounded-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none animate-pulse" />
                      <h3 className="text-[9px] sm:text-[10px] font-game text-indigo-400 mb-2.5 sm:mb-4 tracking-wider flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                        <span>👥 DUEL MATCHMAKING</span>
                      </h3>

                      {connectionStatus === 'DISCONNECTED' && (
                        <div className="space-y-2.5">
                          <button
                            onClick={createDuelRoom}
                            className="btn-premium btn-premium-indigo w-full text-white py-2 px-5 rounded-full text-[10px] sm:text-[11px] shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/30"
                          >
                            ⚔️ HOST BATTLE ROOM
                          </button>

                          <div className="relative flex py-0.5 items-center">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink mx-3 text-white/70 text-[9px] uppercase tracking-[0.25em] font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">OR</span>
                            <div className="flex-grow border-t border-white/10"></div>
                          </div>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                              placeholder="ROOM CODE..."
                              maxLength={5}
                              className="flex-1 bg-slate-950/45 border border-white/10 rounded-full px-3 py-1.5 text-white text-center text-xs font-extrabold uppercase placeholder-white/45 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_12px_rgba(99,102,241,0.2)] transition-all"
                            />
                            <button
                              onClick={() => joinCodeInput.trim() && joinDuelRoom(joinCodeInput.trim())}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-game transition-all active:scale-95 shadow-md shadow-emerald-500/20 font-black hover:scale-103"
                            >
                              JOIN
                            </button>
                          </div>
                        </div>
                      )}

                      {connectionStatus === 'CREATING' && (
                        <div className="py-2.5 text-center">
                          <div className="w-6 h-6 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-[10px] sm:text-[11px] font-game text-indigo-400 uppercase animate-pulse">Creating battle chamber...</p>
                        </div>
                      )}

                      {connectionStatus === 'WAITING' && (
                        <div className="py-1 text-center space-y-2.5">
                          <p className="text-[10px] sm:text-[11px] font-game text-gradient-rainbow uppercase font-bold animate-pulse">Chamber Ready! Code:</p>
                          <div className="bg-slate-950 border border-indigo-500/30 py-2 rounded-xl text-xl sm:text-3xl font-game tracking-widest text-yellow-400 select-all cursor-pointer shadow-[inset_0_4px_15px_rgba(0,0,0,0.65)] hover:border-yellow-500/40 transition-colors duration-300">
                            {roomCode}
                          </div>
                          <p className="text-[9px] sm:text-[11px] text-white/80 font-bold px-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                            Invite opponent to join:
                          </p>
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
                              navigator.clipboard.writeText(link);
                              alert('📋 Copied battle invite link to clipboard!');
                            }}
                            className="bg-slate-950/80 hover:bg-indigo-500/20 text-indigo-200 py-1.5 px-3 border border-indigo-500/30 hover:border-indigo-500/50 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1 mx-auto shadow-md"
                          >
                            <Copy size={10} className="text-indigo-400" /> Copy Battle Invite Link
                          </button>
                          <div className="pt-1 text-center">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-1.5" />
                            <p className="text-[9px] uppercase tracking-[0.12em] font-black text-indigo-300 animate-pulse">Waiting for stream...</p>
                          </div>
                        </div>
                      )}

                      {connectionStatus === 'CONNECTING' && (
                        <div className="py-2.5 text-center">
                          <div className="w-6 h-6 border-3 border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-[10px] sm:text-[11px] font-game text-indigo-400 uppercase animate-pulse">Dialing live streams...</p>
                        </div>
                      )}

                      {connectionStatus === 'CONNECTED' && (
                        <div className="py-1 text-center space-y-2.5">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[10px] font-game">LIVE STREAM ACTIVE!</span>
                          </div>
                          
                          {peerRef.current?.id.startsWith('noseroast-client-') ? (
                            <div className="bg-slate-950/60 py-2.5 px-3 rounded-xl border border-white/5 shadow-inner">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-indigo-300 font-game animate-pulse drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">Waiting for Host stream...</p>
                            </div>
                          ) : (
                            <button
                              onClick={startCameraAndGame}
                              className="btn-premium btn-premium-orange w-full text-white py-2 px-5 rounded-full text-[11px] shadow-xl shadow-orange-500/30"
                            >
                              ⚔️ INITIATE BATTLE
                            </button>
                          )}
                        </div>
                      )}

                      {connectionStatus === 'ERROR' && (
                        <div className="py-2 text-center space-y-3">
                          <p className="text-[11px] font-game text-red-500 uppercase">Lobby Error</p>
                          <p className="text-[11px] text-red-200/80 leading-relaxed font-semibold px-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{errorMessage}</p>
                          <button
                            onClick={() => setConnectionStatus('DISCONNECTED')}
                            className="bg-white/10 hover:bg-white/15 text-white py-2 px-6 rounded-full text-[10px] font-game"
                          >
                            BACK TO LOBBY
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Classic SOLO Play Button */}
                  {gameMode === 'SOLO' && (
                    <button onClick={startCameraAndGame} className="btn-premium btn-premium-orange text-white px-12 py-3.5 mt-2 rounded-full text-base shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 w-full justify-center">
                      <div className="flex items-center gap-3"><Play fill="currentColor" size={16} /><span>SOLO PLAY</span></div>
                    </button>
                  )}

                </div>

                {highScore > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-white/90 text-[10px] sm:text-xs font-semibold bg-slate-950/45 backdrop-blur-lg px-4 py-1 rounded-full border border-white/8 shadow-md">
                    <TrendingUp size={12} className="text-yellow-400" />
                    <span>Personal Record: <span className="text-yellow-400 font-bold">{highScore}</span></span>
                  </div>
                )}

                {/* Footer and Security notice */}
                <div className="mt-3 p-2.5 sm:p-3.5 bg-slate-950/45 backdrop-blur-lg border border-white/8 rounded-xl sm:rounded-2xl shadow-xl flex flex-col items-center gap-2 sm:gap-3 w-full max-w-[280px] sm:max-w-[320px]">
                  <div className="flex items-center gap-1 text-white/95 text-[9px] sm:text-[11px] font-extrabold text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                    <ShieldCheck size={12} className="text-emerald-400 flex-shrink-0 animate-pulse" />
                    <span>Local face-tracking only — zero storage & 100% private</span>
                  </div>
                  
                  <div className="flex items-center justify-between w-full border-t border-white/5 pt-2 sm:pt-3">
                    <button 
                      onClick={() => IS_NATIVE ? setShowPrivacy(true) : window.open(PRIVACY_URL, '_blank')} 
                      className="text-white/80 hover:text-orange-400 text-[9px] sm:text-[11px] font-black transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                    >
                      🔒 Privacy Policy
                    </button>
                    
                    {!IS_NATIVE && (
                      <a
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-slate-950/60 hover:bg-emerald-500/10 text-white px-2.5 py-1 border border-white/10 hover:border-emerald-500/30 rounded-lg text-[10px] transition-all shadow-md active:scale-95 group"
                      >
                        <svg viewBox="0 0 512 512" className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform duration-300" fill="currentColor">
                          <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58 33.1-60.7-60.7 60.1-60.1 58.6 33.6c18.7 10.7 24.7 33.6 14.1 52.3-3.4 6-8.1 10.8-14.1 11.8zM325.3 277.7l60.1 60.1L104.6 499l220.7-221.3z"/>
                        </svg>
                        <div className="text-left leading-tight">
                          <p className="text-[6px] text-white/50 uppercase tracking-widest font-bold">Get it on</p>
                          <p className="text-[8px] font-black text-white group-hover:text-emerald-400 transition-colors">Google Play</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
                
                </div> {/* End of Centered Content Wrapper */}
              </div>

              {/* Native footer spacing for banner ads */}
              {IS_NATIVE && <div className="w-full h-14 bg-slate-950/90 border-t border-white/5 flex-shrink-0" />}
            </div>
          )}

          {/* AD INTERSTITIAL (Only for single player) */}
          {gameState === 'AD_INTERSTITIAL' && (
            <div className="absolute inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-full h-80 bg-slate-900 rounded-[3rem] border-4 border-white/5 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center font-game text-2xl text-white">{adCountdown}</div>
                </div>
                <p className="text-white/60 font-medium text-sm italic px-10">"{preRoastText}"</p>
              </div>
              <p className="mt-10 text-white/20 text-[8px] font-black uppercase tracking-[0.6em] animate-pulse">Judging your lack of talent...</p>
            </div>
          )}

          {/* COUNTDOWN SCREEN */}
          {gameState === 'COUNTDOWN' && (
            <div className="absolute inset-0 z-[55] flex flex-col items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-slate-950/75" />
              
              {/* Calibration crosshair target overlay to direct streamer gaze */}
              <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center pulse-ring-glow">
                  <div className="w-40 h-40 border border-orange-500/30 rounded-full calibration-reticle flex items-center justify-center">
                    <div className="w-full h-[1px] bg-orange-500/20 absolute" />
                    <div className="h-full w-[1px] bg-orange-500/20 absolute" />
                    <div className="w-24 h-24 border border-orange-500/40 rounded-full flex items-center justify-center">
                      <div className="w-12 h-12 border-2 border-orange-500/60 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.85)]" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-full mt-4 text-[8px] font-game text-orange-400 tracking-[0.25em] bg-slate-950/80 border border-orange-500/20 px-3.5 py-1.5 rounded-full uppercase shadow-lg whitespace-nowrap">
                    Align nose to target
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />

              <div className="relative flex flex-col items-center justify-center mt-36">
                <div className="text-[12rem] font-game text-white drop-shadow-2xl glow-pulse countdown-pop" style={{ lineHeight: '1' }}>
                  {gameCountdown > 0 ? gameCountdown : 'GO!'}
                </div>
                <p className="text-2xl font-game text-orange-400 mt-6 uppercase tracking-[0.4em]" style={{ textShadow: '0 0 30px rgba(249, 115, 22, 0.6)' }}>
                  {gameCountdown > 0 ? 'GET READY' : 'FLY NOW!'}
                </p>
                <p className="text-white/50 text-xs mt-8 max-w-xs text-center font-medium">
                  Nod and move your nose up & down to fly
                </p>
              </div>
            </div>
          )}

          {/* GAMEOVER SCREEN */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 mesh-gradient-bg flex flex-col items-center justify-center z-[70] text-center text-white overflow-hidden">
              
              {/* Floating blur blobs for premium depth */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl floating-blob animate-pulse" />
                <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl floating-blob" style={{ animationDelay: '-4s' }} />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-6 px-4 w-full relative z-10">
                
                {/* 1v1 DUEL SPECIFIC MATCH VERDICT */}
                {gameMode === 'DUO' ? (
                  <div className="w-full max-w-lg mx-auto py-2">

                    {/* === EPIC VERDICT HEADER === */}
                    <div className="text-center mb-2.5 sm:mb-4 animate-verdict-pop">
                      {matchVerdict === 'WIN' && (
                        <div>
                          <div className="text-4xl sm:text-5xl animate-crown inline-block">👑</div>
                          <h2 className="text-2xl sm:text-3xl font-game text-emerald-400 tracking-wider drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">
                            YOU DOMINATED!
                          </h2>
                          <p className="text-emerald-300/70 text-[9px] sm:text-[10px] font-game uppercase tracking-[0.3em] mt-0.5">Victory Royale • Nose Edition</p>
                        </div>
                      )}
                      {matchVerdict === 'LOSE' && (
                        <div>
                          <div className="text-4xl sm:text-5xl animate-bounce inline-block">💀</div>
                          <h2 className="text-2xl sm:text-3xl font-game text-red-500 tracking-wider glitch-text drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                            GET CLIPPED!
                          </h2>
                          <p className="text-red-400/70 text-[9px] sm:text-[10px] font-game uppercase tracking-[0.3em] mt-0.5">Your nose betrayed you</p>
                        </div>
                      )}
                      {matchVerdict === 'DRAW' && (
                        <div>
                          <div className="text-4xl sm:text-5xl animate-bounce inline-block">🤝</div>
                          <h2 className="text-2xl sm:text-3xl font-game text-yellow-400 tracking-wider drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">
                            BOTH LOST TBH
                          </h2>
                          <p className="text-yellow-300/70 text-[9px] sm:text-[10px] font-game uppercase tracking-[0.3em] mt-0.5">Synchronized disappointment</p>
                        </div>
                      )}
                    </div>

                    {/* === SPLIT PLAYER CARDS === */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2.5 sm:mb-4">
                      {/* YOU panel */}
                      <div className={`glass-panel p-3 sm:p-4 rounded-2xl sm:rounded-3xl relative overflow-hidden flex flex-col items-center ${
                        matchVerdict === 'WIN' ? 'winner-panel' : matchVerdict === 'LOSE' ? 'loser-panel' : 'glass-card-glow-orange'
                      }`}>
                        {matchVerdict === 'WIN' && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                        )}
                        {matchVerdict === 'LOSE' && (
                          <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />
                        )}
                        <span className="text-[9px] uppercase tracking-widest text-orange-300 font-black mb-1 truncate max-w-full">
                          {username?.toUpperCase() || 'YOU'}
                        </span>
                        <div className={`text-4xl sm:text-5xl font-game font-black mt-1 ${
                          matchVerdict === 'WIN' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                          : matchVerdict === 'LOSE' ? 'text-red-400' : 'text-white'
                        }`}>{finalScoreP1}</div>
                        <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold mt-1">PIPES</span>
                        {matchVerdict === 'WIN' && <div className="text-sm mt-1">🏆</div>}
                        {matchVerdict === 'LOSE' && <div className="text-sm mt-1">💀</div>}
                        <div className={`mt-2 text-[7px] sm:text-[8px] font-game uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          firstCrashed === 'P1' ? 'bg-red-500/20 text-red-400' :
                          firstCrashed === 'P2' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {firstCrashed === 'P1' ? '💥 CRASHED FIRST' : firstCrashed === 'P2' ? '⚡ SURVIVED LONGER' : '💥 SIMULTANEOUS'}
                        </div>
                      </div>

                      {/* OPPONENT panel */}
                      <div className={`glass-panel p-3 sm:p-4 rounded-2xl sm:rounded-3xl relative overflow-hidden flex flex-col items-center ${
                        matchVerdict === 'LOSE' ? 'winner-panel' : matchVerdict === 'WIN' ? 'loser-panel' : 'glass-card-glow-indigo'
                      }`}>
                        {matchVerdict === 'LOSE' && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                        )}
                        {matchVerdict === 'WIN' && (
                          <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />
                        )}
                        <span className="text-[9px] uppercase tracking-widest text-indigo-300 font-black mb-1 truncate max-w-full">
                          {opponentName}
                        </span>
                        <div className={`text-4xl sm:text-5xl font-game font-black mt-1 ${
                          matchVerdict === 'LOSE' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                          : matchVerdict === 'WIN' ? 'text-red-400' : 'text-white'
                        }`}>{finalScoreP2}</div>
                        <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold mt-1">PIPES</span>
                        {matchVerdict === 'LOSE' && <div className="text-sm mt-1">🏆</div>}
                        {matchVerdict === 'WIN' && <div className="text-sm mt-1">💀</div>}
                        <div className={`mt-2 text-[7px] sm:text-[8px] font-game uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          firstCrashed === 'P2' ? 'bg-red-500/20 text-red-400' :
                          firstCrashed === 'P1' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {firstCrashed === 'P2' ? '💥 CRASHED FIRST' : firstCrashed === 'P1' ? '⚡ SURVIVED LONGER' : '💥 SIMULTANEOUS'}
                        </div>
                      </div>
                    </div>

                    {/* === ROAST VERDICT === */}
                    <div className="glass-panel p-3 sm:p-4 mb-2.5 sm:mb-3 rounded-xl sm:rounded-2xl border border-orange-500/20 shadow-lg">
                      <p className="text-orange-400 text-[8px] sm:text-[9px] font-game uppercase tracking-widest mb-1 flex items-center justify-center gap-1">🔥 AI ROAST MASTER 🔥</p>
                      <p className="text-white/90 font-medium text-[11px] sm:text-xs italic leading-relaxed text-center">"{commentary}"</p>
                    </div>

                    {/* === OMEGLE AUTO-NEXT COUNTDOWN === */}
                    <div className="glass-panel p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-indigo-500/20 text-center animate-searching">
                      <div className="flex items-center justify-center gap-2 sm:gap-3">
                        <div className="w-5 h-5 sm:w-7 sm:h-7 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-indigo-300 text-[9px] sm:text-[10px] font-game uppercase tracking-widest">🎰 Finding next opponent...</p>
                          <p className="text-white/40 text-[8px] sm:text-[9px] mt-0.5">Auto in <span className="text-white font-black">{duoRoastCountdown}s</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Classic Single Player Header */}
                    <div className="w-full mb-3">
                      <h2 className="text-2xl font-game mb-1 tracking-tight">
                        {score >= highScore && score > 0 ? '🏆 NEW RECORD!' : 'GAME OVER'}
                      </h2>
                      <p className="text-white/50 text-xs">
                        {score >= highScore && score > 0 ? 'You absolutely crushed your high score!' : 'Wipe that nose and try again!'}
                      </p>
                    </div>

                    {/* RoastCard */}
                    <div className="flex-shrink-0" style={{ transform: 'scale(1.0)', transformOrigin: 'center center' }}>
                      <RoastCard score={score} highScore={highScore} roast={commentary} username={username} ref={cardRef} />
                    </div>
                  </>
                )}

                {/* Control Action Buttons */}
                <div className="w-full max-w-xs space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                  {gameMode === 'DUO' && connectionStatus === 'WAITING' ? (
                    <button disabled className="w-full flex items-center justify-center gap-2 bg-indigo-500/30 border border-indigo-500/40 text-white/50 py-3 sm:py-4 px-5 sm:px-6 rounded-full text-[13px] sm:text-base font-game cursor-not-allowed">
                      <Loader2 className="animate-spin" size={16} />
                      <span>WAITING FOR PARTNER...</span>
                    </button>
                  ) : (
                    <button onClick={handleRetry} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 py-2.5 sm:py-3.5 px-5 sm:px-6 rounded-full text-base sm:text-lg font-game transition-all transform active:scale-95 shadow-xl shadow-emerald-500/30">
                      <RefreshCw size={16} />
                      <span>{gameMode === 'DUO' ? 'PLAY AGAIN 👥' : 'PLAY AGAIN'}</span>
                    </button>
                  )}

                  {gameMode === 'SOLO' && (
                    <>
                      <button onClick={shareRoast} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 py-2.5 sm:py-3 px-5 sm:px-6 rounded-full text-sm sm:text-base font-game transition-all transform active:scale-95 shadow-xl shadow-indigo-500/30">
                        {isSharing ? <Loader2 className="animate-spin" size={16} /> : <><Share2 size={14} /><span>SHARE ROAST</span></>}
                      </button>
                      <button
                        onClick={() => {
                          resetGame();
                          setGameState('START');
                        }}
                        className="w-full py-2.5 sm:py-3 bg-slate-900/60 hover:bg-slate-850 rounded-full font-game text-[10px] sm:text-[11px] font-black tracking-widest text-white/70 border border-white/5 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                      >
                        🚪 LOBBY MENU
                      </button>
                    </>
                  )}

                  {gameMode === 'DUO' && (
                    <button
                      onClick={() => {
                        // Reset and disconnect peer cleanly
                        resetGame();
                        if (peerRef.current) {
                          peerRef.current.destroy();
                          peerRef.current = null;
                        }
                        setGameMode('SOLO');
                        setGameState('START');
                        setConnectionStatus('DISCONNECTED');
                      }}
                      className="w-full py-3 text-white/55 hover:text-white text-xs uppercase font-bold tracking-widest transition-colors"
                    >
                      Back to Solo Lobby
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom ads spaces */}
              {IS_NATIVE && <div className="h-14 flex-shrink-0 bg-slate-950/90 border-t border-white/5 w-full" />}
            </div>
          )}

          {/* CAMERA PERMISSION MODAL */}
          {showPermissionError && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-8">
              <div className="w-full bg-red-950/20 border-2 border-red-500/50 p-8 rounded-[3rem] text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
                <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><CameraOff size={40} className="text-red-500" /></div>
                <h3 className="text-2xl font-game text-white mb-4">ACCESS DENIED</h3>
                <p className="text-red-200/60 text-xs leading-relaxed mb-6 px-4">NoseRoast AI requires camera permissions to track your nose Y-coordinates. Click the Camera icon in address bar to allow.</p>
                <button onClick={startCameraAndGame} className="bg-white text-slate-950 font-black uppercase tracking-widest py-4 px-8 rounded-full hover:scale-103 transition-transform text-xs">Retry Access</button>
              </div>
            </div>
          )}

          {/* LOADING SCREEN */}
          {gameState === 'LOADING' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100] text-white">
              <div className="relative"><div className="w-20 h-20 border-8 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-6" /><div className="absolute inset-0 flex items-center justify-center font-black text-orange-400 text-xs">AI</div></div>
              <p className="text-[9px] font-game tracking-[0.5em] text-white/40 animate-pulse uppercase">Waking up neural coordinate sensors...</p>
              <p className="text-[8px] text-white/20 mt-2">v{APP_VERSION}</p>
            </div>
          )}

          {/* PRIVACY POLICY MODAL */}
          {showPrivacy && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-6">
              <div className="w-full max-h-[80vh] bg-slate-900 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                  <h3 className="text-base font-game text-white">PRIVACY POLICY</h3>
                  <button onClick={() => setShowPrivacy(false)} className="text-white/50 hover:text-white text-xl px-2">&times;</button>
                </div>
                <div className="p-5 overflow-y-auto text-white/80 text-xs leading-relaxed flex-1">
                  <p className="mb-2 font-semibold text-orange-400">1. Information We Process</p>
                  <p className="mb-4">All facial tracking and camera feed computations are run entirely locally on your browser. We never transmit, store, or share your camera images. High scores and user names are stored locally on your own device storage.</p>
                  <p className="mb-2 font-semibold text-orange-400">2. Multiplayer Streams</p>
                  <p className="mb-4">In Online Duel mode, your video stream is sent directly to your matched peer over an encrypted direct WebRTC channel. Video data is P2P and never records on any servers.</p>
                </div>
                <div className="p-4 border-t border-white/10 bg-slate-950/50 text-center flex justify-center">
                  <button onClick={() => setShowPrivacy(false)} className="bg-orange-500 hover:bg-orange-600 text-white font-game px-8 py-3 rounded-full w-full max-w-[200px] transition-colors shadow-lg">I UNDERSTAND</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM AD BANNER PLACEHOLDER (Skribbl-style, web only) */}
        {/* BOTTOM AD BANNER PLACEHOLDER (Skribbl-style, web only) */}
        {showAds && (
          <div className="w-full h-[95px] bg-slate-950/20 backdrop-blur-[2px] border-t border-white/5 flex flex-col items-center justify-center flex-shrink-0 p-1.5 z-20">
            <AdsterraAd id={ADSTERRA_CONFIG.bannerHash} format="banner" />
          </div>
        )}
      </div>

      {/* Right Skribbl ad banner (Desktop only) */}
      {showAds && (
        <div className="hidden lg:flex flex-col items-center justify-center w-[180px] h-full p-4 flex-shrink-0 z-20">
          <AdsterraAd id={ADSTERRA_CONFIG.sidebarHash} format="sidebar" />
        </div>
      )}
    </div>
  );
};

export default App;
