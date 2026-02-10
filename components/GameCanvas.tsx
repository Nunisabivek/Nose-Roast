
import React, { forwardRef, useImperativeHandle, useRef, useEffect, memo } from 'react';

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

export interface GameCanvasHandle {
  render: (birdY: number, birdRotation: number, pipes: PipeData[], score: number, highScore: number) => void;
  clear: () => void;
}

interface GameCanvasProps {
  width: number;
  height: number;
  pipeWidth: number;
}

// Pre-calculated constants for performance
const BIRD_WIDTH = 44;
const BIRD_HEIGHT = 36;
const BIRD_X = 50;
const PIPE_CAP_HEIGHT = 32;

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ width, height, pipeWidth }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas contexts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // No alpha for main canvas (performance)
    if (ctx) {
      ctxRef.current = ctx;
    }

    // Create offscreen canvas for double buffering
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d', { alpha: false });
    if (offCtx) {
      offscreenCanvasRef.current = offscreen;
      offscreenCtxRef.current = offCtx;
    }
  }, [width, height]);

  // Drawing functions - optimized for single-pass rendering
  const drawPipe = (ctx: CanvasRenderingContext2D, pipe: PipeData, screenHeight: number) => {
    const pipeBottomY = pipe.topHeight + pipe.gap;
    const bottomPipeHeight = screenHeight - pipeBottomY;

    // Pipe colors
    const pipeColor = '#10b981';
    const capColor = '#34d399';
    const borderColor = '#020617';
    const borderWidth = 4;

    ctx.lineWidth = borderWidth;

    // Top Pipe
    if (pipe.topHeight > 0) {
      // Main body
      ctx.fillStyle = pipeColor;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);

      // Border
      ctx.strokeStyle = borderColor;
      ctx.beginPath();
      ctx.moveTo(pipe.x, 0);
      ctx.lineTo(pipe.x, pipe.topHeight);
      ctx.lineTo(pipe.x + pipeWidth, pipe.topHeight);
      ctx.lineTo(pipe.x + pipeWidth, 0);
      ctx.stroke();

      // Top pipe cap (if tall enough)
      if (pipe.topHeight > 40) {
        const capY = pipe.topHeight - PIPE_CAP_HEIGHT;
        ctx.fillStyle = capColor;
        ctx.fillRect(pipe.x - 6, capY, pipeWidth + 12, PIPE_CAP_HEIGHT);

        // Cap border
        ctx.strokeRect(pipe.x - 6, capY, pipeWidth + 12, PIPE_CAP_HEIGHT);
      }
    }

    // Bottom Pipe
    if (bottomPipeHeight > 0) {
      // Main body
      ctx.fillStyle = pipeColor;
      ctx.fillRect(pipe.x, pipeBottomY, pipeWidth, bottomPipeHeight);

      // Border
      ctx.strokeStyle = borderColor;
      ctx.beginPath();
      ctx.moveTo(pipe.x, pipeBottomY);
      ctx.lineTo(pipe.x, screenHeight);
      ctx.lineTo(pipe.x + pipeWidth, screenHeight);
      ctx.lineTo(pipe.x + pipeWidth, pipeBottomY);
      ctx.stroke();

      // Bottom pipe cap (if tall enough)
      if (bottomPipeHeight > 40) {
        ctx.fillStyle = capColor;
        ctx.fillRect(pipe.x - 6, pipeBottomY, pipeWidth + 12, PIPE_CAP_HEIGHT);

        // Cap border
        ctx.strokeRect(pipe.x - 6, pipeBottomY, pipeWidth + 12, PIPE_CAP_HEIGHT);
      }
    }
  };

  const drawBird = (ctx: CanvasRenderingContext2D, y: number, rotation: number) => {
    ctx.save();

    // Translate to bird center for rotation
    const centerX = BIRD_X + BIRD_WIDTH / 2;
    const centerY = y + BIRD_HEIGHT / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, y + BIRD_HEIGHT + 5, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#facc15'; // Yellow-400
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, BIRD_WIDTH / 2 - 2, BIRD_HEIGHT / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Wing
    ctx.fillStyle = '#ca8a04'; // Yellow-600
    ctx.beginPath();
    ctx.ellipse(BIRD_X + 8, centerY + 6, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eye (white part)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(BIRD_X + BIRD_WIDTH - 10, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(BIRD_X + BIRD_WIDTH - 6, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f97316'; // Orange-500
    ctx.beginPath();
    ctx.moveTo(BIRD_X + BIRD_WIDTH - 2, centerY);
    ctx.lineTo(BIRD_X + BIRD_WIDTH + 12, centerY + 4);
    ctx.lineTo(BIRD_X + BIRD_WIDTH - 2, centerY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  };

  const drawScore = (ctx: CanvasRenderingContext2D, score: number, highScore: number) => {
    // Score background
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 60, 20, 120, 60, 32);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Score number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Fredoka One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), width / 2, 50);
  };

  useImperativeHandle(ref, () => ({
    render: (birdY: number, birdRotation: number, pipes: PipeData[], score: number, highScore: number) => {
      const ctx = offscreenCtxRef.current;
      const mainCtx = ctxRef.current;
      if (!ctx || !mainCtx) return;

      // Clear offscreen canvas
      ctx.fillStyle = '#0f172a'; // Slate-900 background
      ctx.fillRect(0, 0, width, height);

      // Draw all pipes
      for (const pipe of pipes) {
        if (pipe.x > -pipeWidth && pipe.x < width) {
          drawPipe(ctx, pipe, height);
        }
      }

      // Draw bird
      drawBird(ctx, birdY, birdRotation);

      // Draw score
      drawScore(ctx, score, highScore);

      // Copy to main canvas (double buffer)
      mainCtx.drawImage(offscreenCanvasRef.current!, 0, 0);
    },

    clear: () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }
  }));

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        imageRendering: 'pixelated', // Sharp pixels for retro feel
      }}
    />
  );
});

GameCanvas.displayName = 'GameCanvas';

export default memo(GameCanvas);
