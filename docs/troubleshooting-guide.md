# Troubleshooting Guide

This page collects the most common reasons the app may not run correctly on a fresh machine.

## Login says incorrect email or password

This usually means one of these things:

1. The Firebase project is not configured correctly in `.env.local`.
2. The account does not exist in the configured Firebase project.
3. Email/password authentication is not enabled in Firebase.
4. The app is pointing at a different Firebase project than the one that contains the account.

The app does not use a local mock credential table. It authenticates against Firebase Auth.

## The app asks for Firebase config at startup

If startup fails with a missing Firebase config error, it means the generated runtime config was not created with real values.

Fix:

- Copy `.env.example` to `.env.local`
- Fill in the real Firebase Web App values
- Run `npm start` again

## `npm start` fails before the app opens

Check these items:

- Dependencies were installed with `npm install`
- `.env.local` exists
- The Firebase values are not placeholders
- The machine has network access to Firebase

## Google login does not work

Possible causes:

- Google sign-in is not enabled in Firebase Authentication
- The current domain is not authorized in Firebase Authentication
- Popups are blocked by the browser
- The network request failed

## The running page cannot track location

The running page depends on browser geolocation.

Check that:

- The browser supports geolocation
- The user allowed location access
- The page is being tested in a secure context when required by the browser

## Icons or NgZorro components look broken

If icons or visual components look incomplete, verify that the app was started through the Angular app shell and not opened as a static file.

Also confirm that the app config still registers the required NgZorro icons.

## Best recovery path

If the local setup feels inconsistent, the safest recovery sequence is:

1. Delete `node_modules` only if you know the install is corrupted.
2. Run `npm install`.
3. Recreate `.env.local` from `.env.example`.
4. Fill in real Firebase values.
5. Run `npm start`.