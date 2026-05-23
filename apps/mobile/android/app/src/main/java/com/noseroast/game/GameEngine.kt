package com.noseroast.game

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

enum class GameStatus { START, COUNTDOWN, PLAYING, GAMEOVER }

data class Pipe(
    val id: Long,
    var x: Float,
    var topHeight: Float,
    val gap: Float,
    var passed: Boolean = false,
    val isMoving: Boolean = false,
    var moveDirection: Float = 1f,
    val moveSpeed: Float = 0f,
    val baseTopHeight: Float = 0f,
    val moveRange: Float = 0f
)

class GameEngine(val dp: Float) {
    // Webapp constants scaled by density
    val PIPE_WIDTH = 70f * dp       // webapp: pipeWidth: 70
    val BIRD_W = 44f * dp           // webapp: birdWidth: 44
    val BIRD_H = 36f * dp           // webapp: birdHeight: 36
    val BIRD_X = 50f * dp           // webapp: BIRD_X = 50
    val BORDER_W = 4f * dp          // webapp: borderWidth = 4

    // Physics matching webapp constants.ts exactly
    private val BASE_SPEED = 3.8f   // webapp: pipeSpeed: 3.8
    private val MAX_SPEED = 8.0f    // webapp: DIFFICULTY_MAX_SPEED = 8.0
    private val BASE_GAP = 220f * dp // webapp: pipeGap: 220
    private val MIN_GAP = 160f * dp  // webapp: DIFFICULTY_MIN_GAP = 160
    private val RAMP_SECONDS = 60f   // webapp: DIFFICULTY_RAMP_SECONDS = 60

    var status by mutableStateOf(GameStatus.START)
    var score by mutableIntStateOf(0)
    var highScore by mutableIntStateOf(0)
    var countdown by mutableIntStateOf(3)
    var currentRoast by mutableStateOf("")
    val pipes = mutableListOf<Pipe>()
    var renderTick by mutableIntStateOf(0)
        private set

    var smoothBirdY by mutableFloatStateOf(0.5f)
        private set
    var prevBirdY by mutableFloatStateOf(0.5f)
        private set
    private var targetBirdY = 0.5f
    private var birdVelocityY = 0f

    var onScoreEvent: (() -> Unit)? = null
    var onCrashEvent: (() -> Unit)? = null

    private var elapsedSeconds = 0f
    private var timeSinceLastPipeMs = 0f
    private var currentSpeed = BASE_SPEED
    private var currentGap = BASE_GAP

    private fun invalidate() {
        renderTick++
    }

    fun updateBirdY(rawY: Float) {
        targetBirdY = rawY.coerceIn(0f, 1f)
    }

    fun start() {
        score = 0
        pipes.clear()
        elapsedSeconds = 0f
        timeSinceLastPipeMs = 0f
        currentSpeed = BASE_SPEED
        currentGap = BASE_GAP
        targetBirdY = smoothBirdY
        birdVelocityY = 0f
        status = GameStatus.COUNTDOWN
        invalidate()
    }

    fun update(deltaTimeMs: Float, screenWidth: Float, screenHeight: Float) {
        // Cap delta to prevent huge jumps (webapp: maxDeltaTime = 1000/30)
        val clampedMs = min(deltaTimeMs, 33.33f)
        val dt = clampedMs / 1000f

        animateBird(dt)

        if (status != GameStatus.PLAYING) {
            invalidate()
            return
        }

        // ── DIFFICULTY RAMP (time-based, matching webapp) ──
        elapsedSeconds += dt
        val progress = min(1f, elapsedSeconds / RAMP_SECONDS)
        currentSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * progress
        currentGap = BASE_GAP - (BASE_GAP - MIN_GAP) * progress

        // ── PIPE SPAWNING (time-based intervals matching webapp) ──
        timeSinceLastPipeMs += clampedMs
        val baseInterval = 2200f
        val minInterval = 1600f
        val speedFactor = (currentSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)
        val spawnInterval = max(minInterval, baseInterval - speedFactor * 600f)

        if (timeSinceLastPipeMs > spawnInterval) {
            spawnPipe(screenWidth, screenHeight)
            timeSinceLastPipeMs = 0f
        }

        // ── PIPE MOVEMENT & COLLISION (delta-time based, matching webapp) ──
        // webapp: pixelsPerSecond = speedRef.current * 60
        val pixelsPerSecond = currentSpeed * 60f * dp
        val moveAmount = pixelsPerSecond * dt

        // webapp collision insets: left=50+12, right=50+44-12, top=birdY+8, bottom=birdY+36-8
        val birdScreenY = smoothBirdY * screenHeight
        val birdL = BIRD_X + 12f * dp
        val birdR = BIRD_X + BIRD_W - 12f * dp
        val birdT = birdScreenY + 8f * dp
        val birdB = birdScreenY + BIRD_H - 8f * dp

        var scored = 0

        var index = pipes.lastIndex
        while (index >= 0) {
            val p = pipes[index]
            p.x -= moveAmount

            // Vertical movement for moving pipes (webapp: verticalSpeed = moveSpeed * 60)
            if (p.isMoving) {
                val verticalSpeed = p.moveSpeed * 60f * dp
                p.topHeight += verticalSpeed * dt * p.moveDirection
                if (p.topHeight <= p.baseTopHeight - p.moveRange) {
                    p.topHeight = p.baseTopHeight - p.moveRange
                    p.moveDirection = 1f
                }
                if (p.topHeight >= p.baseTopHeight + p.moveRange) {
                    p.topHeight = p.baseTopHeight + p.moveRange
                    p.moveDirection = -1f
                }
            }

            // Score (webapp: p.x + pipeWidth < 50)
            if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
                p.passed = true
                scored++
            }

            // Collision (matching webapp exactly)
            if (birdR > p.x && birdL < p.x + PIPE_WIDTH) {
                if (birdT < p.topHeight || birdB > p.topHeight + p.gap) {
                    crash()
                    return
                }
            }

            if (p.x < -PIPE_WIDTH) {
                pipes.removeAt(index)
            }

            index--
        }

