/**
 * Procedural Web Audio API Sound Synthesizer & Arcade Chiptune Engine
 * Inspired by 90s SNK Neo-Geo / Capcom CPS2 arcade hardware (YM2610 / QSound).
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  
  private sfxVolume: number = 1.0;
  private bgmVolume: number = 0.5;
  private sfxMuted: boolean = false;
  private bgmMuted: boolean = false;

  private currentBgmLoop: number | null = null;
  private currentBgmNodes: AudioNode[] = [];
  private currentBgmTrack: string | null = null;
  private bgmAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('fighter_xp_settings_v1');
        if (raw) {
          const parsed = JSON.parse(raw) as {
            soundVolume?: number;
            musicVolume?: number;
            soundMuted?: boolean;
            musicMuted?: boolean;
            audioDefaultsV2Applied?: boolean;
          };
          if (parsed.audioDefaultsV2Applied) {
            if (typeof parsed.soundVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, parsed.soundVolume));
            if (typeof parsed.musicVolume === 'number') this.bgmVolume = Math.max(0, Math.min(1, parsed.musicVolume));
          } else {
            this.sfxVolume = 1.0;
            this.bgmVolume = 0.5;
          }
          this.sfxMuted = Boolean(parsed.soundMuted);
          this.bgmMuted = Boolean(parsed.musicMuted);
        }
      } catch {
        // ignore storage read error
      }
    }
  }

  private bgmFilter: BiquadFilterNode | null = null;

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmMuted ? 0 : this.bgmVolume * 0.48, this.ctx.currentTime);

      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.setValueAtTime(2600, this.ctx.currentTime);
      this.bgmFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);
      this.bgmGain.connect(this.bgmFilter);
      this.bgmFilter.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
    }
  }

  private getBgmLinearVolume(): number {
    if (this.bgmMuted || this.bgmVolume <= 0) return 0;
    return Math.max(0, Math.min(1, Math.pow(this.bgmVolume, 0.72) * 0.92));
  }

  public setBgmVolume(val: number) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.getBgmLinearVolume();
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmMuted ? 0 : this.bgmVolume * 0.48, this.ctx.currentTime);
    }
  }

  public setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
    this.setSfxVolume(this.sfxVolume);
    if (!muted && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setBgmMuted(muted: boolean) {
    this.bgmMuted = muted;
    this.setBgmVolume(this.bgmVolume);
    if (muted) {
      this.stopBgm();
    } else if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public toggleMuteSfx(): boolean {
    this.sfxMuted = !this.sfxMuted;
    this.setSfxVolume(this.sfxVolume);
    return this.sfxMuted;
  }

  public toggleMuteBgm(): boolean {
    this.bgmMuted = !this.bgmMuted;
    this.setBgmVolume(this.bgmVolume);
    if (this.bgmMuted) {
      this.stopBgm();
    }
    return this.bgmMuted;
  }

  public isMuted() {
    return { sfx: this.sfxMuted, bgm: this.bgmMuted };
  }

  public isBgmPlaying(): boolean {
    return Boolean(this.bgmAudio && !this.bgmAudio.paused && !this.bgmMuted && this.currentBgmTrack !== null);
  }

  public getVolumes() {
    return { sfx: this.sfxVolume, bgm: this.bgmVolume };
  }

  // --- SOUND EFFECTS ---

  public playPunch(heavy: boolean = false) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    // Whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(heavy ? 220 : 380, t);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 60 : 100, t + (heavy ? 0.16 : 0.08));

    gain.gain.setValueAtTime(heavy ? 0.45 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.16 : 0.08));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + (heavy ? 0.16 : 0.08));
  }

  public playKick(heavy: boolean = false) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 320 : 450, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + (heavy ? 0.18 : 0.1));

    gain.gain.setValueAtTime(heavy ? 0.5 : 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.18 : 0.1));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + (heavy ? 0.18 : 0.1));
  }

  public playHit(heavy: boolean = false, type: 'normal' | 'fire' | 'slash' | 'chi' = 'normal') {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const dur = heavy ? 0.28 : 0.14;

    // Noise burst for impact slap
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = type === 'slash' ? 'highpass' : type === 'chi' ? 'bandpass' : 'lowpass';
    noiseFilter.frequency.setValueAtTime(heavy ? 900 : 1800, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(heavy ? 0.7 : 0.45, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(t);

    // Sub thud for weight
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(heavy ? 120 : 160, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + dur);

    subGain.gain.setValueAtTime(heavy ? 0.8 : 0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(t);
    subOsc.stop(t + dur);

    // Harmonic sparkle for special hits
    if (type === 'fire' || type === 'chi') {
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(type === 'fire' ? 680 : 880, t);
      chime.frequency.exponentialRampToValueAtTime(220, t + dur * 1.2);
      chimeGain.gain.setValueAtTime(0.3, t);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.2);
      chime.connect(chimeGain);
      chimeGain.connect(this.sfxGain);
      chime.start(t);
      chime.stop(t + dur * 1.2);
    }
  }

  public playBlock() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    // High metallic cling/deflection
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);

    // Filtered clink
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(950, t);
    gain2.gain.setValueAtTime(0.15, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t);
    osc2.stop(t + 0.08);
  }

  public playJump() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.14);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playLand() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playProjectileLaunch(type: 'fire' | 'plasma' | 'sonic' | 'chi' | 'lightning' | 'shadow' | 'seismic' | 'tempest' | string) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    if (type === 'fire') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    } else if (type === 'plasma') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
    } else if (type === 'sonic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);
    } else if (type === 'lightning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    } else if (type === 'shadow') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.22);
    } else if (type === 'seismic') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    } else if (type === 'tempest') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(720, t + 0.24);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.25);
    }

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playSuperFlash() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    // Dramatic rising energy pitch sweep & screen flash boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.4);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);

    // Deep sub bass impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t + 0.35);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    subGain.gain.setValueAtTime(0.8, t + 0.35);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(t + 0.35);
    sub.stop(t + 0.85);
  }

  public playUiMove() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.035);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playUiSelect() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.setValueAtTime(659.25, t + 0.055); // E5
    osc.frequency.setValueAtTime(783.99, t + 0.11); // G5

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  public playCoinPickup() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.055); // E6

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playAchievementUnlock() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.16, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.25);
    });
  }

  public playHealAndXp() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.055);
      gain.gain.setValueAtTime(0.18, t + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.22);
    });
  }

  // Announcer vocal synth chords
  public playAnnouncer(text: 'ROUND_1' | 'ROUND_2' | 'FINAL_ROUND' | 'FIGHT' | 'KO' | 'YOU_WIN' | 'PERFECT' | 'TIME_UP') {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sfxMuted) return;

    const t = this.ctx.currentTime;
    const chords: Record<string, number[]> = {
      ROUND_1: [220, 277, 330, 440],
      ROUND_2: [246, 311, 370, 493],
      FINAL_ROUND: [185, 220, 277, 370],
      FIGHT: [330, 415, 494, 659, 880],
      KO: [130, 164, 196, 261],
      YOU_WIN: [261, 329, 392, 523, 659],
      PERFECT: [392, 493, 587, 783, 987],
      TIME_UP: [220, 207, 196, 185],
    };

    const freqs = chords[text] || [440, 554, 659];
    const duration = text === 'FIGHT' || text === 'KO' ? 0.7 : 0.5;

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      if (text === 'FIGHT') {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + duration * 0.7);
      } else if (text === 'KO') {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + duration);
      }

      gain.gain.setValueAtTime(0.18 / freqs.length, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + duration);
    });
  }

  // --- STUDIO-MASTERED MULTI-SECTION LOBBY SONG PLAYBACK ---

  public playBgm(theme: string = 'lobby') {
    if (typeof window === 'undefined' || this.bgmMuted) return;

    if (!this.bgmAudio) {
      this.bgmAudio = new Audio('/assets/audio/lobby_theme.mp3');
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
    }

    this.currentBgmTrack = theme;
    this.bgmAudio.volume = this.getBgmLinearVolume();

    if (this.bgmAudio.paused) {
      void this.bgmAudio.play().catch(() => {
        // Browser autoplay blocked until user gesture; caller retries on pointerdown/keydown
      });
    }
  }

  public stopBgm() {
    if (this.currentBgmLoop !== null) {
      clearInterval(this.currentBgmLoop);
      this.currentBgmLoop = null;
    }
    this.currentBgmNodes.forEach(node => {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.currentBgmNodes = [];
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.pause();
    }
    this.currentBgmTrack = null;
  }
}

export const soundManager = new SoundManager();
