# Feature Guide

This guide walks through the main pages of the app and what each one does.

## Authentication

The auth area contains login and register pages.

### Login page

The login form includes:

- Email
- Password
- Remember me

Validation is handled with Angular reactive forms, including a custom password validator that requires:

- At least 6 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

The page is protected by the guest guard, so authenticated users are redirected away from it.

### Register page

The register form includes:

- First name
- Last name
- Email
- Password
- Confirm password

The form validates required fields, email format, password strength, and password matching.

## Dashboard

The dashboard is the main landing page after login.

It shows:

- A welcome hero
- Workout summary cards
- Recent workouts
- A nutrition assistant modal

The nutrition assistant is a guided, step-based UI that builds a meal recommendation from the user’s answers.

## Workouts page

The workouts page is the history and management screen for saved workouts and cardio sessions.

It includes:

- A running and walking history section
- A workout history table
- Sorting by workout name
- Expandable workout details
- Edit and delete actions
- A modal for editing workout data

The modal itself uses a reactive form and supports adding and removing exercises inside a single workout.

## Start workout page

The start-workout page is the interactive workout builder.

It supports:

- Creating workout sessions
- Managing exercises inside a workout
- Guarding against accidental navigation away while a workout is in progress

This is where the app behaves more like an input-heavy working tool than a static list.

## Running page

The running page uses browser geolocation and Leaflet to support route tracking.

It is designed for cardio tracking and outdoor movement, so it depends on the browser granting location access.

The page also blocks accidental navigation away while the workout is active.

## BMI or nutrition page

The BMI page is currently presented as a nutrition-oriented page in the navigation. It sits inside the authenticated section and follows the same app shell layout.

## Shared modal component

The workout modal is a reusable editing surface used by the workout history page.

It demonstrates a good separation of concerns:

- The page decides when to open it
- The modal owns the form layout and validation
- The parent page handles save and cancel events

## Search and sort note

The current workout history view includes sorting and expandable rows. If you want to align the implementation even more closely with the assignment rubric, the most natural next enhancement would be to add explicit search input state to the workout history page.