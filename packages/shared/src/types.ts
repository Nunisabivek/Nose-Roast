export type GameState = 'START' | 'PLAYING' | 'AD_INTERSTITIAL' | 'GAMEOVER' | 'LOADING' | 'COUNTDOWN';

// Canvas-optimized pipe data (simplified for performance)
export interface PipeData {
  x: number;
  topHeight: number;
  gap: number;
  isMoving: boolean;
  baseTopHeight: number;
  moveDirection: 1 | -1;
  moveSpeed: number;
  moveRange: number;
}

export interface GameConfig {
  width: number;
  height: number;
  pipeWidth: number;
  pipeGap: number;
  pipeSpeed: number;
  birdWidth: number;
  birdHeight: number;
}

// Camera configuration types
export interface CameraConfig {
  width: { ideal: number; min: number };
  height: { ideal: number; min: number };
  frameRate: { ideal: number; max: number };
  facingMode: 'user' | 'environment';
  processWidth: number;
  processHeight: number;
}

// Face detection configuration
export interface FaceDetectionConfig {
  detectionIntervalMs: number;
  positionSmoothing: number;
  noseLandmarkIndex: number;
  roiScale: number;
}

// Game loop configuration
export interface GameLoopConfig {
  targetFps: number;
  maxDeltaTime: number;
  vsync: boolean;
}
