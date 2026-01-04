
export type GameState = 'START' | 'PLAYING' | 'AD_INTERSTITIAL' | 'GAMEOVER' | 'LOADING';

export interface PipeData {
  id: number;
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
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
