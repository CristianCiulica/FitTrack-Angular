# Personal training planner

The Training Assistant opens from the left floating action on Home. Its native, full-screen dialog uses the same 900 ms circular reveal and 750 ms collapse as Nutrition Assistant. Both support reduced motion, keyboard navigation and restored launcher focus.

## Programming

This is a deterministic planner, not an external AI integration or an injury-assessment tool. It needs no API key and incurs no model-inference fees. Inputs are training goal, experience, exact equipment, selected weekdays, session duration, emphasis and current readiness.

The engine chooses a full-body, upper/lower or push/pull/legs structure. Consecutive days and limited equipment change the layout. It selects from an explicit movement catalogue and uses deliberate A/B variations. Compound movements always precede isolation exercises, including after substitutions and saved-plan reconstruction. Emphasis affects the selected accessories and set allocation. Short sessions can trade a redundant/supporting slot for priority work while retaining the main patterns. New and returning lifters start more conservatively. Strength emphasis uses lower repetition ranges on suitable compound movements for experienced users.

Time estimates include a general warm-up, preparation for compound movements, transitions, working repetitions, between-set rests and both sides of unilateral exercises. Additional sets must fit the chosen time budget and conservative direct-set limits. Estimates are approximate, not promised completion times. Direct and supporting sets are tracked separately for volume checks rather than assuming every indirect set is equivalent to a direct set.

Substitutions require the same movement family and primary muscle, compatible equipment, no duplicate movement in that session and enough session time. Missing alternatives are explained. A row may stand in for unavailable overhead pulling during initial construction; that limitation is disclosed. A bench alone is insufficient pulling equipment. Current pain or medical restrictions stop general-plan generation and direct the user to individual assessment.

Starting loads are references from recent completed sessions with the exact exercise name. Routines, future sessions, logs older than six weeks and external-load guesses for bodyweight movements are excluded. Users calibrate the actual load during warm-up. Progression uses a rep range, controlled technique and repetitions in reserve; it never automatically prescribes a maximal lift.

References informing the starting rules:

- ACSM, 2026: https://doi.org/10.1249/MSS.0000000000003897
- IUSCA, 2021: https://doi.org/10.47206/ijsc.v1i1.81

The exercise catalogue and prescriptions are application logic; neither organisation endorses or validates this product.

## Persistence and sessions

Each day saves through WorkoutService as `kind: routine`, so it does not count as a completed workout or activity. A stable `tp_<uuid>.<day>` client ID makes retries idempotent. Partial saves can resume. Device-only saves are labelled honestly; unavailable durable storage is reported as a failure.

A versioned metadata envelope in the existing notes field stores preferences, program identity and per-exercise prescription. It stays within the API's existing 2,000-character limit and requires no server schema changes. Normal exercise fields remain compatible with existing consumers. Metadata is validated, and renamed exercises lose stale coaching details rather than inheriting unrelated advice.

Unfinished wizard/preview state is cached under `fittrack_training_builder:<uid>`; normal account storage deletion includes that key. Account-synced routine records reconstruct the program on another device. Saved-plan changes use normal routine updates; creating a new program retains previous routines in Workout → My training.

Save & train opens the chosen routine through a client-ID launch parameter. The live workout preserves rep ranges, technique cues, effort targets and exercise-specific rest. Draft recovery retains those fields. An unfinished session takes precedence over a new launch link.

## Verification

Tests cover 1,764 programming combinations, substitutions, load-reference eligibility, persistence round trips, partial-save retries, offline durability, draft ownership, launch integration and session recovery. Browser verification uses the production components with isolated mock account data; it does not create workouts in a real user's account.
