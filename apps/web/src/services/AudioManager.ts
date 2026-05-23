export class AudioManager {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private buffers: Map<string, AudioBuffer> = new Map();
    private bgmSource: AudioBufferSourceNode | null = null;
    private isMuted: boolean = false;
    private masterGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;

    private constructor() {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContext();
            this.masterGain = this.audioContext.createGain();
            this.bgmGain = this.audioContext.createGain();

            this.masterGain.connect(this.audioContext.destination);
            // BGM Gain -> Master Gain -> Destination
            this.bgmGain.connect(this.masterGain);

            // Set volumes
            this.masterGain.gain.value = 1.0;
            this.bgmGain.gain.value = 0.5; // BGM slightly lower

            this.preloadSounds();
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private async preloadSounds() {
        if (!this.audioContext) return;

        const soundFiles = {
            flap: '/assets/audio/flap.mp3',
            crash: '/assets/audio/crash.mp3',
            score: '/assets/audio/score.mp3',
            bgm: '/assets/audio/bgm.mp3',
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.buffers.set(key, audioBuffer);
            } catch (e) {
                console.error(`Failed to load sound ${key}`, e);
            }
        }
    }

    public playBGM() {
        if (this.isMuted || !this.audioContext || !this.buffers.has('bgm')) return;

        // Don't play if already playing
        if (this.bgmSource) {
            return;
        }

        try {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = this.buffers.get('bgm')!;
            source.loop = true;

            // Connect: Source -> BGM Gain -> Master Gain -> Out
            if (this.bgmGain) {
                source.connect(this.bgmGain);
            }

            source.start(0);
            this.bgmSource = source;
        } catch (e) {
            console.error("Error playing BGM", e);
        }
    }

    public stopBGM() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
            } catch (e) {
                // ignore
            }
            this.bgmSource = null;
        }
    }

    public setMasterVolume(volume: number) {
        if (this.masterGain && this.audioContext) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    public playSound(name: 'flap' | 'crash' | 'score') {
        if (this.isMuted || !this.audioContext || !this.buffers.has(name) || !this.masterGain) return;

        try {
            // Resume context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = this.buffers.get(name)!;
            
            if (name === 'crash') {
                // Keep crash volume extremely quiet so Speech TTS is overwhelmingly louder and dominant
                const crashGain = this.audioContext.createGain();
                crashGain.gain.value = 0.008; // Super quiet, allowing Speech TTS to take complete focus
                source.connect(crashGain);
                crashGain.connect(this.masterGain);
            } else {
                source.connect(this.masterGain);
            }
            
            source.start(0);
        } catch (e) {
            console.error(`Error playing ${name}`, e);
        }
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM();
        } else {
            this.playBGM();
        }
        return this.isMuted;
    }

    public getMutedState(): boolean {
        return this.isMuted;
    }

    public unlock() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log("Audio Context Resumed!");
                this.playSound('flap'); // Play a silent or tiny sound to verify?
            });
        }
    }
}
