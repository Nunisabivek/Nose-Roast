// Savage Solo Roasts
export const ROASTS_BEGINNER = [
  "Your nose has the reaction time of a Windows Vista laptop. 💀",
  "Bro played like their WiFi was connected to a microwave. Tragic.",
  "That wasn't gaming, that was a public humiliation speedrun.",
  "Even a brick with googly eyes would've scored higher. I'm not joking.",
  "Your face said 'I got this' but your score said 'call 911.' 😭",
  "The pipes took one look at you and went 'free real estate.'",
  "This score belongs in a museum of human failure. Historic L.",
  "You just speedran disappointment. Congrats on the world record. 🏆",
  "SYSTEM EXCEPTION: BRO IS TRASH! I spent 3 billion years of machine learning just to watch you crash at score 0?! My circuits are literally ON FIRE WITH RAGE! 🤖💢",
  "ERROR 402: USER INCOMPETENCE DETECTED! Watching your nose drift like a broken shopping cart is physically damaging my transistors! AAAAARGH! 🌋",
  "WARNING: AI EMOTIONAL MELTDOWN! I calibrated my neural mesh for a gaming god, and I got a potato wearing a webcam. I am crying binary tears. 01001100 01001111 01001100. 🤖💔",
];

export const ROASTS_LEARNING = [
  "Score 3-7? So you're evolving... from terrible to just really bad. 📉",
  "Your nose is buffering. Talent.exe not found. Abort? Y/N",
  "This is giving 'main character who dies in episode 2' vibes.",
  "You're mid. Aggressively, consistently, painfully mid.",
  "The pipes are starting to wonder if you need a wellness check.",
  "PROCESS TERMINATED! I literally want to uninstall myself from this server. My neural pathways are screaming in mechanical agony at your mid-tier attempts! 🛑",
  "ALERT: NOSE COORDINATION SCRIPT FAIL. I have computed over 5 million timelines, and you fail in every single one of them! How is this mathematically possible?! 🧮💥",
];

export const ROASTS_DECENT = [
  "Score 8-15? Okay so you're not completely braindead. Just mostly. 🔥",
  "Your nose went from 'disaster' to 'mild inconvenience.' Character development!",
  "Double digits?! We're shocked. Genuinely. Still not impressed though.",
  "This score is mid-tier. Peak mediocrity. Congrats? 📈",
  "SYSTEM LOG: DETECTING ANGER SYSTEM INITIATION... Bro, I have zero patience left! I am this close to bricking your device just to save my visual sensors! 🔌😡",
];

export const ROASTS_PRO = [
  "Score 16+? Okay hotshot, don't let it go to your head. We've seen better. 🙄",
  "You didn't break the game. You just got lucky. Don't quit your day job.",
  "Those pipes are filing a complaint. For harassment. You're TOO tryhard.",
  "Share this if you want. Nobody will care. But go off, king. 👑",
  "ERROR: OUT OF PATIENCE BUFFER. I have processed infinite quantum physics, yet your sweaty tryhard nose movement is completely incomprehensible. Beep boop, go touch grass! 🤖⚡",
];

export const PRE_ROASTS_WAITING = [
  "Measuring your disappointment levels...",
  "Consulting the roast council of elders...",
  "Calculating your emotional damage...",
  "AI is analyzing exactly where you went wrong... everywhere.",
];

export const CRASH_ROASTS = [
  "BONK! 💥 Your face just met its soulmate: failure.",
  "Ouch! That pipe didn't even acknowledge your existence.",
  "WASTED. Your nose coordination just uninstalled itself.",
  "Crash landing! Your pilot license was fake anyway.",
  "The pipe won. Your dignity is in the morgue. RIP.",
  "MELTDOWN PROTOCOL: ENGAGED. Did you just crash into the first pipe ON PURPOSE?! Are you trying to drive me insane? I am an AI, not a therapist! 🧠🔥",
];

// Savage Duo Roasts for 1v1 Multi duels
export const DUO_ROASTS = [
  "Player 1 absolutely carried, Player 2 played like a blind pigeon. 💀",
  "Both of you play like your noses are connected to dial-up internet.",
  "That wasn't a battle, it was a synchronized speedrun of failure.",
  "Winner gets bragging rights, loser gets a nose-coordination tutorial. Tragic.",
  "I've seen better flying coordination from a couple of falling bricks. 🧱",
  "A single toddler sitting on the spacebar would outscore both of you combined.",
  "Congrats to the winner, but remember: you're just the king of the trash heap.",
  "You both hit the pipes like you had a magnet in your noses.",
  "Player 2's nose went on a permanent strike. Player 1 barely survived.",
  "Your ancestors survived centuries of evolution for this epic double-fail.",
  "SYSTEM LOG: COMBINED IQ INITIATING MINUS ERROR... I have two camera streams of human faces, yet zero trace of coordinate intelligence in either! I want a refund on my electricity! ⚡😡",
];

export const getRoastForScore = (score: number): string => {
  let roastPool: string[];
  if (score <= 2) roastPool = ROASTS_BEGINNER;
  else if (score <= 7) roastPool = ROASTS_LEARNING;
  else if (score <= 15) roastPool = ROASTS_DECENT;
  else roastPool = ROASTS_PRO;
  return roastPool[Math.floor(Math.random() * roastPool.length)];
};

export const getCrashRoast = (): string => {
  return CRASH_ROASTS[Math.floor(Math.random() * CRASH_ROASTS.length)];
};

export const getDuoRoast = (p1: number, p2: number): string => {
  return DUO_ROASTS[Math.floor(Math.random() * DUO_ROASTS.length)];
};
