
import { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
  width: 400,
  height: 600,
  pipeWidth: 70,
  pipeGap: 210, // Larger starting gap for easier intro
  pipeSpeed: 3.5, // Easy start speed for beginners
  birdWidth: 44,
  birdHeight: 36,
};

export const DIFFICULTY_MAX_SPEED = 8.5; // Slightly lower max for mobile smoothness
export const DIFFICULTY_MIN_GAP = 150; // Minimum gap - never smaller than this!
export const DIFFICULTY_RAMP_SECONDS = 90; // 1.5 minutes to reach max difficulty

export const INITIAL_BIRD_Y = 300;
