
import { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
  width: 400,
  height: 600,
  pipeWidth: 70,
  pipeGap: 210, // Wider starting gap for easier onboarding
  pipeSpeed: 3.2, 
  birdWidth: 44,
  birdHeight: 36,
};

export const DIFFICULTY_MAX_SPEED = 9.5;
export const DIFFICULTY_MIN_GAP = 115;
export const DIFFICULTY_RAMP_SECONDS = 120; // 2 minutes to reach chaos mode

export const INITIAL_BIRD_Y = 300;
