
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

