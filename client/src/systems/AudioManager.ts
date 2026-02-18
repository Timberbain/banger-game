/**
 * AudioManager - Centralized audio system with jsfxr-generated SFX and music.
 *
 * Uses jsfxr's sfxr.toAudio() to generate playable audio objects from
 * SoundDefs parameter sets. Stored on the Phaser game registry so it
 * persists across scene transitions.
 *
 * Design decisions:
 * - Uses jsfxr's built-in Web Audio / HTMLAudioElement abstraction
 *   (sfxr.toAudio returns an object with .setVolume() and .play())
 * - Volume settings persist in localStorage
 * - Music uses HTMLAudioElement for looping support
 */

import { sfxr } from 'jsfxr';
import { SOUND_DEFS, SfxrParams } from '../config/SoundDefs';

/** Audio object returned by sfxr.toAudio() */
interface SfxrAudio {
  setVolume(v: number): SfxrAudio;
  play(): void;
  channels: AudioBufferSourceNode[];
}

export class AudioManager {
  private sounds: Map<string, SfxrAudio> = new Map();
  private wavSounds: Map<string, HTMLAudioElement> = new Map();
  private currentMusic: HTMLAudioElement | null = null;
  private sfxVolume: number;
  private musicVolume: number;
  private initialized: boolean = false;
  private volumeDipFactor: number | null = null;

  constructor() {
    this.sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.7');
    this.musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.4');
  }

  /**
   * Generate all SFX from SOUND_DEFS using jsfxr.
   * Call once during BootScene to pre-generate all audio.
   */
  init(): void {
    if (this.initialized) return;

    for (const [key, params] of Object.entries(SOUND_DEFS)) {
      try {
        const audio = sfxr.toAudio(params as any) as SfxrAudio;
        this.sounds.set(key, audio);
      } catch (e) {
        console.warn(`AudioManager: Failed to generate sound "${key}":`, e);
      }
    }

    this.initialized = true;
    console.log(`AudioManager: Initialized ${this.sounds.size} sounds`);
  }

  /**
   * Register a WAV sound file for playback.
   * WAV sounds take priority over jsfxr sounds with the same key in playSFX.
   */
  registerWAV(key: string, src: string): void {
    const audio = new Audio(src);
    this.wavSounds.set(key, audio);
  }

  /**
   * Play a WAV sound effect by key.
   * Clones the HTMLAudioElement for overlapping playback support.
   */
  playWAVSFX(key: string): void {
    const source = this.wavSounds.get(key);
    if (!source) return;
    const clone = source.cloneNode() as HTMLAudioElement;
    clone.volume = this.sfxVolume;
    clone.play().catch(() => {});
  }

  /**
   * Play a sound effect by key.
   * Each call creates a new playback instance (supports overlapping sounds).
   * Checks WAV sounds first, then falls back to jsfxr sounds.
   */
  playSFX(key: string): void {
    if (!this.initialized) return;
    if (this.sfxVolume <= 0) return;

    // Check WAV sounds first (higher priority)
    if (this.wavSounds.has(key)) {
      this.playWAVSFX(key);
      return;
    }

    const audio = this.sounds.get(key);
    if (!audio) {
      console.warn(`AudioManager: Unknown sound "${key}"`);
      return;
    }

    try {
      // sfxr.toAudio returns an object with setVolume and play
      // Each .play() call creates a new AudioBufferSourceNode internally
      audio.setVolume(this.sfxVolume);
      audio.play();
    } catch (e) {
      // Swallow autoplay policy errors silently
    }
  }

  /**
   * Start playing background music from a URL path.
   */
  playMusic(src: string, loop: boolean = true): void {
    this.stopMusic();

    try {
      this.currentMusic = new Audio(src);
      this.currentMusic.volume = this.musicVolume;
      this.currentMusic.loop = loop;
      this.currentMusic.play().catch(() => {
        // Autoplay may be blocked; will start on next user interaction
      });
    } catch (e) {
      console.warn('AudioManager: Failed to play music:', e);
    }
  }

