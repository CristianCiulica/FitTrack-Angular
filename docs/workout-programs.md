# Workout library and 30-day blocks

Workout (the centre + action) groups training into Discover plans, My training and Single sessions. History remains a separate destination. Search and six-item pagination keep individual sessions manageable; old PPL/Home launch links and Legends remain available.

Six curated blocks cover hypertrophy, resistance training plus cardio, two-day training, the user's existing Aesthetics PPL, glute priority and home upper/lower. Each repeats a seven-day structure across exactly 30 calendar dates, including dates across month/year boundaries. The Aesthetics block uses the user's updated seven-exercise Push session alongside Pull and Legs, with recovery days instead of cardio. Strength days keep their original day indices and session IDs so existing lifting progress remains linked. All new session launches put compound movements before isolation work. Existing in-progress drafts retain their original order so logged arrays remain aligned.

Progression guidance uses controlled reps, reserve, small load changes and optional easier work when fatigue persists. Working loads are chosen during warm-up. These are general training templates, not injury rehabilitation or guaranteed fat-loss outcomes.

## Existing API compatibility

A block enrollment is one `kind: routine` record with an empty exercises array and a validated versioned `FitTrack Program · ` notes envelope. Completed/partial strength sessions retain actual exercises and sets, with a `FitTrack Program Session · ` context linking enrollment, program, day and session. Both fit the existing 2,000-character notes limit. No server migration or model API key is required.

Enrollment retries reuse one `pg_<uuid>` client ID. The underlying service supports authenticated sync, offline durable storage and idempotent retries. Enrollments never count as activity or custom workouts. Starting another block retains the previous enrollment; individual logged sessions remain in History. Scheduled dates are advisory: any strength or cardio session in an active block can be launched, including future or previously completed days. Rest days and stopped blocks cannot launch sessions. Saved records use the actual workout date while retaining the selected plan day.

Completion derives from actual saved records, so deleting a session updates the block. Partial strength sessions remain partial; multiple shorter treadmill records can add toward a cardio day's planned duration. Duplicate client IDs/record IDs do not add duration twice. Rest days require no artificial completion. A plan only links records explicitly launched from that enrollment and day.

## Treadmill in the workout player

Cardio days launch the same live workout player as strength sessions. A treadmill exercise asks for a whole-number duration from 1 to 120 minutes and uses the existing countdown control pattern: start, pause/resume, reset and finish early. Treadmill blocks run after strength/isolation work and advance without a strength rest. Pauses do not add timer seconds. Background callbacks use elapsed wall time, clamped to the chosen target. After refresh the timer recovers paused, with its chosen duration and actual elapsed seconds.

A validated `FitTrack Timed Session · ` notes envelope saves actual seconds, chosen targets and body weight captured at save, plus optional program context. Compact tuples stay within the existing API notes limit even for 50 blocks. Treadmill time is not stored as fake repetitions or strength sets. Pure treadmill sessions use actual walking time as duration. Mixed sessions retain normal strength exercises. Both appear in the regular workout history; the separate manual logger and its entry points have been removed. Old manual records remain readable.

Calories are a gross energy estimate using 3.5 MET for level walking at 4.0–4.7 km/h, from the [2024 Adult Compendium, walking code 17352](https://pacompendium.com/walking/). The UI states the assumed pace and weight, with a 75 kg fallback if no profile weight exists. No actual speed, incline, distance, steps or GPS route is invented. Estimates use elapsed walking seconds; Dashboard/Progress exclude pure treadmill sessions from strength goals.

## Stopping a block

Stop plan is available on the active plan card and within plan details. An inline confirmation explains that logged workouts and progress are retained. The enrollment is updated with a validated `stoppedAt` timestamp. A stopped latest block does not reactivate an older one, remains accessible in My training and cannot launch new days. Start a new block creates a fresh enrollment. Failed saves stay retryable.

## Verification

Unit coverage includes program calendars, boundaries, compounds-first ordering, preserved Aesthetics sets, linked partial/full sessions, metadata validation, repeat enrollment saves, duration accumulation, pagination/search, treadmill units/readings, Dashboard metrics and History refresh/deletion. Browser checks use production components with isolated mock account data, never a real user's workouts.

The treadmill preview uses the [Tabler treadmill SVG](https://github.com/tabler/tabler-icons/blob/main/icons/outline/treadmill.svg); its MIT notice is included in `public/third-party/tabler-icons-LICENSE.txt`.
