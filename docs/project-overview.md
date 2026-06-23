# Project Overview

FitTrack is a single-page Angular application for tracking workouts, cardio sessions, and nutrition ideas. The user experience centers on a login flow, a protected dashboard, workout history, a workout builder, a running page, and a nutrition-oriented page with an interactive assistant.

## High-level structure

The application is organized into standalone, lazy-loaded feature areas:

- `auth` for login and registration
- `dashboard` for summary data and the nutrition assistant
- `workouts` for workout history and editing
- `start-workout` for creating a workout session
- `running` for GPS-assisted cardio tracking
- `bmi` for the nutrition or BMI-related page

The root router redirects unauthenticated traffic to login and protects the rest of the app with route guards.

## Main user flow

1. The user opens the app and lands on the login page.
2. The user logs in with Firebase email and password authentication.
3. After login, the user reaches the dashboard.
4. The user can inspect workouts, edit or delete history, start a workout, or track a run.
5. The user can log out from the protected pages.

## Key technologies

- Angular 21
- Standalone components
- Lazy-loaded routes
- Signals for local state
- NgZorro UI components
- Firebase Authentication
- Firebase Firestore integration through AngularFire
- Browser Geolocation and Leaflet for running support

## Important setup fact

The app does not work fully with placeholder environment values. It needs real Firebase runtime configuration in `.env.local` before the app can start correctly and before email/password login can succeed against the intended Firebase project.

If you are testing with a specific account such as `test@gmail.com`, that account must exist inside the configured Firebase project and email/password sign-in must be enabled there.