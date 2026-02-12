/**
 * SoundDefs.ts - jsfxr parameter objects for all procedural SFX.
 *
 * Each entry maps a sound key to a jsfxr Params-compatible object.
 * These are fed to sfxr.toAudio() to generate playable audio at boot time.
 *
 * Wave types: 0=SQUARE, 1=SAWTOOTH, 2=SINE, 3=NOISE
 * Parameters are on [0,1] unless noted SIGNED ([-1,1]).
 */

export interface SfxrParams {
  wave_type: number;
  p_env_attack: number;
  p_env_sustain: number;
  p_env_punch: number;
  p_env_decay: number;
  p_base_freq: number;
  p_freq_limit: number;
  p_freq_ramp: number;     // SIGNED
  p_freq_dramp: number;    // SIGNED
  p_vib_strength: number;
  p_vib_speed: number;
  p_arp_mod: number;       // SIGNED
  p_arp_speed: number;
  p_duty: number;
  p_duty_ramp: number;     // SIGNED
  p_repeat_speed: number;
  p_pha_offset: number;    // SIGNED
  p_pha_ramp: number;      // SIGNED
  p_lpf_freq: number;
  p_lpf_ramp: number;      // SIGNED
  p_lpf_resonance: number;
  p_hpf_freq: number;
  p_hpf_ramp: number;      // SIGNED
  sound_vol: number;
  sample_rate: number;
  sample_size: number;
}

function defaults(overrides: Partial<SfxrParams>): SfxrParams {
  return {
    wave_type: 0,
    p_env_attack: 0,
    p_env_sustain: 0.3,
    p_env_punch: 0,
    p_env_decay: 0.4,
    p_base_freq: 0.3,
    p_freq_limit: 0,
    p_freq_ramp: 0,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 1,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.25,
    sample_rate: 44100,
    sample_size: 8,
    ...overrides,
  };
}

// ============================================================
// COMBAT SOUNDS (per role)
// ============================================================

// Paran: Heavy, powerful -- low-frequency sawtooth laser blast
const paran_shoot = defaults({
  wave_type: 1, // sawtooth
  p_env_attack: 0,
  p_env_sustain: 0.15,
  p_env_punch: 0.3,
  p_env_decay: 0.25,
  p_base_freq: 0.18,
  p_freq_ramp: -0.25,
  p_duty: 0.8,
  sound_vol: 0.3,
});

// Faran: Quick high-pitch dart -- square wave, rapid
const faran_shoot = defaults({
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.05,
  p_env_punch: 0.2,
  p_env_decay: 0.12,
  p_base_freq: 0.55,
  p_freq_ramp: -0.35,
  p_duty: 0.35,
  p_hpf_freq: 0.15,
  sound_vol: 0.2,
});

// Baran: Medium-pitch energy shot -- triangle/sine wave, steady
const baran_shoot = defaults({
  wave_type: 2, // sine
  p_env_attack: 0,
  p_env_sustain: 0.1,
  p_env_punch: 0.15,
  p_env_decay: 0.18,
  p_base_freq: 0.35,
  p_freq_ramp: -0.2,
  p_arp_mod: 0.3,
  p_arp_speed: 0.6,
  sound_vol: 0.25,
});

// Paran hit: Deep thud impact
const paran_hit = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.05,
  p_env_punch: 0.4,
  p_env_decay: 0.15,
  p_base_freq: 0.15,
  p_freq_ramp: -0.3,
  p_lpf_freq: 0.4,
  sound_vol: 0.3,
});

// Faran hit: Sharp ping
const faran_hit = defaults({
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.03,
  p_env_punch: 0.5,
  p_env_decay: 0.08,
  p_base_freq: 0.6,
  p_freq_ramp: -0.4,
  p_hpf_freq: 0.2,
  sound_vol: 0.2,
});

// Baran hit: Medium crunch
const baran_hit = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.04,
  p_env_punch: 0.35,
  p_env_decay: 0.12,
  p_base_freq: 0.35,
  p_freq_ramp: -0.25,
  p_lpf_freq: 0.6,
  sound_vol: 0.25,
});

// Paran death: Low explosion -- noise, long decay, frequency slide down
const paran_death = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.2,
  p_env_punch: 0.5,
  p_env_decay: 0.5,
  p_base_freq: 0.2,
  p_freq_ramp: -0.15,
  p_vib_strength: 0.2,
  p_vib_speed: 0.3,
  sound_vol: 0.35,
});

