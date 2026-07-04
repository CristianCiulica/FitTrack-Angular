import type { FirebaseOptions } from 'firebase/app';

interface FitTrackRuntimeConfig {
  firebase?: FirebaseOptions;
  apiBaseUrl?: string;
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
  const url = window.__FITTRACK_CONFIG__?.apiBaseUrl;
  if (!url) {
    return 'http://localhost:4000/api';
  }
  return url.replace(/\/$/, '');
}
