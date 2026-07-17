import type { FirebaseOptions } from 'firebase/app';

interface FitTrackRuntimeConfig {
  firebase?: FirebaseOptions;
  /** setat doar cand API_BASE_URL a fost dat explicit la build */
  apiBaseUrl?: string | null;
  localApiBaseUrl?: string;
  prodApiBaseUrl?: string;
}

declare global {
  interface Window {
    __FITTRACK_CONFIG__?: FitTrackRuntimeConfig;
  }
}

export function getFirebaseConfig(): FirebaseOptions {
  const config = window.__FITTRACK_CONFIG__?.firebase;

  if (!config?.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error(
      'Firebase runtime configuration is missing. Run "npm run config" before starting or building the app.',
    );
  }

  return config;
}

export function getApiBaseUrl(): string {
  const config = window.__FITTRACK_CONFIG__;

  // URL fortat explicit la build (API_BASE_URL) are prioritate
  if (config?.apiBaseUrl) {
    return config.apiBaseUrl.replace(/\/$/, '');
  }

  // altfel alegem la runtime: pe localhost -> backend-ul local, pe web -> Render.
  // asa acelasi build merge si in dev si in productie, fara variabile de mediu.
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const url = isLocalhost
    ? config?.localApiBaseUrl || 'http://localhost:4000/api'
    : config?.prodApiBaseUrl || 'https://fittrack-angular.onrender.com/api';
  return url.replace(/\/$/, '');
}
