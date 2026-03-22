import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadSound('like', 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
      this.loadSound('click', 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      this.loadSound('pop', 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3');
      this.loadSound('success', 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
      this.loadSound('error', 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
      this.loadSound('trash', 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3');
      this.loadSound('coin', 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
      this.loadSound('sparkle', 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');
    }
  }

  private loadSound(name: string, url: string) {
    const audio = new Audio(url);
    audio.volume = 0.2;
    this.sounds[name] = audio;
  }

  play(name: string) {
    if (!this.enabled || !this.sounds[name]) return;
    const sound = this.sounds[name].cloneNode() as HTMLAudioElement;
    sound.volume = 0.2;
    sound.play().catch(() => {});
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const soundManager = new SoundManager();

export function useSound() {
  return {
    play: (name: string) => soundManager.play(name),
    setEnabled: (enabled: boolean) => soundManager.setEnabled(enabled)
  };
}
