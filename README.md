# FitTrackAngular

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.11.

## Development server

Copy the Firebase runtime configuration template:

```bash
cp .env.example .env.local
```

Fill in the Firebase Web App values, then start the local server:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
npm run build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

The build generates `public/firebase-config.js` from `.env.local` or environment variables. Both files containing real values are ignored by Git.

## GitHub Pages deploy

The workflow in `.github/workflows/deploy-pages.yml` deploys pushes to `main`.

Create these GitHub repository secrets under **Settings → Secrets and variables → Actions**:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`

In GitHub **Settings → Pages**, select **GitHub Actions** as the source.

For Google login, add `cristianciulica.github.io` to Firebase Authentication's authorized domains. If the Firebase browser key uses website restrictions, allow the deployed GitHub Pages URL together with `fittrack-angular-7ca07.firebaseapp.com` and `fittrack-angular-7ca07.web.app`, which host the Firebase authentication handler. Firebase Web API keys identify the project and are visible in any browser application; access to Firestore and Storage must be protected with Firebase Security Rules and App Check.

## Install as a phone app

The production build is a Progressive Web App with a FitTrack home-screen icon and offline app-shell caching.

On iPhone:

1. Open the deployed FitTrack URL in Safari.
2. Tap **Share**.
3. Select **Add to Home Screen**.
4. Confirm with **Add**.

On Android:

1. Open the deployed FitTrack URL in Chrome.
2. Open the browser menu.
3. Select **Install app** or **Add to Home screen**.

The PWA service worker is enabled only in production builds. Regenerate the icon set after changing the source logo with:

```bash
npm run icons:pwa
```

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Running tracker

The Running page uses the browser Geolocation API and a Leaflet map to show your current route, distance, pace, steps, and calories. You must allow location access when prompted.

Manual check:
- Open `Running` from the sidebar.
- Click `Start`, walk a short distance, then click `Stop`.
- Verify the blue path renders and stats update.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
