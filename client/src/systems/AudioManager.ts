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
  private currentMusic: HTMLAudioElement | null = null;
  private sfxVolume: number;
  private musicVolume: number;
  private initialized: boolean = false;

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
   * Play a sound effect by key.
   * Each call creates a new playback instance (supports overlapping sounds).
   */
  playSFX(key: string): void {
    if (!this.initialized) return;
    if (this.sfxVolume <= 0) return;

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
   */
  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('musicVolume', String(this.musicVolume));

    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume;
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

  /** Clean up all audio resources. */
  destroy(): void {
    this.stopMusic();
    this.sounds.clear();
    this.initialized = false;
  }
}
