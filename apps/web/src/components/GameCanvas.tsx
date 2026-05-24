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

export interface PlayerRenderData {
  birdY: number;
  birdRotation: number;
  score: number;
  isDead: boolean;
}

export interface GameCanvasHandle {
  render: (
    mode: 'SOLO' | 'DUO',
    p1: PlayerRenderData,
    p2: PlayerRenderData,
    pipes: PipeData[],
    highScore: number
  ) => void;
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

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctxRef.current = ctx;
    }

    // Create offscreen canvas for double buffering
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
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

  const drawBird = (
    ctx: CanvasRenderingContext2D,
    y: number,
    rotation: number,
    xPos: number,
    bodyColor: string = '#facc15',
    wingColor: string = '#ca8a04',
    score: number = 0
  ) => {
    const centerX = xPos + BIRD_WIDTH / 2;
    const centerY = y + BIRD_HEIGHT / 2;

    // Render floating crown upright above the bird if score is Legendary (score > 15)
    if (score > 15) {
      ctx.save();
      const floatOffset = Math.sin(Date.now() / 150) * 3;
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.shadowColor = '#f59e0b'; // amber-500
      ctx.shadowBlur = 12;
      
      const crownX = centerX - 10;
      const crownY = y - 18 + floatOffset;
      
      ctx.beginPath();
      ctx.moveTo(crownX, crownY + 8);
      ctx.lineTo(crownX - 4, crownY);
      ctx.lineTo(crownX + 3, crownY + 5);
      ctx.lineTo(crownX + 10, crownY - 4); // Center tip
      ctx.lineTo(crownX + 17, crownY + 5);
      ctx.lineTo(crownX + 24, crownY);
      ctx.lineTo(crownX + 20, crownY + 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = '#d97706'; // amber-600 border
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Neon glowing aura ring when on fire or legendary
    if (score >= 3) {
      ctx.save();
      let glowColor = '#a855f7'; // Purple for rising star
      let pulseGlow = 10 + Math.sin(Date.now() / 100) * 4;
      
      if (score >= 15) {
        glowColor = '#fbbf24'; // Gold for legend
        pulseGlow = 18 + Math.sin(Date.now() / 80) * 6;
      } else if (score >= 8) {
        glowColor = '#f97316'; // Orange for fire
        pulseGlow = 14 + Math.sin(Date.now() / 90) * 5;
      }
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = pulseGlow;
      
      // Draw outer glowing halo ring
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = score >= 15 ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, BIRD_WIDTH / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();

    // Translate to bird center for rotation
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, y + BIRD_HEIGHT + 5, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, BIRD_WIDTH / 2 - 2, BIRD_HEIGHT / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Wing
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.ellipse(xPos + 8, centerY + 6, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eye (white part)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(xPos + BIRD_WIDTH - 10, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(xPos + BIRD_WIDTH - 6, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f97316'; // Orange-500
    ctx.beginPath();
    ctx.moveTo(xPos + BIRD_WIDTH - 2, centerY);
    ctx.lineTo(xPos + BIRD_WIDTH + 12, centerY + 4);
    ctx.lineTo(xPos + BIRD_WIDTH - 2, centerY + 8);
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
    ctx.font = 'bold 48px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), width / 2, 50);
  };

  const drawDuoScore = (ctx: CanvasRenderingContext2D, score: number, xCenter: number, yTop: number = 20) => {
    // Score background
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.beginPath();
    ctx.roundRect(xCenter - 50, yTop, 100, 50, 25);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Score number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), xCenter, yTop + 25);
  };

  const drawStatusBadge = (
    ctx: CanvasRenderingContext2D,
    isDead: boolean,
    xCenter: number,
    label: string,
    yTop: number = 78,
    yLabel: number = 13
  ) => {
    // 1. Draw Player Label pill capsule
    ctx.save();
    const isYou = label === 'YOU';
    const primaryColor = isYou ? '#ef4444' : '#3b82f6'; // Red for YOU, Blue for Challenger
    const glowBlur = 8 + Math.sin(Date.now() / 150) * 3;
    
    const pillW = isYou ? 70 : 120;
    const pillH = 22;
    const pillX = xCenter - pillW / 2;
    const pillY = yLabel - 8;
    
    // Background with neon glow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 11);
    ctx.fill();
    
    ctx.strokeStyle = primaryColor;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = glowBlur;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Core white border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    
    // Text label inside the capsule
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, xCenter, pillY + pillH / 2 + 1);
    ctx.restore();

    // 2. Draw Status capsule background below
    ctx.save();
    const badgeWidth = 100;
    const badgeHeight = 22;
    ctx.fillStyle = isDead ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)';
    ctx.beginPath();
    ctx.roundRect(xCenter - badgeWidth / 2, yTop, badgeWidth, badgeHeight, 11);
    ctx.fill();

    ctx.strokeStyle = isDead ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Draw Status Text
    ctx.fillStyle = isDead ? '#ef4444' : '#10b981';
    ctx.font = 'bold 10px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDead ? '💀 CRASHED' : '⚡ FLYING', xCenter, yTop + badgeHeight / 2);
    ctx.restore();
  };

  const drawRoastedText = (ctx: CanvasRenderingContext2D, xOffset: number, halfWidth: number, screenHeight: number, yOffset: number = 0) => {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.2)'; // Dark red overlay
    ctx.fillRect(xOffset, yOffset, halfWidth, screenHeight);

    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 20;

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 44px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROASTED! 💀', xOffset + halfWidth / 2, yOffset + screenHeight / 2);

    ctx.restore();
  };

  const drawViewportDetails = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    isLocalPlayer: boolean
  ) => {
    ctx.save();
    
    // 1. Draw glowing inner scan line animation inside the viewport
    const scanTime = Date.now() / 2500;
    const scanY = y + (0.5 + Math.sin(scanTime * Math.PI) * 0.5) * h;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.08 + Math.sin(Date.now() / 300) * 0.02;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x, scanY);
    ctx.lineTo(x + w, scanY);
    ctx.stroke();
    
    // 2. Draw glowing border around the viewport
    ctx.restore();
    ctx.save();
    
    const pulseBlur = 8 + Math.sin(Date.now() / 150) * 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = isLocalPlayer ? 4 : 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = pulseBlur;
    
    ctx.beginPath();
    const inset = ctx.lineWidth / 2;
    ctx.rect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    ctx.stroke();
    
    ctx.restore();
  };

  const drawDivider = (ctx: CanvasRenderingContext2D, screenWidth: number, screenHeight: number, isLandscape: boolean) => {
    ctx.save();

    if (isLandscape) {
      const x = screenWidth / 2;

      // Draw vertical neon divider glow
      ctx.strokeStyle = '#f97316'; // Neon orange
      ctx.lineWidth = 8;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, screenHeight);
      ctx.stroke();

      // Inner bright white core line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, screenHeight);
      ctx.stroke();

      // Draw "VS" badge in the center
      const badgeY = screenHeight / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.arc(x, badgeY, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // VS text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Bungee", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', x, badgeY);
    } else {
      const y = screenHeight / 2;

      // Draw horizontal neon divider glow
      ctx.strokeStyle = '#f97316'; // Neon orange
      ctx.lineWidth = 8;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(screenWidth, y);
      ctx.stroke();

      // Inner bright white core line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(screenWidth, y);
      ctx.stroke();

      // Draw "VS" badge in the center
      const badgeX = screenWidth / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.arc(badgeX, y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // VS text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Bungee", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', badgeX, y);
    }

    ctx.restore();
  };

  useImperativeHandle(ref, () => ({
    render: (
      mode: 'SOLO' | 'DUO',
      p1: PlayerRenderData,
      p2: PlayerRenderData,
      pipes: PipeData[],
      highScore: number
    ) => {
      const ctx = offscreenCtxRef.current;
      const mainCtx = ctxRef.current;
      if (!ctx || !mainCtx) return;

      // Clear offscreen canvas — transparent so camera feed shows through
      ctx.clearRect(0, 0, width, height);

      if (mode === 'SOLO') {
        // --- SOLO RENDER ---
        ctx.fillStyle = 'rgba(2, 8, 28, 0.15)';
        ctx.fillRect(0, 0, width, height);

        // Draw all pipes
        for (const pipe of pipes) {
          if (pipe.x > -pipeWidth && pipe.x < width) {
            drawPipe(ctx, pipe, height);
          }
        }

        // Draw bird
        drawBird(ctx, p1.birdY, p1.birdRotation, BIRD_X, '#facc15', '#ca8a04', p1.score);

        // Draw score
        drawScore(ctx, p1.score, highScore);
      } else {
        // --- DUO RENDER (P2P Split Screen) ---
        const isLandscape = width >= height;

        if (isLandscape) {
          // --- LANDSCAPE MODE: Left & Right side-by-side split (PC/Laptop) ---
          const halfWidth = width / 2;

          // 1. Draw Player 1 (Left Column)
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, halfWidth, height);
          ctx.clip();

          // Dark slate overlay for P1
          ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
          ctx.fillRect(0, 0, halfWidth, height);

          // P1 obstacles (relative coordinates)
          for (const pipe of pipes) {
            if (pipe.x > -pipeWidth && pipe.x < halfWidth) {
              drawPipe(ctx, pipe, height);
            }
          }

          // P1 bird (Red bird)
          if (!p1.isDead) {
            drawBird(ctx, p1.birdY, p1.birdRotation, BIRD_X, '#ef4444', '#b91c1c', p1.score);
          } else {
            drawRoastedText(ctx, 0, halfWidth, height);
          }

          // P1 score and status badge
          drawDuoScore(ctx, p1.score, halfWidth / 2, 20);
          drawStatusBadge(ctx, p1.isDead, halfWidth / 2, 'YOU', 78, 13);
          ctx.restore();
          drawViewportDetails(ctx, 0, 0, halfWidth, height, '#ef4444', true);

          // 2. Draw Player 2 (Right Column)
          ctx.save();
          ctx.beginPath();
          ctx.rect(halfWidth, 0, halfWidth, height);
          ctx.clip();

          // Dark deep blue overlay for P2
          ctx.fillStyle = 'rgba(8, 15, 38, 0.15)';
          ctx.fillRect(halfWidth, 0, halfWidth, height);

          // P2 obstacles (translated coordinates)
          for (const pipe of pipes) {
            const translatedPipe = { ...pipe, x: pipe.x + halfWidth };
            if (translatedPipe.x > halfWidth - pipeWidth && translatedPipe.x < width) {
              drawPipe(ctx, translatedPipe, height);
            }
          }

          // P2 bird (Blue bird)
          if (!p2.isDead) {
            drawBird(ctx, p2.birdY, p2.birdRotation, halfWidth + BIRD_X, '#3b82f6', '#1d4ed8', p2.score);
          } else {
            drawRoastedText(ctx, halfWidth, halfWidth, height);
          }

          // P2 score and status badge
          drawDuoScore(ctx, p2.score, halfWidth + halfWidth / 2, 20);
          drawStatusBadge(ctx, p2.isDead, halfWidth + halfWidth / 2, 'CHALLENGER', 78, 13);
          ctx.restore();
          drawViewportDetails(ctx, halfWidth, 0, halfWidth, height, '#3b82f6', false);

          // 3. Draw Neon Divider VS badge (Vertical)
          drawDivider(ctx, width, height, true);
        } else {
          // --- PORTRAIT MODE: Top & Bottom stacked split (Mobile Devices) ---
          const halfHeight = height / 2;

          // 1. Draw Player 1 (Top Half)
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, halfHeight);
          ctx.clip();

          // Dark slate overlay for P1
          ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
          ctx.fillRect(0, 0, width, halfHeight);

          // Draw game elements (pipes, bird) scaled by (1.0, 0.5) to fit halfHeight perfectly
          ctx.save();
          ctx.scale(1.0, 0.5);
          for (const pipe of pipes) {
            if (pipe.x > -pipeWidth && pipe.x < width) {
              drawPipe(ctx, pipe, height);
            }
          }
          if (!p1.isDead) {
            drawBird(ctx, p1.birdY, p1.birdRotation, BIRD_X, '#ef4444', '#b91c1c', p1.score);
          }
          ctx.restore();

          // Draw HUD elements (unscaled)
          if (p1.isDead) {
            drawRoastedText(ctx, 0, width, halfHeight, 0);
          }
          drawDuoScore(ctx, p1.score, width / 2, 20);
          drawStatusBadge(ctx, p1.isDead, width / 2, 'YOU', 78, 13);
          ctx.restore();
          drawViewportDetails(ctx, 0, 0, width, halfHeight, '#ef4444', true);

          // 2. Draw Player 2 (Bottom Half)
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, halfHeight, width, halfHeight);
          ctx.clip();

          // Dark deep blue overlay for P2
          ctx.fillStyle = 'rgba(8, 15, 38, 0.15)';
          ctx.fillRect(0, halfHeight, width, halfHeight);

          // Draw game elements (pipes, bird) scaled and translated by halfHeight
          ctx.save();
          ctx.translate(0, halfHeight);
          ctx.scale(1.0, 0.5);
          for (const pipe of pipes) {
            if (pipe.x > -pipeWidth && pipe.x < width) {
              drawPipe(ctx, pipe, height);
            }
          }
          if (!p2.isDead) {
            drawBird(ctx, p2.birdY, p2.birdRotation, BIRD_X, '#3b82f6', '#1d4ed8', p2.score);
          }
          ctx.restore();

          // Draw HUD elements (unscaled)
          if (p2.isDead) {
            drawRoastedText(ctx, 0, width, halfHeight, halfHeight);
          }
          drawDuoScore(ctx, p2.score, width / 2, halfHeight + 20);
          drawStatusBadge(ctx, p2.isDead, width / 2, 'CHALLENGER', halfHeight + 78, halfHeight + 13);
          ctx.restore();
          drawViewportDetails(ctx, 0, halfHeight, width, halfHeight, '#3b82f6', false);

          // 3. Draw Neon Divider VS badge (Horizontal)
          drawDivider(ctx, width, height, false);
        }
      }

      // Copy to main canvas (double buffer)
      mainCtx.clearRect(0, 0, width, height);
      mainCtx.drawImage(offscreenCanvasRef.current!, 0, 0);
    },

    clear: () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
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
