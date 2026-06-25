# Assignment Mapping

This page maps the project features to the rubric from `Enunt.txt`.

## 1. Login + Register

Implemented parts:

- Login form with email and password
- Remember me checkbox in the login UI
- Register form with email, password, confirm password, first name, and last name
- Reactive form validation
- Custom password validator
- Auth guards that hide the login page after sign-in

Important caveat:

- Authentication is implemented with Firebase Auth, not a fake local account list.
- The configured Firebase project must contain the user account.

## 2. Fully lazy loaded project

Implemented parts:

- Root routes load feature route files lazily
- Auth, dashboard, workouts, start-workout, BMI, and running pages are all split into feature routes

## 3. input(), output(), and a service

Implemented parts:

- Signal-based state exists in several pages
- The workout modal uses `input()` and `output()` for parent-child communication
- Multiple services exist, including auth, workout, loading, reminder, running-session, and weather services

## 4. Table or list implementation

Implemented parts:

- Workout history uses an NgZorro table
- Running sessions are displayed in a structured list/card layout
- Workout rows can be expanded to reveal details
- Workout entries can be edited or deleted
- Sorting is available on the workout table

Strongest match to the rubric:

- The workout history table is the main list feature.

If you want a more literal rubric match, adding a dedicated search input to the workout history would make the implementation even closer to the assignment wording.

## 5. Signal usage

Implemented parts:

- Dashboard uses signals for workout data and assistant state
- Workouts page uses signals for sorting and modal control
- Auth service exposes current user state through a signal

## 6. NgZorro

Implemented parts:

- The UI uses NgZorro buttons, tables, modals, inputs, icons, tags, menus, and cards

## 7. Clean Angular code

Implemented parts:

- Feature-oriented component structure
- Dedicated services for business logic
- Route guards for access control
- Reusable modal component

## 8. Pleasant UI

Implemented parts:

- Modern card-based dashboard
- Sidebar navigation
- Modal-driven editing
- Distinct mobile and desktop behaviors

## 9. Version note

This app uses Angular 21. The rubric rewards staying on a modern Angular version, so this implementation is already aligned with that expectation.

## Bonus opportunities

Possible bonus-worthy extensions would be:

- Adding a real backend API beyond Firebase
- Adding a dedicated search/filter bar to the workout history
- Adding export or analytics features
- Adding another third-party library for charts, maps, or data presentation