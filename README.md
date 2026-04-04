# Two-Armed Bandit Task (HTML Companion)

![Maturity: prototype](https://img.shields.io/badge/Maturity-prototype-64748b?style=flat-square&labelColor=111827)

| Field | Value |
|---|---|
| Name | Two-Armed Bandit Task |
| Version | html (v0.1.0-dev) |
| URL / Repository | https://github.com/TaskBeacon/H000038-two-armed-bandit |
| Short Description | Browser companion for the Chinese two-armed bandit learning task with block-wise reward contingencies and cumulative score feedback |
| Created By | TaskBeacon psyflow-web py2js port |
| Modality | Behavior |
| Language | Chinese |

## 1. Task Overview

This HTML companion mirrors the canonical local `T000038-two-armed-bandit` task. On each trial, participants choose between two machines, receive a stochastic reward outcome, and accumulate score across repeated trials. The browser port keeps the same stage order, response mapping, block-wise probability schedule, and reduced-data semantics while using the shared `psyflow-web` runner.

The participant-facing copy follows the 1000-point starting score described in the local instructions.

## 2. Task Flow

### Block-Level Flow

| Step | Description |
|---|---|
| Load Config | Load the browser preview config and stimulus bank. |
| Collect Subject Info | The shared runner collects `subject_id` before the task starts. |
| Show Instructions | Present the Chinese instruction text. |
| Countdown | Show a three-second countdown before each block begins. |
| Run Trials | Present fixation, bandit choice, choice confirmation, feedback, and ITI for each scheduled condition. |
| Show Block Break | Display the current block summary after each block. |
| Finalize | Display the final score and export data through the shared runner. |

### Trial-Level Flow

| Step | Description |
|---|---|
| Fixation | Show a central fixation cross. |
| Bandit Choice | Show two machines and capture keys `F` and `J`. |
| Timeout Fallback | If no response is made, the task imputes a choice using `no_choice_policy` and still scores the trial. |
| Choice Confirmation | Highlight the selected machine and show the confirmation text. |
| Outcome Feedback | Show win/loss feedback and the updated total score. |
| ITI | Show the fixation cross again before the next trial. |

### Controller Logic

| Feature | Description |
|---|---|
| Condition scheduling | Uses block-wise left/right probability rows from `condition_generation.block_probabilities`. |
| Score tracking | A `RewardTracker` keeps the cumulative score across the session. |
| Response contract | Keys `f` and `j` select the left and right machines. |
| Adaptive control | None. This is a static probabilistic choice task, not a staircase or adaptive controller. |

## 3. Configuration Summary

Settings are defined in `config/config.yaml`.

### a. Subject Info

| Field | Meaning |
|---|---|
| `subject_id` | Numeric participant identifier supplied by the shared runner. |

### b. Stimuli

| Stimulus ID | Purpose |
|---|---|
| `instruction_text` | Chinese task instructions. |
| `fixation` | Central fixation cross. |
| `machine_left/right` | Left/right machine panels. |
| `machine_left_label/right_label` | Machine labels. |
| `highlight_left/right` | Selected machine highlight frame. |
| `choice_prompt` | Choice prompt with response deadline. |
| `target_prompt` | Choice confirmation text. |
| `feedback_win` / `feedback_loss` | Reward outcome feedback with updated score. |
| `block_break` | Block summary screen. |
| `good_bye` | Final total score screen. |
| `outcome_text` | Reserved outcome text stimulus kept for parity with the canonical repo. |

### c. Timing

| Parameter | Meaning |
|---|---|
| `timing.pre_choice_fixation_duration` | Duration of the fixation screen. |
| `timing.bandit_choice_duration` | Duration of the choice window. |
| `timing.choice_confirmation_duration` | Duration of the selection confirmation screen. |
| `timing.outcome_feedback_duration` | Duration of the feedback screen. |
| `timing.iti_duration` | Inter-trial interval duration. |

### d. Triggers

| Parameter | Meaning |
|---|---|
| `exp_onset` / `exp_end` | Experiment start/end metadata. |
| `block_onset` / `block_end` | Block start/end metadata. |
| `pre_choice_fixation_onset` | Fixation onset metadata. |
| `bandit_choice_onset` | Choice onset metadata. |
| `bandit_choice_left_press` / `bandit_choice_right_press` | Left/right choice key metadata. |
| `bandit_choice_no_response` | Choice-window timeout metadata. |
| `bandit_choice_forced` | Forced-choice marker metadata. |
| `choice_confirmation_onset` | Confirmation onset metadata. |
| `outcome_feedback_win_onset` / `outcome_feedback_loss_onset` | Feedback onset metadata. |
| `iti_onset` | ITI onset metadata. |

### e. Browser Notes

| Parameter | Meaning |
|---|---|
| `task.save_path` | Browser output target; the shared runner downloads results instead of writing to a desktop output directory. |
| `task.voice_enabled` | Keeps the browser companion text-only by default. |
| `task.initial_score` | Starting score used by the browser task. |

## 4. Methods

Participants completed a browser-based two-armed bandit task implemented with the shared `psyflow-web` runtime. On each trial, they chose one of two machines with block-wise reward contingencies. The choice screen displayed the two machines and a deadline prompt, followed by a brief confirmation screen and a reward/no-reward feedback screen.

The task operationalizes learning from probabilistic feedback and score accumulation. If the participant does not respond within the choice window, the browser companion applies the configured no-choice fallback policy and still scores the trial, preserving the one-trial-one-row analysis contract.

All participant-facing wording is defined in YAML stimulus templates so the same trial logic can be reused across browser preview and future variants without code edits.

## Run

1. Open `psyflow-web` in the shared workspace.
2. Run `npm install` if dependencies are not installed yet.
3. Start the runner with `npm run dev`.
4. Open `http://127.0.0.1:4173/?task=H000038-two-armed-bandit`.

## Notes

- The browser companion keeps the canonical 4-block, 160-trial structure intact.
- The local trigger codes are preserved in config for traceability, but the browser runtime does not emit serial triggers.
- Pushes to `main` can refresh the shared runner through `.github/workflows/notify-psyflow-web.yml` when `TASKBEACON_ORG_DISPATCH_TOKEN` is configured.