        if (scored > 0) {
            score += scored
            onScoreEvent?.invoke()
        }

        // Boundary check (webapp: birdY < -40 || birdY > height - birdHeight + 40)
        if (birdScreenY < -40f * dp || birdScreenY > screenHeight - BIRD_H + 40f * dp) {
            crash()
            return
        }

        invalidate()
    }

    private fun animateBird(dt: Float) {
        prevBirdY = smoothBirdY

        // Spring physics: gives natural acceleration into moves and smooth deceleration near target.
        // stiffness controls how fast it responds, damping prevents oscillation/bounce.
        // 2 * sqrt(stiffness) = critical damping ≈ 34.6 — using 36 = slightly overdamped = no bounce.
        val stiffness = 300f
        val damping = 36f
        val displacement = targetBirdY - smoothBirdY
        birdVelocityY += (displacement * stiffness - birdVelocityY * damping) * dt
        smoothBirdY = (smoothBirdY + birdVelocityY * dt).coerceIn(0f, 1f)
    }

    private fun spawnPipe(screenWidth: Float, screenHeight: Float) {
        val pipeGap = max(MIN_GAP, currentGap)
        val minWall = 60f * dp
        var available = screenHeight - pipeGap - minWall * 2
        if (available < 0) available = 0f

        var topH = minWall + Random.nextFloat() * available
        topH = max(minWall, min(topH, screenHeight - pipeGap - minWall))

        var moving = false; var mSpeed = 0f; var mRange = 0f
        if (score >= 3) {
            val chance = when {
                score >= 15 -> 0.75f; score >= 10 -> 0.6f; score >= 7 -> 0.45f; else -> 0.25f
            }
            moving = Random.nextFloat() < chance
            if (moving) {
                mSpeed = min(2.5f, 0.8f + (score - 3) * 0.12f)
                mRange = min(90f * dp, (35f + (score - 3) * 4f) * dp)
                val buf = mRange + 20f * dp
                topH = max(minWall + buf, min(topH, screenHeight - pipeGap - minWall - buf))
            }
        }

        pipes += Pipe(
            id = System.nanoTime(), x = screenWidth, topHeight = topH, gap = pipeGap,
            isMoving = moving, moveDirection = if (Random.nextBoolean()) 1f else -1f,
            moveSpeed = mSpeed, baseTopHeight = topH, moveRange = mRange
        )
    }

    private fun crash() {
        status = GameStatus.GAMEOVER
        currentRoast = when {
            score <= 2 -> ROASTS_BEGINNER.random()
            score <= 7 -> ROASTS_LEARNING.random()
            score <= 15 -> ROASTS_DECENT.random()
            else -> ROASTS_PRO.random()
        }
        if (score > highScore) highScore = score
        invalidate()
        onCrashEvent?.invoke()
    }

    companion object {
        val ROASTS_BEGINNER = listOf(
            "Your nose has the reaction time of a Windows Vista laptop. 💀",
            "Bro played like their WiFi was connected to a microwave. Tragic.",
            "That wasn't gaming, that was a public humiliation speedrun.",
            "Even a brick with googly eyes would've scored higher.",
            "Your face said 'I got this' but your score said 'call 911.' 😭",
            "The pipes took one look at you and went 'free real estate.'",
            "This score belongs in a museum of human failure. Historic L.",
            "You just speedran disappointment. Congrats on the world record. 🏆",
            "Somewhere, a pigeon is laughing at you. And it's justified.",
            "This isn't a skill issue, this is an existential crisis.",
            "Your gameplay just got submitted as evidence for AI supremacy.",
            "That was giving 'first day with a face' energy. Absolutely tragic.",
            "Bro thought this was a participation trophy generator. 💀",
            "Your reflexes are sponsored by Internet Explorer. In 2026.",
            "I've seen better coordination from a broken Roomba.",
            "The 'Play Again' button is scared of you at this point.",
            "You played like your nose owes money to the pipes.",
            "This score is so bad it needs therapy. And so do you.",
            "Delete the app, throw your phone in rice, start over.",
            "Your nose moves like it's streaming on 2G in a tunnel.",
            "Your face control is giving 'never seen a mirror before' vibes.",
            "You're the reason games have 'Are you REALLY sure?' prompts.",
            "Your nose just filed for divorce. From your face. It's over.",
            "This gameplay should be classified as a war crime.",
            "The pipes are writing thank-you notes to you for the free win.",
            "Your ancestors are in heaven pretending they don't know you.",
            "The game literally tried to let you win. You still lost.",
            "Your face is allergic to success and it's terminal.",
            "This isn't rock bottom. You brought a shovel and kept digging."
        )

        val ROASTS_LEARNING = listOf(
            "Score 3-7? So you're evolving... from terrible to just really bad. 📉",
            "Your nose is buffering. Talent.exe not found. Abort? Y/N",
            "This is giving 'main character who dies in episode 2' vibes.",
            "You're mid. Aggressively, consistently, painfully mid.",
            "The pipes are starting to wonder if you need a wellness check.",
            "Loading potential.exe... ERROR 404: File does not exist.",
            "You're like a participation trophy that got left in the rain.",
            "This score says 'I peaked in the womb' and it's showing.",
            "Your ancestors didn't survive evolution for THIS performance.",
            "Somewhere, your future self just blocked your number.",
            "You're not terrible anymore. You're just professionally not good.",
            "Your nose has potential. Too bad your brain doesn't.",
            "The pipes are confused. 'Are they lagging or just... like this?'",
            "You're the human equivalent of buffering at 99%.",
            "Skill? She left. She's not coming back. Accept it.",
            "You're the reason 'retry' buttons exist. Job security.",
            "Solid D+ energy. Your parents knew this day would come.",
            "You're improving! From 'disaster' to 'unfortunate incident.' Baby steps!",
            "Your face is trying. Your score is filing a formal complaint.",
            "The game is rooting for you out of pity. It's that bad.",
            "Your gameplay looks like lag but it's actually just you.",
            "You're the NPC energy everyone warned you about."
        )

        val ROASTS_DECENT = listOf(
            "Score 8-15? Okay so you're not completely braindead. Just mostly. 🔥",
            "Your nose went from 'disaster' to 'mild inconvenience.' Character development!",
            "The pipes are sweating. Slightly. Like barely noticeable.",
            "Double digits?! We're shocked. Genuinely. Still not impressed though.",
            "This score is mid-tier. Peak mediocrity. Congrats? 📈",
            "You're not a pro. You're not even semi-pro. You're amateur hour.",
            "The algorithm noticed you. Then immediately forgot about you.",
            "You proved the haters wrong. Barely. By like 0.2%. Technically.",
            "Certified nose pilot. Expired license. Pending review. Probably denied.",
            "You're officially better than 60% of players. The bottom 60%.",
            "The pipes called reinforcements. Then canceled them. False alarm.",
            "This is the redemption arc nobody asked for or wants to see.",
            "You're evolving. At the pace of continental drift. Glacially slow.",
            "Your face just entered the Top 40%. Of the bottom 50%.",
            "You're not viral. You're not even bacterial. You're just... there.",
            "You've graduated from 'joke' to 'punchline.' Congrats! 🎓",
            "Your nose unlocked 'actually decent' status. Trial version. Expires soon.",
            "You're making the pipes nervous. Nervous you'll actually survive. Scary.",
            "You just proved that practice makes... slightly less embarrassing.",
            "This is the gaming equivalent of a participation certificate. Laminated."
        )

        val ROASTS_PRO = listOf(
            "Score 16+? Okay hotshot, don't let it go to your head. We've seen better. 🙄",
            "You didn't break the game. You just got lucky. Don't quit your day job.",
            "Those pipes are filing a complaint. For harassment. You're TOO tryhard.",
            "This score is 'good' but we've seen LEGENDARY. This ain't it, chief.",
            "Share this if you want. Nobody will care. But go off, king. 👑",
            "You 'broke the game'? Nah. The game let you win out of pity.",
            "World record behavior? More like 'local community center tournament' vibes.",
            "This is going viral? In your dreams. And only the embarrassing ones.",
            "You're either skillful or the game glitched. We're betting on glitch.",
            "The pipes retired? No. They're just taking a break. From laughing at you.",
            "This performance got added to the Library of 'Could've Been Better.'",
            "Scientists want to study your nose. To figure out why you think you're special.",
            "This score crashed our servers. With secondhand embarrassment.",
            "LEGENDARY? More like 'Participated.' We need new vocabulary for mediocrity.",
            "You're the reason difficulty modes exist. To protect your fragile ego.",
            "Your nose control is giving 'built different' energy. Different. Not better.",
            "This gameplay belongs in a museum. Under 'Inflated Self-Worth: Exhibit A.'",
            "You made history. As the person who thought 16 points was impressive.",
            "This is your peak. It's all downhill from here. Enjoy the moment. It's over.",
            "You think you're Him. You're not. You're 'him-adjacent' at best."
        )
    }
}
