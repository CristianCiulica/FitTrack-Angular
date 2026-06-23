# Setup Guide

This guide explains how to install and run the app locally.

## Prerequisites

Before running the project, make sure you have:

- Node.js installed
- npm installed
- A Firebase project if you want authentication and backend features to work
- A browser that supports the Geolocation API if you want to test the running feature

## Install dependencies

From the repository root, run:

```bash
npm install
```

The repository already contains a `.npmrc` file that enables `legacy-peer-deps`, which avoids peer dependency conflicts with the installed Angular and AngularFire versions.

## Configure runtime environment

The app generates `public/firebase-config.js` from `.env.local` or environment variables.

1. Copy the example file:

```bash
cp .env.example .env.local
```

2. Replace the placeholder Firebase values with the real values from your Firebase Web App configuration.
3. Save the file.

The required keys are:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`

If these values are left as placeholders, the app may still start, but Firebase authentication and data access will not target a real project.

## Start the application

Run the development server with:

```bash
npm start
```

That script runs the runtime-config generator before serving the app.

Open the app in your browser at:

```text
http://localhost:4200/
```

## Useful scripts

- `npm start` starts the development server.
- `npm run build` creates a production build.
- `npm run watch` builds in watch mode.
- `npm test` runs the test suite.
- `npm run icons:pwa` regenerates the PWA icon set.

## Firebase setup checklist

If login is failing, verify all of these before debugging the UI:

1. The Firebase project is real and not a placeholder.
2. Email/password sign-in is enabled in Firebase Authentication.
3. The account exists in that Firebase project.
4. The web app config in `.env.local` matches that Firebase project.
5. The browser is loading the generated `public/firebase-config.js` file.

## First-run checklist

When cloning the repo on a new machine, the shortest path is:

1. Install dependencies.
2. Create `.env.local`.
3. Put real Firebase credentials into `.env.local`.
4. Run `npm start`.
5. Log in with a user that exists in the configured Firebase project.