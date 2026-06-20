import { createAudioPlayer, AudioPlayer } from "expo-audio";
import AudioFiles from "./Audio";

// Sound is on by default on every platform, web included. Browsers block
// audio until the first user gesture, but every in-game sound is triggered
// after the player taps (connect / play / move), so the audio context is
// already unlocked by the time anything plays. A runtime flag (not a
// platform constant) lets a mute toggle turn it off.
let soundMuted = false;

class AudioManager {
  sounds = AudioFiles;

  setMuted = (value: boolean) => {
    soundMuted = value;
  };
  isMuted = () => soundMuted;
  toggleMuted = () => {
    soundMuted = !soundMuted;
    return soundMuted;
  };

  audioFileMoveIndex = 0;

  playMoveSound = async () => {
    await this.playAsync(
      this.sounds.yeti.move[`${this.audioFileMoveIndex}`]
    );
    this.audioFileMoveIndex =
      (this.audioFileMoveIndex + 1) %
      Object.keys(this.sounds.yeti.move).length;
  };

  playPassiveCarSound = async () => {
    if (Math.floor(Math.random() * 2) === 0) {
      await this.playAsync(this.sounds.car.passive[`1`]);
    }
  };

  playDeathSound = async () => {
    const dieKeys = Object.keys(this.sounds.yeti.die);
    await this.playAsync(
      this.sounds.yeti.die[dieKeys[Math.floor(Math.random() * dieKeys.length)]]
    );
  };

  playCarHitSound = async () => {
    await this.playAsync(
      this.sounds.car.die[`${Math.floor(Math.random() * 2)}`]
    );
  };

  _soundCache: Record<number, AudioPlayer[]> = {};

  getIdleSoundAsync = async (resourceId: number) => {
    if (this._soundCache[resourceId]) {
      for (const player of this._soundCache[resourceId]) {
        if (!player.playing) {
          return player;
        }
      }
    }
    return null;
  };

  createIdleSoundAsync = async (resourceId: number) => {
    if (!this._soundCache[resourceId]) {
      this._soundCache[resourceId] = [];
    }
    const tag = "loaded-sound-" + resourceId;
    console.time(tag);
    const player = createAudioPlayer(resourceId);
    console.timeEnd(tag);
    this._soundCache[resourceId].push(player);
    return player;
  };

  playAsync = async (soundObject: number) => {
    if (soundMuted) return;

    try {
      let player = await this.getIdleSoundAsync(soundObject);
      if (!player) {
        player = await this.createIdleSoundAsync(soundObject);
      } else {
        player.seekTo(0);
      }
      player.play();
    } catch (e) {
      // Web autoplay restrictions or a transient audio glitch — a missed
      // sound effect must never break gameplay.
      console.warn("Audio play failed", e);
    }
  };

  stopAsync = async (name: string) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        // Stop all cached players for this sound
        if (this._soundCache[soundObject]) {
          for (const player of this._soundCache[soundObject]) {
            player.pause();
            player.seekTo(0);
          }
        }
      } catch (error) {
        console.warn("Error stopping audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  volumeAsync = async (name: string, volume: number) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        // Set volume on all cached players for this sound
        if (this._soundCache[soundObject]) {
          for (const player of this._soundCache[soundObject]) {
            player.volume = volume;
          }
        }
      } catch (error) {
        console.warn("Error setting volume of audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  pauseAsync = async (name: string) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        // Pause all cached players for this sound
        if (this._soundCache[soundObject]) {
          for (const player of this._soundCache[soundObject]) {
            player.pause();
          }
        }
      } catch (error) {
        console.warn("Error pausing audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  get assets() {
    return AudioFiles;
  }

  setupAsync = async () => {
    // noop -- maybe preload some common sounds upfront
    return true;
  };
}

export default new AudioManager();
