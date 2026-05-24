import { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
  width: 400,
  height: 600,
  pipeWidth: 70,
  pipeGap: 220, // Good starting gap
  pipeSpeed: 5.8, // Faster starting speed for instant high-stakes action
  birdWidth: 44,
  birdHeight: 36,
};

export const DIFFICULTY_MAX_SPEED = 10.5; // Max speed at hardest difficulty
export const DIFFICULTY_MIN_GAP = 135; // Minimum gap - tighter for skilled players!
export const DIFFICULTY_RAMP_SECONDS = 25; // Ramps to max difficulty in 25 seconds for rapid challenge!

export const INITIAL_BIRD_Y = 300;

// Camera quality settings - High quality for display, optimized for detection
export const CAMERA_CONFIG = {
  // Enforce high-definition capture while remaining extremely compatible across mobile and older webcams
  width: { min: 640, ideal: 1920 },
  height: { min: 480, ideal: 1080 },
  frameRate: { ideal: 60, max: 120 }, // High refresh rate camera feed
  facingMode: 'user' as const,
  // Processing resolution (lower for face detection performance)
  processWidth: 640,
  processHeight: 480,
};

// Face detection optimization
export const FACE_DETECTION_CONFIG = {
  // Run detection on every single frame for ultra-responsiveness at 60/120 FPS
  detectionIntervalMs: 0,
  // Buttery-smooth interpolation factor (reduces camera noise perfectly)
  positionSmoothing: 0.35,
  // Nose landmark index in MediaPipe
  noseLandmarkIndex: 4,
  // Detection region of interest (crop to face area for speed)
  roiScale: 0.6,
};

// Game loop optimization
export const GAME_LOOP_CONFIG = {
  targetFps: 120, // Target high refresh rate displays
  maxDeltaTime: 1000 / 30, // Prevent huge jumps on lag spikes
  vsync: true,
};

// Adsterra Ad Unit Configurations
export const ADSTERRA_CONFIG = {
  enabled: true, // Set to false to disable ad units completely
  bannerHash: 'c4e5140d39bc15f8a0058b8f2762a4f6', // Placeholder hash: USER will replace this with their actual 728x90 banner hash
  sidebarHash: 'f69e6b45a0b9432f8b05da39b56f8a4e', // Placeholder hash: USER will replace this with their actual 160x600 skyscraper hash
};
