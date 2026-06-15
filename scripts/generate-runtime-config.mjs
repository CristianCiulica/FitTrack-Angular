import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDirectory = resolve(import.meta.dirname, '..');

function loadEnvironmentFile(fileName) {
  const filePath = resolve(rootDirectory, fileName);
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return values;

      const separatorIndex = trimmedLine.indexOf('=');
      if (separatorIndex < 1) return values;

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      values[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
      return values;
    }, {});
}

const fileEnvironment = {
  ...loadEnvironmentFile('.env'),
  ...loadEnvironmentFile('.env.local'),
};

const readValue = (name) => {
  const value = (process.env[name] || fileEnvironment[name] || '').trim();
  const assignmentPrefix = `${name}=`;

  return value.startsWith(assignmentPrefix)
    ? value.slice(assignmentPrefix.length).trim()
    : value;
};

const firebase = {
  apiKey: readValue('FIREBASE_API_KEY'),
  authDomain: readValue('FIREBASE_AUTH_DOMAIN'),
  projectId: readValue('FIREBASE_PROJECT_ID'),
  storageBucket: readValue('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readValue('FIREBASE_MESSAGING_SENDER_ID'),
  appId: readValue('FIREBASE_APP_ID'),
  measurementId: readValue('FIREBASE_MEASUREMENT_ID'),
};

const requiredFields = [
  ['FIREBASE_API_KEY', firebase.apiKey],
  ['FIREBASE_AUTH_DOMAIN', firebase.authDomain],
  ['FIREBASE_PROJECT_ID', firebase.projectId],
  ['FIREBASE_STORAGE_BUCKET', firebase.storageBucket],
  ['FIREBASE_MESSAGING_SENDER_ID', firebase.messagingSenderId],
  ['FIREBASE_APP_ID', firebase.appId],
];
const missingFields = requiredFields
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingFields.length) {
  throw new Error(
    `Missing Firebase configuration: ${missingFields.join(', ')}. Copy .env.example to .env.local and fill in the values.`,
  );
}

const outputDirectory = resolve(rootDirectory, 'public');
const outputPath = resolve(outputDirectory, 'firebase-config.js');
mkdirSync(outputDirectory, { recursive: true });

writeFileSync(
  outputPath,
  `window.__FITTRACK_CONFIG__ = Object.freeze(${JSON.stringify({ firebase }, null, 2)});\n`,
  'utf8',
);

console.log('Generated public/firebase-config.js');
