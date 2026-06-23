# FitTrack Documentation

This folder contains the project documentation for FitTrack. The goal is to make the application easy to understand, easy to set up, and easy to extend.

If you are new to the project, read the pages in this order:

1. [Project Overview](project-overview.md)
2. [Setup Guide](setup-guide.md)
3. [Architecture Guide](architecture-guide.md)
4. [Feature Guide](feature-guide.md)

## What this app is

FitTrack is an Angular fitness tracking application built with Angular 21, NgZorro, and Firebase. It includes authentication, workout management, running tracking, a BMI or nutrition page, and a dashboard with summary cards and a nutrition assistant.

The app is designed around a routed, lazy-loaded structure so each feature can be loaded independently. Authenticated users see the protected pages, while unauthenticated users are redirected to the login page.

## Documentation style

The docs are intentionally practical:

- They explain what the code actually does.
- They show how the app is wired together.
- They call out setup requirements that are easy to miss.
- They map the implementation back to the project rubric in `Enunt.txt`.

If you only need one page to start, open [Project Overview](project-overview.md).