// Faran death: High shatter -- noise, short, freq slide up then down
const faran_death = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.1,
  p_env_punch: 0.6,
  p_env_decay: 0.3,
  p_base_freq: 0.5,
  p_freq_ramp: 0.15,
  p_freq_dramp: -0.3,
  p_hpf_freq: 0.1,
  sound_vol: 0.3,
});

// Baran death: Medium crumble -- noise, medium duration
const baran_death = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.15,
  p_env_punch: 0.4,
  p_env_decay: 0.4,
  p_base_freq: 0.3,
  p_freq_ramp: -0.1,
  p_lpf_freq: 0.5,
  sound_vol: 0.3,
});

// ============================================================
// MOVEMENT SOUNDS
// ============================================================

// Wall impact: Stone/metal clang -- noise burst, very short
const wall_impact = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.02,
  p_env_punch: 0.6,
  p_env_decay: 0.1,
  p_base_freq: 0.4,
  p_freq_ramp: -0.5,
  p_lpf_freq: 0.7,
  sound_vol: 0.2,
});

// Speed whoosh: Wind rushing -- noise, longer, fading
const speed_whoosh = defaults({
  wave_type: 3, // noise
  p_env_attack: 0.1,
  p_env_sustain: 0.2,
  p_env_punch: 0,
  p_env_decay: 0.3,
  p_base_freq: 0.05,
  p_freq_ramp: 0.05,
  p_lpf_freq: 0.3,
  p_hpf_freq: 0.05,
  sound_vol: 0.1,
});

// ============================================================
// UI SOUNDS
// ============================================================

// Button click: Short beep -- square wave, very high freq
const button_click = defaults({
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.02,
  p_env_punch: 0,
  p_env_decay: 0.05,
  p_base_freq: 0.6,
  p_duty: 0.4,
  p_hpf_freq: 0.3,
  sound_vol: 0.15,
});

// Countdown beep: Rising tone -- square wave, ascending frequency
const countdown_beep = defaults({
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.08,
  p_env_punch: 0.1,
  p_env_decay: 0.1,
  p_base_freq: 0.45,
  p_freq_ramp: 0.1,
  p_duty: 0.3,
  sound_vol: 0.2,
});

// Match start fanfare: Quick ascending notes -- square wave, freq slide up
const match_start_fanfare = defaults({
  wave_type: 0, // square
  p_env_attack: 0,
  p_env_sustain: 0.12,
  p_env_punch: 0.3,
  p_env_decay: 0.2,
  p_base_freq: 0.35,
  p_freq_ramp: 0.25,
  p_arp_mod: 0.5,
  p_arp_speed: 0.5,
  p_duty: 0.4,
  sound_vol: 0.25,
});

// Match end fanfare: Descending notes -- triangle/sine wave, freq slide down
const match_end_fanfare = defaults({
  wave_type: 2, // sine
  p_env_attack: 0.02,
  p_env_sustain: 0.2,
  p_env_punch: 0.2,
  p_env_decay: 0.35,
  p_base_freq: 0.5,
  p_freq_ramp: -0.15,
  p_arp_mod: -0.3,
  p_arp_speed: 0.4,
  sound_vol: 0.25,
});

// Ready chime: Pleasant ding -- sine wave, high freq, short decay
const ready_chime = defaults({
  wave_type: 2, // sine
  p_env_attack: 0,
  p_env_sustain: 0.05,
  p_env_punch: 0.2,
  p_env_decay: 0.2,
  p_base_freq: 0.55,
  p_arp_mod: 0.4,
  p_arp_speed: 0.6,
  sound_vol: 0.2,
});

// ============================================================
// EXPORT
// ============================================================

export const SOUND_DEFS: Record<string, SfxrParams> = {
  // Combat per role
  paran_shoot,
  faran_shoot,
  baran_shoot,
  paran_hit,
  faran_hit,
  baran_hit,
  paran_death,
  faran_death,
  baran_death,
  // Movement
  wall_impact,
  speed_whoosh,
  // UI
  button_click,
  countdown_beep,
  match_start_fanfare,
  match_end_fanfare,
  ready_chime,
};
