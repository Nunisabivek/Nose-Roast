package com.noseroast.game

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─── START MENU ───
@Composable
fun StartMenu(onPlayClick: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { it / 3 }
    ) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xCC0F172A)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Pulsing logo
                val pulseScale by rememberInfiniteTransition(label = "pulse").animateFloat(
                    initialValue = 1f, targetValue = 1.08f,
                    animationSpec = infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                    label = "logoPulse"
                )

                Box(
                    modifier = Modifier
                        .scale(pulseScale)
                        .size(120.dp)
                        .clip(RoundedCornerShape(32.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFFF97316), Color(0xFFEF4444), Color(0xFFEAB308))))
                        .padding(4.dp)
                ) {
                    Box(Modifier.fillMaxSize().clip(RoundedCornerShape(28.dp)).background(Color(0xFF0F172A)), contentAlignment = Alignment.Center) {
                        Text("\uD83D\uDC43", fontSize = 60.sp)
                    }
                }

                Spacer(Modifier.height(24.dp))
                Row {
                    Text("NOSE", color = Color.White, fontSize = 48.sp, fontWeight = FontWeight.Black)
                    Text("ROAST", color = Color(0xFFF97316), fontSize = 48.sp, fontWeight = FontWeight.Black)
                }
                Text("Fly with your face \u2022 Get roasted", color = Color(0x99FFFFFF), fontSize = 14.sp)

                Spacer(Modifier.height(48.dp))

                // Animated play button
                val btnScale by rememberInfiniteTransition(label = "btn").animateFloat(
                    initialValue = 1f, targetValue = 1.05f,
                    animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
                    label = "btnPulse"
                )
                Box(
                    modifier = Modifier
                        .scale(btnScale)
                        .clip(RoundedCornerShape(28.dp))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFF97316), Color(0xFFEF4444))))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { onPlayClick() }
                        .padding(horizontal = 40.dp, vertical = 16.dp)
                ) {
                    Text("\u25B6  TAP TO PLAY", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─── SCORE HUD ───
@Composable
fun ScoreHud(score: Int, heat: Float, level: Int) {
    val animatedScore by animateIntAsState(targetValue = score, animationSpec = tween(200), label = "score")

    Box(Modifier.fillMaxSize().padding(top = 56.dp), contentAlignment = Alignment.TopCenter) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                animatedScore.toString(), color = Color.White, fontSize = 72.sp,
                fontWeight = FontWeight.Black
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
                Chip(Color(0xFFEA580C), "\uD83D\uDD25 ${String.format("%.1f", heat)}")
                Chip(Color(0xFF6366F1), "LVL ${level + 1}")
            }
        }
    }
}

@Composable
private fun Chip(bg: Color, text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(2.dp, Color(0xFF020617), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(text, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

// ─── ROAST CARD (GAME OVER) ───
@Composable
fun RoastCard(
    score: Int,
    highScore: Int,
    roastText: String,
    isRestarting: Boolean = false,
    onShown: () -> Unit = {},
    onRetry: () -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        visible = true
        onShown()
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(150)) + scaleIn(spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium), initialScale = 0.92f)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xDD0F172A)),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 24.dp)
            ) {
                // Skull bounce
                val bounce by rememberInfiniteTransition(label = "skull").animateFloat(
                    initialValue = 0f, targetValue = -12f,
                    animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
                    label = "skullBounce"
                )
                Text(
                    "\uD83D\uDC80", fontSize = 52.sp,
                    modifier = Modifier.offset(y = bounce.dp)
                )
                Spacer(Modifier.height(4.dp))
                Text("GAME OVER", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(20.dp))

                // Main card with gradient border
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(28.dp))
                        .background(Brush.verticalGradient(listOf(Color(0xFF1E293B), Color(0xFF0F172A))))
                        .border(
                            1.dp,
                            Brush.linearGradient(listOf(Color(0x33F97316), Color(0x33A855F7), Color(0x33EF4444))),
                            RoundedCornerShape(28.dp)
                        )
                ) {
                    Column {
                        // Top accent gradient
                        Box(
                            Modifier.fillMaxWidth().height(4.dp)
                                .background(Brush.horizontalGradient(listOf(Color(0xFFF97316), Color(0xFFEF4444), Color(0xFFA855F7))))
                        )

                        Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            // Animated score ring
                            val ringScale by animateFloatAsState(
                                targetValue = 1f,
                                animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
                                label = "ring"
                            )
                            Box(
                                modifier = Modifier
                                    .scale(ringScale)
                                    .size(130.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF0F172A))
                                    .border(3.dp, Brush.linearGradient(listOf(Color(0xFFF97316), Color(0xFFEF4444))), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    val animScore by animateIntAsState(targetValue = score, tween(800), label = "cardScore")
                                    Text(animScore.toString(), fontSize = 52.sp, fontWeight = FontWeight.Black, color = Color.White)
                                    Text("POINTS", fontSize = 9.sp, color = Color(0x66FFFFFF), letterSpacing = 3.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            Spacer(Modifier.height(20.dp))

                            // Roast message box
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xFF020617))
                                    .border(1.dp, Color(0x15FFFFFF), RoundedCornerShape(16.dp))
                                    .padding(20.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("\uD83D\uDD25 ROASTED", fontSize = 11.sp, color = Color(0xFFF97316), letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.height(10.dp))
                                    Text(
                                        "\"$roastText\"",
                                        color = Color(0xCCFFFFFF), fontSize = 15.sp,
                                        fontStyle = FontStyle.Italic, textAlign = TextAlign.Center,
                                        lineHeight = 22.sp
                                    )
                                }
                            }

                            Spacer(Modifier.height(16.dp))

                            // Stats
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                                StatItem("\uD83C\uDFC6 BEST", highScore.toString())
                                StatItem("\uD83C\uDFAF LEVEL", "${score / 5 + 1}")
                            }
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))

                // Play again button (animated)
                val retryScale by rememberInfiniteTransition(label = "retry").animateFloat(
                    initialValue = 1f, targetValue = 1.03f,
                    animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
                    label = "retryPulse"
                )
                Button(
                    onClick = onRetry,
                    enabled = !isRestarting,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    modifier = Modifier
                        .scale(retryScale)
                        .fillMaxWidth()
                        .height(58.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.horizontalGradient(listOf(Color(0xFF10B981), Color(0xFF059669)))),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Text(
                        if (isRestarting) "OPENING AD..." else "\u25B6  PLAY AGAIN",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color.White)
        Text(label, fontSize = 10.sp, color = Color(0x66FFFFFF), letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
    }
}

// ─── COUNTDOWN ───
@Composable
fun CountdownOverlay(count: Int) {
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "countScale"
    )
    val alpha by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(300),
        label = "countAlpha"
    )

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xCC020617)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                key(count) { if (count > 0) count.toString() else "GO!" },
                color = Color.White, fontSize = 120.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.scale(scale).alpha(alpha)
            )
            Text("Move your nose up and down", color = Color(0x99FFFFFF), fontSize = 16.sp, modifier = Modifier.padding(top = 16.dp))
        }
    }
}
