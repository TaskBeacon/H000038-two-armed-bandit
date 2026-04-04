# Validation Checklist

Use this checklist after the web port is created.

## Structural Checks

- [ ] `taskbeacon.yaml` uses `id: H000038` and `variant: html`
- [ ] `slug` matches the local canonical task
- [ ] `main.ts` exports a `main(root)` entry point
- [ ] `src/run_trial.ts` exists and builds the logical trial stages
- [ ] `src/utils.ts` exists and contains the schedule, outcome, and summary helpers
- [ ] `notify-psyflow-web.yml` exists under `.github/workflows`

## Semantic Checks

- [ ] The trial order is fixation -> bandit choice -> choice confirmation -> outcome feedback -> ITI
- [ ] The valid response keys are `f` and `j`
- [ ] `bandit` is the only configured condition label
- [ ] Deterministic schedule generation uses the configured block probability rows
- [ ] Missing responses are imputed by `no_choice_policy` and still scored
- [ ] The block break text uses the current block summary only
- [ ] The goodbye screen uses the full-task summary only
- [ ] The instruction voice remains disabled when `voice_enabled: false`

## Data Checks

- [ ] Reduced rows are one row per logical bandit trial
- [ ] Reduced rows include the local top-level fields: `choice_key`, `choice_side`, `choice_rt`, `choice_made`, `choice_forced`, `choice_prob`, `p_left`, `p_right`, `reward_win`, `reward_delta`, `total_score`
- [ ] `trial_id` stays monotonic for the scored trials
- [ ] `block_id`, `trial_index`, and `condition` match the local trial metadata
- [ ] `reward_win` and `reward_delta` match the selected-side reward logic

## Browser Checks

- [ ] The task loads through the shared `psyflow-web` runner
- [ ] `H000038-two-armed-bandit` appears in the generated task manifest
- [ ] The choice cards render with readable wrapping on the 1280x720 preview shell
- [ ] The countdown screen is visible before each block begins
- [ ] The instruction text, feedback text, block break text, and final summary remain readable in the browser

## Notes

- Do not shorten block or trial counts for this task unless you are intentionally creating a separate preview variant.
- Hardware trigger codes are retained in config for provenance, but the browser runtime does not emit serial triggers.
