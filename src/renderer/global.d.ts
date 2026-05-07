import type { MarkwrightAPI } from '../preload';

declare global {
  interface Window {
    markwright: MarkwrightAPI;
  }
}

export {};
