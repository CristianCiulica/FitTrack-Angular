# Onboarding — 4 October 2026

New accounts choose Light, Dark or Auto after entering their name. The real ThemeService previews and persists the device preference immediately; profile completion includes the theme in the existing API update. The final recommendation offers the existing Push Pull Legs gym collection or Later, which saves the same profile and opens Home.

The BMI result uses a neutral surface, compact category label and readable measurements. Step transitions use opacity/transform, respect reduced motion, focus the new heading and reset the content scroll position. Short screens use compact layouts and keep the primary action and Later outside the scrollable content.

Completion explicitly distinguishes a late existing profile from this flow's optimistic save. It waits for save success before routing, prevents duplicate saves and preserves the choices on error. The plan query opens the collection after checking workout recovery, so an interrupted active session stays visible.

## Verification

- 119 frontend tests across 25 files pass, including six onboarding tests and two recommended-plan routing/recovery regressions.
- Production Angular build succeeds; the existing Leaflet CommonJS warning remains.
- Browser walkthroughs used the actual components with isolated profile/API fixtures: Light, Dark, Auto, forward/back navigation, goal controls, neutral BMI, Explore the plan and Later.
- Mobile sizes: 390 × 844 and 320 × 568. No horizontal overflow; goal controls fit at the smaller size and footer actions stay clear of content. The plan uses a shorter presentation on small screens.
- Existing ThemeService tests cover following the system appearance, preference persistence, cross-tab updates and unavailable storage.

Browser fixtures do not replace a live Firebase registration or profile API integration test.
