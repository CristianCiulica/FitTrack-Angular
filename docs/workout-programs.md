# Workout library and 30-day blocks

Workout (the centre + action) groups training into Discover plans, My training and Single sessions. History remains a separate destination. Search and six-item pagination keep individual sessions manageable; old PPL/Home launch links and Legends remain available.

Six curated blocks cover hypertrophy, resistance training plus cardio, two-day training, the user's existing Aesthetics PPL, glute priority and home upper/lower. Each repeats a seven-day structure across exactly 30 calendar dates, including dates across month/year boundaries. The Aesthetics block preserves the user's exercises and sets. All new session launches put compound movements before isolation work. Existing in-progress drafts retain their original order so logged arrays remain aligned.

Progression guidance uses controlled reps, reserve, small load changes and optional easier work when fatigue persists. Working loads are chosen during warm-up. These are general training templates, not injury rehabilitation or guaranteed fat-loss outcomes.

## Existing API compatibility

A block enrollment is one `kind: routine` record with an empty exercises array and a validated versioned `FitTrack Program · ` notes envelope. Completed/partial strength sessions retain actual exercises and sets, with a `FitTrack Program Session · ` context linking enrollment, program, day and session. Both fit the existing 2,000-character notes limit. No server migration or model API key is required.

Enrollment retries reuse one `pg_<uuid>` client ID. The underlying service supports authenticated sync, offline durable storage and idempotent retries. Enrollments never count as activity or custom workouts. Starting another block retains the previous enrollment; individual logged sessions remain in History. Future scheduled days can be previewed but not launched.

Completion derives from actual saved records, so deleting a session updates the block. Partial strength sessions remain partial; multiple shorter treadmill records can add toward a cardio day's planned duration. Duplicate client IDs/record IDs do not add duration twice. Rest days require no artificial completion. A plan only links records explicitly launched from that enrollment and day.

## Indoor cardio

The treadmill logger is available from Workout, History and Run. It records an indoor walk/run after the activity using actual duration, distance and finish time. Incline, machine calories and measured steps are optional and remain unknown when blank. Metric/imperial distance input converts once to metres. No GPS route or fabricated readings are created.

Indoor records use `kind: session`, an empty exercises array and the validated `FitTrack Indoor Cardio · ` notes envelope. History maps them into Cardio alongside outdoor sessions, with the correct deletion API and no empty map. Dashboard and Progress include their actual minutes, distance, entered steps and machine calories, while excluding them from strength workout goals. Plan enrollment and saved routines do not contribute activity.

## Verification

Unit coverage includes program calendars, boundaries, compounds-first ordering, preserved Aesthetics sets, linked partial/full sessions, metadata validation, repeat enrollment saves, duration accumulation, pagination/search, treadmill units/readings, Dashboard metrics and History refresh/deletion. Browser checks use production components with isolated mock account data, never a real user's workouts.