  /**
   * Stop currently playing music.
   */
  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
    }
  }

  /**
   * Set SFX volume (0-1) and persist to localStorage.
   */
  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('sfxVolume', String(this.sfxVolume));
  }

  /**
   * Set music volume (0-1), persist to localStorage, and update current music.
   * Respects volumeDipFactor if a dip is currently active.
   */
  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('musicVolume', String(this.musicVolume));

    if (this.currentMusic) {
      if (this.volumeDipFactor !== null) {
        this.currentMusic.volume = this.musicVolume * this.volumeDipFactor;
      } else {
        this.currentMusic.volume = this.musicVolume;
      }
    }
  }

  /** Get current SFX volume. */
  getSFXVolume(): number {
    return this.sfxVolume;
  }

  /** Get current music volume. */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Check if music is currently playing.
   */
  isPlayingMusic(): boolean {
    return this.currentMusic !== null && !this.currentMusic.paused;
  }

  /**
   * Crossfade from the current music track to a new one.
   * If no music is playing, fades in the new track from silence.
   */
  crossfadeTo(src: string, loop: boolean = true, fadeDuration: number = 1000): void {
    const newAudio = new Audio(src);
    newAudio.volume = 0;
    newAudio.loop = loop;
    newAudio.play().catch(() => {});

    const oldAudio = this.currentMusic;
    this.currentMusic = newAudio;

    if (oldAudio) {
      // Fade out old track
      this.fadeVolume(oldAudio, oldAudio.volume, 0, fadeDuration, () => {
        oldAudio.pause();
      });
    }

    // Fade in new track
    const targetVolume =
      this.volumeDipFactor !== null ? this.musicVolume * this.volumeDipFactor : this.musicVolume;
    this.fadeVolume(newAudio, 0, targetVolume, fadeDuration);
  }

  /**
   * Fade out the current music track to silence.
   * On complete: pause, null currentMusic, call optional callback.
   */
  fadeOutMusic(duration: number = 500, onComplete?: () => void): void {
    if (!this.currentMusic) {
      if (onComplete) onComplete();
      return;
    }

    const audio = this.currentMusic;
    this.fadeVolume(audio, audio.volume, 0, duration, () => {
      audio.pause();
      if (this.currentMusic === audio) {
        this.currentMusic = null;
      }
      if (onComplete) onComplete();
    });
  }

  /**
   * Play music that loops with a pause between repeats.
   * Uses 'ended' event + setTimeout for the gap.
   */
  playMusicWithPause(src: string, pauseMs: number = 1000): void {
    this.stopMusic();

    const audio = new Audio(src);
    audio.volume = this.musicVolume;
    audio.loop = false;

    const onEnded = () => {
      // Stale guard: only restart if this is still the current music
      if (this.currentMusic !== audio) return;
      setTimeout(() => {
        if (this.currentMusic !== audio) return;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, pauseMs);
    };

    audio.addEventListener('ended', onEnded);
    audio.play().catch(() => {});
    this.currentMusic = audio;
  }

  /**
   * Temporarily dip the music volume by a factor (e.g. 0.3 = 30% of normal).
   * Used during stage transitions to let SFX be heard clearly.
   */
  dipMusicVolume(factor: number = 0.3): void {
    this.volumeDipFactor = factor;
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume * factor;
    }
  }

  /**
   * Restore music volume after a dip.
   */
  restoreMusicVolume(): void {
    this.volumeDipFactor = null;
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume;
    }
  }

  /**
   * Play a random WAV sound effect from a set of keys.
   */
  playRandomWAV(keys: string[]): void {
    if (keys.length === 0) return;
    const key = keys[Math.floor(Math.random() * keys.length)];
    this.playWAVSFX(key);
  }

  /**
   * Play multiple WAV sound effects simultaneously.
   */
  playMultipleWAV(keys: string[]): void {
    for (const key of keys) {
      this.playWAVSFX(key);
    }
  }

  /**
   * Linearly ramp an audio element's volume from one value to another.
   * Uses setInterval at 50ms steps.
   */
  private fadeVolume(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    duration: number,
    onComplete?: () => void,
  ): void {
    const stepMs = 50;
    const steps = Math.max(1, Math.round(duration / stepMs));
    const delta = (to - from) / steps;
    let current = from;
    let step = 0;

    audio.volume = Math.max(0, Math.min(1, from));

    const interval = setInterval(() => {
      step++;
      current += delta;

      if (step >= steps) {
        audio.volume = Math.max(0, Math.min(1, to));
        clearInterval(interval);
        if (onComplete) onComplete();
      } else {
        audio.volume = Math.max(0, Math.min(1, current));
      }
    }, stepMs);
  }

  /** Clean up all audio resources. */
  destroy(): void {
    this.stopMusic();
    this.sounds.clear();
    this.wavSounds.clear();
    this.volumeDipFactor = null;
    this.initialized = false;
  }
}
