package com.noseroast.game

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import kotlinx.coroutines.isActive

@Composable
fun GameSurface(
    engine: GameEngine,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val screenWidth = constraints.maxWidth.toFloat()
        val screenHeight = constraints.maxHeight.toFloat()
        val frame = engine.renderTick

        var lastNanos by remember { mutableLongStateOf(0L) }

        LaunchedEffect(engine.status) {
            if (engine.status == GameStatus.COUNTDOWN || engine.status == GameStatus.PLAYING) {
                lastNanos = System.nanoTime()
                while (isActive && (engine.status == GameStatus.COUNTDOWN || engine.status == GameStatus.PLAYING)) {
                    withFrameNanos { now ->
                        val deltaMs = (now - lastNanos) / 1_000_000f
                        lastNanos = now
                        engine.update(deltaMs, screenWidth, screenHeight)
                    }
                }
            }
        }

        key(frame) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val birdY = (engine.smoothBirdY * screenHeight).coerceIn(0f, screenHeight - engine.BIRD_H)
                val dp = engine.dp

                // Draw the active pipes first so the bird stays readable above them.
                engine.pipes.forEach { p -> drawPipeNative(p, engine, screenHeight, dp) }

                drawBirdNative(engine, birdY, dp)
            }
        }
    }
}

private fun DrawScope.drawPipeNative(p: Pipe, engine: GameEngine, screenH: Float, dp: Float) {
    val pw = engine.PIPE_WIDTH
    val border = engine.BORDER_W
    val capH = 32f * dp
    val capExtra = 6f * dp

    val pipeColor = Color(0xFF10B981)
    val capColor = Color(0xFF34D399)
    val borderColor = Color(0xFF020617)

    // Top pipe
    if (p.topHeight > 0) {
        drawRect(pipeColor, Offset(p.x, 0f), Size(pw, p.topHeight))
        drawLine(borderColor, Offset(p.x, 0f), Offset(p.x, p.topHeight), border)
        drawLine(borderColor, Offset(p.x, p.topHeight), Offset(p.x + pw, p.topHeight), border)
        drawLine(borderColor, Offset(p.x + pw, p.topHeight), Offset(p.x + pw, 0f), border)

        if (p.topHeight > 40f * dp) {
            val capY = p.topHeight - capH
            drawRect(capColor, Offset(p.x - capExtra, capY), Size(pw + capExtra * 2, capH))
            drawRect(borderColor, Offset(p.x - capExtra, capY), Size(pw + capExtra * 2, capH), style = Stroke(border))
        }
    }

    // Bottom pipe
    val botY = p.topHeight + p.gap
    val botH = screenH - botY
    if (botH > 0) {
        drawRect(pipeColor, Offset(p.x, botY), Size(pw, botH))
        drawLine(borderColor, Offset(p.x, botY), Offset(p.x, screenH), border)
        drawLine(borderColor, Offset(p.x + pw, botY), Offset(p.x + pw, screenH), border)
        drawLine(borderColor, Offset(p.x, botY), Offset(p.x + pw, botY), border)

        if (botH > 40f * dp) {
            drawRect(capColor, Offset(p.x - capExtra, botY), Size(pw + capExtra * 2, capH))
            drawRect(borderColor, Offset(p.x - capExtra, botY), Size(pw + capExtra * 2, capH), style = Stroke(border))
        }
    }
}

private fun DrawScope.drawBirdNative(engine: GameEngine, birdY: Float, dp: Float) {
    val bx = engine.BIRD_X
    val bw = engine.BIRD_W
    val bh = engine.BIRD_H
    val centerX = bx + bw / 2f
    val centerY = birdY + bh / 2f

    // Rotation from vertical velocity
    val rotation = ((engine.smoothBirdY - engine.prevBirdY) * 250f).coerceIn(-25f, 25f)

    withTransform({
        rotate(degrees = rotation, pivot = Offset(centerX, centerY))
    }) {
        // Shadow
        drawOval(
            color = Color(0x4D000000),
            topLeft = Offset(centerX - 15f * dp, birdY + bh + 3f * dp),
            size = Size(30f * dp, 10f * dp)
        )

        // Body
        drawOval(
            color = Color(0xFFFACC15),
            topLeft = Offset(bx + 2f * dp, birdY + 2f * dp),
            size = Size(bw - 4f * dp, bh - 4f * dp)
        )
        drawOval(
            color = Color(0xFF020617),
            topLeft = Offset(bx + 2f * dp, birdY + 2f * dp),
            size = Size(bw - 4f * dp, bh - 4f * dp),
            style = Stroke(5f * dp)
        )

        // Wing
        drawOval(
            color = Color(0xFFCA8A04),
            topLeft = Offset(bx + 6f * dp, centerY + 2f * dp),
            size = Size(20f * dp, 16f * dp)
        )
        drawOval(
            color = Color(0xFF020617),
            topLeft = Offset(bx + 6f * dp, centerY + 2f * dp),
            size = Size(20f * dp, 16f * dp),
            style = Stroke(3f * dp)
        )

        // Eye
        drawCircle(Color.White, 8f * dp, Offset(bx + bw - 10f * dp, birdY + 10f * dp))
        drawCircle(Color(0xFF020617), 8f * dp, Offset(bx + bw - 10f * dp, birdY + 10f * dp), style = Stroke(3f * dp))

        // Pupil
        drawCircle(Color.Black, 3f * dp, Offset(bx + bw - 6f * dp, birdY + 10f * dp))

        // Beak (triangle)
        val beak = Path().apply {
            moveTo(bx + bw - 2f * dp, centerY)
            lineTo(bx + bw + 12f * dp, centerY + 4f * dp)
            lineTo(bx + bw - 2f * dp, centerY + 8f * dp)
            close()
        }
        drawPath(beak, Color(0xFFF97316), style = Fill)
        drawPath(beak, Color(0xFF020617), style = Stroke(3f * dp))
    }
}
