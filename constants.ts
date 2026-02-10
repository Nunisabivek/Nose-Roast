
import { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
  width: 400,
  height: 600,
  pipeWidth: 70,
  pipeGap: 220, // Good starting gap
  pipeSpeed: 3.8, // Faster starting speed
  birdWidth: 44,
  birdHeight: 36,
};

export const DIFFICULTY_MAX_SPEED = 8.0; // Max speed at hardest difficulty
export const DIFFICULTY_MIN_GAP = 160; // Minimum gap - never smaller than this!
export const DIFFICULTY_RAMP_SECONDS = 60; // 1 minute to reach max difficulty

export const INITIAL_BIRD_Y = 300;

// Camera quality settings - High quality for display, optimized for detection
export const CAMERA_CONFIG = {
  // High resolution for video display
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 60, max: 60 },
  facingMode: 'user' as const,
  // Processing resolution (lower for face detection performance)
  processWidth: 640,
  processHeight: 480,
};

// Face detection optimization
export const FACE_DETECTION_CONFIG = {
  // Run detection at 60 FPS for smoother tracking
  detectionIntervalMs: 16, // ~60 FPS
  // Smooth interpolation factor (higher = smoother but more latency)
  positionSmoothing: 0.25,
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

