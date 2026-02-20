declare module 'jsfxr' {
  interface SfxrAudioObject {
    setVolume(v: number): SfxrAudioObject;
    play(): void;
    channels: AudioBufferSourceNode[];
  }

  interface SfxrAPI {
    toAudio(synthdef: Record<string, unknown>): SfxrAudioObject;
    toWave(synthdef: Record<string, unknown>): unknown;
    toBuffer(synthdef: Record<string, unknown>): ArrayBuffer;
    toWebAudio(
      synthdef: Record<string, unknown>,
      audiocontext?: AudioContext,
    ): AudioBufferSourceNode;
    play(synthdef: Record<string, unknown>): void;
    b58decode(encoded: string): Record<string, unknown>;
    b58encode(synthdef: Record<string, unknown>): string;
    generate(algorithm: string, options?: Record<string, unknown>): Record<string, unknown>;
  }

  export const sfxr: SfxrAPI;
  export const jsfxr: {
    sfxr: SfxrAPI;
  };
  export default jsfxr;
}
