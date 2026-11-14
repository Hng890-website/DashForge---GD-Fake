// Procedural Web Audio API Rhythm & SFX Engine for DashForge

const NOTE_FREQ: Record<string, number> = {
  C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, G2: 98.0, Ab2: 103.83, A2: 110.0, Bb2: 116.54, B2: 123.47,
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.0, Ab4: 415.30, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99, Ab5: 830.61, A5: 880.0, Bb5: 932.33, B5: 987.77,
};

interface TrackPattern {
  bpm: number;
  bass: (string | null)[];
  lead: (string | null)[];
  wave: OscillatorType;
}

const TRACKS: Record<string, TrackPattern> = {
  stereo_pulse: {
    bpm: 108,
    wave: 'square',
    bass: ['C2', null, 'C3', null, 'Ab2', null, 'Ab2', null, 'Bb2', null, 'Bb2', null, 'G2', null, 'G2', null],
    lead: ['C4', null, 'Eb4', 'G4', 'C5', null, 'G4', null, 'Ab4', null, 'G4', 'Eb4', 'F4', 'Eb4', 'D4', null],
  },
  back_on_beat: {
    bpm: 118,
    wave: 'sawtooth',
    bass: ['F2', 'F2', 'F3', null, 'Db2', 'Db2', 'Db3', null, 'Eb2', 'Eb2', 'Eb3', null, 'C2', 'C2', 'G2', null],
    lead: ['F4', null, 'Ab4', null, 'C5', 'Bb4', 'Ab4', 'G4', 'Eb4', null, 'G4', 'Bb4', 'C5', null, 'G4', null],
  },
  polargeist_dash: {
    bpm: 126,
    wave: 'sawtooth',
    bass: ['A2', null, 'A3', 'A2', 'F2', null, 'F3', 'F2', 'C3', null, 'C3', 'G2', 'E2', null, 'E3', 'G2'],
    lead: ['A4', 'C5', 'E5', null, 'A4', 'C5', 'F5', 'E5', 'G4', 'C5', 'E5', null, 'E4', 'G4', 'B4', 'E5'],
  },
  dry_gravity: {
    bpm: 132,
    wave: 'square',
    bass: ['E2', 'E2', 'E3', null, 'D2', 'D2', 'D3', null, 'C2', 'C2', 'C3', null, 'B2', 'B2', 'B2', 'E3'],
    lead: ['E4', 'G4', 'B4', 'E5', 'D5', 'B4', 'A4', 'G4', 'E4', 'G4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4'],
  },
  cycles_neon: {
    bpm: 138,
    wave: 'sawtooth',
    bass: ['D2', null, 'D3', 'D2', 'Bb2', null, 'Bb2', 'F2', 'G2', null, 'G3', 'G2', 'A2', null, 'A3', 'E2'],
    lead: ['D5', 'A4', 'F4', 'D5', 'Bb4', 'F4', 'D4', 'Bb4', 'G4', 'D5', 'Bb4', 'G4', 'A4', 'E5', 'C5', 'A4'],
  },
  deadlocked_core: {
    bpm: 148,
    wave: 'sawtooth',
    bass: ['C2', 'C3', 'C2', 'Eb2', 'G2', 'C3', 'Bb2', 'G2', 'Ab2', 'Ab2', 'Eb2', 'Ab2', 'G2', 'G2', 'D2', 'G2'],
    lead: ['C5', 'Eb5', 'G5', 'C5', 'Bb4', 'G4', 'Eb4', 'G4', 'Ab4', 'C5', 'Eb5', 'Ab4', 'G4', 'B4', 'D5', 'G5'],
  },
  practice_loop: {
    bpm: 112,
    wave: 'triangle',
    bass: ['C3', null, 'G2', null, 'A2', null, 'E2', null, 'F2', null, 'C3', null, 'G2', null, 'G2', null],
    lead: ['E4', null, 'G4', 'C5', null, 'B4', 'A4', null, 'A4', 'G4', 'F4', 'E4', 'D4', null, 'G4', null],
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicVol = 0.55;
  private sfxVol = 0.7;
  private lastStep = -1;
  private activeSongId = 'stereo_pulse';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolumes(music: number, sfx: number) {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
  }

  public resetSong(songId: string) {
    this.activeSongId = songId;
    this.lastStep = -1;
  }

  public tickSong(songTime: number, isPractice: boolean) {
    if (this.musicVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const patternKey = isPractice ? 'practice_loop' : this.activeSongId;
    const track = TRACKS[patternKey] || TRACKS.stereo_pulse;
    const stepDuration = 60 / track.bpm / 2; // 8th-note steps
    const stepIndex = Math.floor(songTime / stepDuration);
    if (stepIndex === this.lastStep || stepIndex < 0) return;
    this.lastStep = stepIndex;

    const i = stepIndex % 16;
    const now = ctx.currentTime;

    // Kick on 0, 4, 8, 12
    if (i % 4 === 0) {
      this.playKick(ctx, now, 0.24 * this.musicVol);
    }
    // Snare/clap on 4, 12
    if (i === 4 || i === 12) {
      this.playSnare(ctx, now, 0.14 * this.musicVol);
    }
    // Hi-hat on offbeats
    if (i % 2 === 1) {
      this.playHat(ctx, now, 0.05 * this.musicVol);
    }

    const bassNote = track.bass[i];
    if (bassNote && NOTE_FREQ[bassNote]) {
      this.playTone(ctx, NOTE_FREQ[bassNote], 'sawtooth', now, stepDuration * 0.8, 0.14 * this.musicVol, 420);
    }

    const leadNote = track.lead[i];
    if (leadNote && NOTE_FREQ[leadNote]) {
      this.playTone(ctx, NOTE_FREQ[leadNote], track.wave, now, stepDuration * 0.75, 0.09 * this.musicVol, 1800);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    startTime: number,
    dur: number,
    vol: number,
    cutoff: number
  ) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private playKick(ctx: AudioContext, startTime: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, startTime);
    osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.11);
    gain.gain.setValueAtTime(Math.max(0.001, vol), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.13);
  }

  private playSnare(ctx: AudioContext, startTime: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, startTime);
    osc.frequency.exponentialRampToValueAtTime(90, startTime + 0.08);
    gain.gain.setValueAtTime(Math.max(0.001, vol), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }

  private playHat(ctx: AudioContext, startTime: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(6400, startTime);
    gain.gain.setValueAtTime(Math.max(0.001, vol), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.025);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.03);
  }

  public playJump() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.07);
    gain.gain.setValueAtTime(0.14 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playOrb() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, 520, 'sine', now, 0.09, 0.2 * this.sfxVol, 3000);
    this.playTone(ctx, 780, 'triangle', now + 0.02, 0.1, 0.15 * this.sfxVol, 3200);
  }

  public playPad() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.2 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playPortal() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, 440, 'sine', now, 0.12, 0.12 * this.sfxVol, 2400);
    this.playTone(ctx, 660, 'sine', now + 0.03, 0.12, 0.12 * this.sfxVol, 2400);
  }

  public playCoin() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, 987.77, 'sine', now, 0.08, 0.22 * this.sfxVol, 4000);
    this.playTone(ctx, 1318.51, 'sine', now + 0.07, 0.18, 0.22 * this.sfxVol, 4000);
  }

  public playDeath() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    gain.gain.setValueAtTime(0.28 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playWin() {
    if (this.sfxVol <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(ctx, f, 'triangle', now + idx * 0.08, 0.28, 0.22 * this.sfxVol, 4000);
    });
  }
}

export const soundEngine = new SoundEngine();
