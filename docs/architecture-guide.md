# Architecture Guide

This document explains how the application is structured and why it is built the way it is.

## Angular architecture

The application uses the modern Angular standalone component model. There is no traditional NgModule-based app shell. Instead, the app is composed from:

- `app.config.ts` for application providers
- `app.routes.ts` for top-level routing
- Feature route files for each major page
- Standalone components for UI and page logic

The root configuration registers routing, animations, HTTP, Firebase, Firestore, NgZorro icons, and the service worker.

## Lazy loading

The app is fully lazy loaded at the route level. The top router only knows where each feature lives; each feature is loaded only when the user visits it.

This helps with:

- Faster initial loading
- Smaller startup bundles
- Cleaner separation between features
- Easier maintenance as the app grows

## State management

The code uses Angular signals for local state in several places:

- The dashboard stores workouts and assistant state in signals.
- The workouts page stores workout lists, sort state, modal visibility, and expanded rows in signals.
- The auth service exposes the current user through a signal.

This keeps the state logic predictable and lightweight without introducing a heavier global store.

## Authentication flow

Authentication is handled through Firebase Auth via AngularFire.

The flow is:

1. The login page collects email and password.
2. The auth service calls Firebase Auth with `signInWithEmailAndPassword`.
3. On success, the router sends the user to the dashboard.
4. Route guards keep unauthenticated users on the auth pages.
5. Logged-in users are blocked from returning to the login page.

The login UI does not authenticate against a fake local list of users. It depends on the configured Firebase project.

## Data flow

There are two layers of state:

- Page-local state for modal visibility, filters, and UI toggles
- Service-backed state for workouts and session data

The current implementation keeps the UI responsive while still delegating data operations to services.

## Reusable UI

The app uses NgZorro components across the interface:

- Buttons
- Inputs
- Tables
- Modals
- Tags
- Cards
- Menus
- Layout primitives

This keeps the UI consistent and reduces custom component boilerplate.

## Notes on extensibility

If this project grows further, the next clean extension points are:

- Extracting more shared form components
- Adding explicit search state for the workout table
- Splitting analytics and workout storage concerns into narrower services
- Replacing any broad `any` usage with stricter typed models