# Alignment Matrix

Canonical local task: `T000038-two-armed-bandit`
Web companion task: `H000038-two-armed-bandit`

## Must Align

| Area | Canonical Python task | Web companion | Notes |
|---|---|---|---|
| Task meaning | Chinese two-armed bandit learning task with block-wise reward contingencies | same | Preserve the choice, outcome, and score-accumulation logic. |
| Task identity | `slug: two-armed-bandit` | same | Keep the same conceptual task name and paired numeric id. |
| Block structure | 4 blocks x 40 trials | same | No preview shortening is needed for the main web companion. |
| Condition set | `bandit` | same | Single condition label, with block-wise probability schedules. |
| Trial order | fixation -> bandit choice -> choice confirmation -> outcome feedback -> ITI | same | The implemented stage order must not drift. |
| Response mapping | keys `f` and `j` | same | The browser runtime must treat the same keys as valid choice keys. |
| Outcome rule | Selected-side Bernoulli reward, with timeout fallback choice via `no_choice_policy` | same | Timeout behavior still produces a scored trial. |
| Score semantics | Cumulative score with a 1000-point starting baseline in the browser companion | same | Keep the feedback text and the running total aligned. |
| Instruction meaning | Chinese instruction text and start prompt | same | Text lives in `config/config.yaml`. |
| Reduced data meaning | One logical trial per reduced row | same | Keep the top-level fields aligned with the local analysis contract. |

## May Differ

| Area | Local task | Browser companion | Why it is allowed |
|---|---|---|---|
| Shell | PsychoPy desktop window | psyflow-web browser runtime | Platform-specific shell behavior is expected. |
| Fullscreen | Desktop window control | Shared web runner / preview shell | The browser companion can remain windowed for review. |
| Cursor | PsychoPy cursor behavior | Browser cursor policy | The shared runner owns cursor handling. |
| Hardware triggers | Serial trigger driver | Trigger map kept as config metadata | The browser runtime currently does not emit serial triggers. |
| Random backend | Python `random` seeded by the local runtime | Browser-native seeded RNG using the same seed inputs | Determinism is preserved, but the implementation lives in TS. |
| Save path | `./outputs/human` | `./outputs/html` | Browser output is downloaded or previewed, not written like the desktop task. |
| Voice playback | Local MP3 asset exists but voice is disabled in config | Browser speech synthesis stays disabled by config | Keeps the browser companion text-only unless the task is explicitly reconfigured. |

## Keep In Task Repo

- `taskbeacon.yaml`
- `README.md`
- `config/config.yaml`
- `main.ts`
- `src/run_trial.ts`
- `src/utils.ts`
- `assets/README.md`
- `references/alignment-matrix.md`
- `references/validation-checklist.md`

## Move To `psyflow-web`

- fullscreen and shell presentation
- preflight form and participant collection
- shared jsPsych runtime
- keyboard handling
- countdown helper
- generic browser result export UI

## Review Questions

- If the web companion produces a different choice/reward sequence for the same block, is the difference caused by the seed backend or a data-contract bug?
- If a summary screen disagrees with the local task, are timeout choices being counted the same way?
- If a helper appears reusable across multiple `H` tasks, should it move into `psyflow-web` instead of staying in the task repo?
