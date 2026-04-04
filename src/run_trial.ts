import { TrialBuilder, set_trial_context, type StimBank, type TaskSettings } from "psyflow-web";

import {
  choice_label_for_side,
  choice_probability_for_side,
  choice_side_from_key,
  createTrialRandom,
  draw_bandit_reward,
  get_fallback_choice,
  type BanditCondition,
  RewardTracker
} from "./utils";

type BanditTaskSettings = TaskSettings &
  Record<string, unknown> & {
    initial_score?: number;
    pre_choice_fixation_duration?: number;
    bandit_choice_duration?: number;
    choice_confirmation_duration?: number;
    outcome_feedback_duration?: number;
    iti_duration?: number;
    left_key?: string;
    right_key?: string;
    reward_win?: number;
    reward_loss?: number;
    no_choice_policy?: string;
    triggers?: Record<string, unknown>;
  };

type RunTrialOptions = {
  settings: BanditTaskSettings;
  stimBank: StimBank;
  blockIdx: number;
  rewardTracker: RewardTracker;
};

type BanditDecision = {
  score_before: number;
  score_after: number;
  response_key: string;
  response_rt: number | null;
  choice_key: string;
  choice_side: "left" | "right";
  choice_label: string;
  choice_made: boolean;
  choice_forced: boolean;
  choice_prob: number;
  reward_win: boolean;
  reward_delta: number;
};

function getTriggerMap(settings: BanditTaskSettings): Record<string, unknown> {
  const raw = settings.triggers;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw;
}

function getNumberTrigger(settings: BanditTaskSettings, key: string): number | null {
  const value = Number(getTriggerMap(settings)[key]);
  return Number.isFinite(value) ? value : null;
}

function getTextStimText(stimBank: StimBank, key: string, fallback: string): string {
  try {
    const stim = stimBank.resolve(key);
    if (stim && typeof stim === "object" && "text" in stim && typeof stim.text === "string") {
      return stim.text;
    }
  } catch {
    // Use the fallback label below.
  }
  return fallback;
}

function getInitialScore(settings: BanditTaskSettings): number {
  const initialScore = Number(settings.initial_score ?? 1000);
  return Number.isFinite(initialScore) ? initialScore : 1000;
}

function getCurrentScore(
  runtime: { getReducedRows(): Array<Record<string, unknown>> },
  initialScore: number
): number {
  const rows = runtime.getReducedRows();
  if (rows.length === 0) {
    return initialScore;
  }

  const lastRow = rows[rows.length - 1];
  const candidate = Number(lastRow.total_score);
  if (Number.isFinite(candidate)) {
    return candidate;
  }

  const summedDelta = rows.reduce((sum, row) => sum + Number(row.reward_delta ?? 0), 0);
  if (Number.isFinite(summedDelta)) {
    return initialScore + summedDelta;
  }

  return initialScore;
}

function readChoiceResponse(snapshot: Record<string, any>): string {
  const choiceState = snapshot.units?.bandit_choice ?? {};
  return String(choiceState.response ?? "").trim();
}

function readChoiceRt(snapshot: Record<string, any>): number | null {
  const choiceState = snapshot.units?.bandit_choice ?? {};
  const rt = choiceState.rt;
  return typeof rt === "number" && Number.isFinite(rt) ? rt : null;
}

function resolveDecision(
  snapshot: Record<string, any>,
  runtime: { getReducedRows(): Array<Record<string, unknown>> },
  trial: TrialBuilder,
  condition: BanditCondition,
  options: RunTrialOptions,
  leftKey: string,
  rightKey: string,
  leftLabel: string,
  rightLabel: string,
  initialScore: number
): BanditDecision {
  const responseKey = readChoiceResponse(snapshot);
  const responseRt = readChoiceRt(snapshot);
  const choiceMade = responseKey === leftKey || responseKey === rightKey;
  const trialRandom = createTrialRandom(options.settings, {
    trial_id: trial.trial_id,
    block_idx: options.blockIdx,
    suffix: "bandit"
  });

  const choiceKey = choiceMade
    ? responseKey
    : get_fallback_choice(options.settings.no_choice_policy ?? "random", leftKey, rightKey, trialRandom);
  const choiceSide = choice_side_from_key(choiceKey, leftKey);
  const choiceLabel = choice_label_for_side(choiceSide, leftLabel, rightLabel);
  const choiceProb = choice_probability_for_side(choiceSide, condition.p_left, condition.p_right);
  const rewardWin = draw_bandit_reward(condition.p_left, condition.p_right, choiceSide, trialRandom);
  const rewardDelta = rewardWin
    ? Number(options.settings.reward_win ?? 10)
    : Number(options.settings.reward_loss ?? 0);
  const scoreBefore = getCurrentScore(runtime, initialScore);
  const scoreAfter = scoreBefore + rewardDelta;

  return {
    score_before: scoreBefore,
    score_after: scoreAfter,
    response_key: responseKey,
    response_rt: responseRt,
    choice_key: choiceKey,
    choice_side: choiceSide,
    choice_label: choiceLabel,
    choice_made: choiceMade,
    choice_forced: !choiceMade,
    choice_prob: choiceProb,
    reward_win: rewardWin,
    reward_delta: rewardDelta
  };
}

function getResponseTriggerMap(settings: BanditTaskSettings, leftKey: string, rightKey: string): Record<string, number> | null {
  const leftTrigger = getNumberTrigger(settings, "bandit_choice_left_press");
  const rightTrigger = getNumberTrigger(settings, "bandit_choice_right_press");
  if (leftTrigger == null && rightTrigger == null) {
    return null;
  }

  const map: Record<string, number> = {};
  if (leftTrigger != null) {
    map[leftKey] = leftTrigger;
  }
  if (rightTrigger != null) {
    map[rightKey] = rightTrigger;
  }
  return map;
}

export function runTrial(
  trial: TrialBuilder,
  condition: BanditCondition,
  options: RunTrialOptions
): TrialBuilder {
  const blockId = trial.block_id ?? `block_${options.blockIdx}`;
  const blockIndex = Number.isFinite(options.blockIdx) ? options.blockIdx : 0;
  const initialScore = getInitialScore(options.settings);
  const fixationDuration = Number(options.settings.pre_choice_fixation_duration ?? 0.5);
  const choiceDuration = Number(options.settings.bandit_choice_duration ?? 2.5);
  const confirmationDuration = Number(options.settings.choice_confirmation_duration ?? 0.4);
  const feedbackDuration = Number(options.settings.outcome_feedback_duration ?? 0.8);
  const itiDuration = Number(options.settings.iti_duration ?? 0.6);
  const leftKey = String(options.settings.left_key ?? "f").trim() || "f";
  const rightKey = String(options.settings.right_key ?? "j").trim() || "j";
  const leftLabel = getTextStimText(options.stimBank, "machine_left_label", "左侧机器");
  const rightLabel = getTextStimText(options.stimBank, "machine_right_label", "右侧机器");
  const responseTriggerMap = getResponseTriggerMap(options.settings, leftKey, rightKey);
  const choiceTimeoutTrigger = getNumberTrigger(options.settings, "bandit_choice_no_response");
  const decisionResolver = (
    snapshot: Record<string, any>,
    runtime: { getReducedRows(): Array<Record<string, unknown>> }
  ) =>
    resolveDecision(
      snapshot,
      runtime,
      trial,
      condition,
      options,
      leftKey,
      rightKey,
      leftLabel,
      rightLabel,
      initialScore
    );

  trial.setTrialState("block_idx", blockIndex);
  trial.setTrialState("p_left", condition.p_left);
  trial.setTrialState("p_right", condition.p_right);

  const fixation = trial.unit("pre_choice_fixation").addStim(options.stimBank.get("fixation"));
  set_trial_context(fixation, {
    trial_id: trial.trial_id,
    phase: "pre_choice_fixation",
    deadline_s: fixationDuration,
    valid_keys: [],
    block_id: blockId,
    condition_id: condition.condition_id,
    task_factors: {
      stage: "pre_choice_fixation",
      block_idx: blockIndex
    },
    stim_id: "fixation"
  });
  fixation.show({
    duration: fixationDuration
  });

  const choiceScreen = trial
    .unit("bandit_choice")
    .addStim(options.stimBank.get("machine_left"))
    .addStim(options.stimBank.get("machine_right"))
    .addStim(options.stimBank.get("machine_left_label"))
    .addStim(options.stimBank.get("machine_right_label"))
    .addStim(options.stimBank.get_and_format("choice_prompt", { deadline_s: choiceDuration }));
  set_trial_context(choiceScreen, {
    trial_id: trial.trial_id,
    phase: "bandit_choice",
    deadline_s: choiceDuration,
    valid_keys: [leftKey, rightKey],
    block_id: blockId,
    condition_id: condition.condition_id,
    task_factors: {
      stage: "bandit_choice",
      p_left: condition.p_left,
      p_right: condition.p_right,
      block_idx: blockIndex
    },
    stim_id: "bandit_choice",
    stim_features: {
      choice_keys: [leftKey, rightKey],
      choice_labels: {
        left: leftLabel,
        right: rightLabel
      },
      choice_timeout_s: choiceDuration,
      p_left: condition.p_left,
      p_right: condition.p_right
    }
  });
  choiceScreen.set_state({
    choice_made: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_made,
    choice_forced: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_forced,
    choice_key: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_key,
    choice_side: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_side,
    choice_label: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_label,
    choice_rt: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).response_rt,
    choice_prob: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_prob
  });
  choiceScreen.captureResponse({
    keys: [leftKey, rightKey],
    duration: choiceDuration,
    correct_keys: [leftKey, rightKey],
    response_trigger: responseTriggerMap,
    timeout_trigger: choiceTimeoutTrigger
  });

  const confirmation = trial
    .unit("choice_confirmation")
    .addStim(options.stimBank.get("machine_left"))
    .addStim(options.stimBank.get("machine_right"))
    .addStim(options.stimBank.get("machine_left_label"))
    .addStim(options.stimBank.get("machine_right_label"))
    .addStim((snapshot, runtime) => {
      const decision = decisionResolver(snapshot as Record<string, any>, runtime);
      return options.stimBank.get(decision.choice_side === "left" ? "highlight_left" : "highlight_right");
    })
    .addStim((snapshot, runtime) => {
      const decision = decisionResolver(snapshot as Record<string, any>, runtime);
      return options.stimBank.get_and_format("target_prompt", {
        choice_label: decision.choice_label
      });
    });
  set_trial_context(confirmation, {
    trial_id: trial.trial_id,
    phase: "choice_confirmation",
    deadline_s: confirmationDuration,
    valid_keys: [],
    block_id: blockId,
    condition_id: condition.condition_id,
    task_factors: {
      stage: "choice_confirmation",
      block_idx: blockIndex
    },
    stim_id: "selection_confirmation"
  });
  confirmation.set_state({
    choice_side: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_side,
    choice_label: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).choice_label
  });
  confirmation.show({
    duration: confirmationDuration
  });

  const feedback = trial
    .unit("outcome_feedback")
    .addStim((snapshot, runtime) => {
      const decision = decisionResolver(snapshot as Record<string, any>, runtime);
      const stimId = decision.reward_win ? "feedback_win" : "feedback_loss";
      return options.stimBank.get_and_format(stimId, {
        reward_delta: decision.reward_delta,
        total_score: decision.score_after
      });
    });
  set_trial_context(feedback, {
    trial_id: trial.trial_id,
    phase: "outcome_feedback",
    deadline_s: feedbackDuration,
    valid_keys: [],
    block_id: blockId,
    condition_id: condition.condition_id,
    task_factors: {
      stage: "outcome_feedback",
      block_idx: blockIndex
    },
    stim_id: "feedback"
  });
  feedback.set_state({
    reward_win: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).reward_win,
    reward_delta: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).reward_delta,
    total_score: (snapshot, runtime) => decisionResolver(snapshot as Record<string, any>, runtime).score_after
  });
  feedback.show({
    duration: feedbackDuration
  });

  const iti = trial.unit("iti").addStim(options.stimBank.get("fixation"));
  set_trial_context(iti, {
    trial_id: trial.trial_id,
    phase: "iti",
    deadline_s: itiDuration,
    valid_keys: [],
    block_id: blockId,
    condition_id: condition.condition_id,
    task_factors: {
      stage: "iti",
      block_idx: blockIndex
    },
    stim_id: "fixation"
  });
  iti.show({
    duration: itiDuration
  });

  trial.finalize((snapshot, runtime, helpers) => {
    const decision = decisionResolver(snapshot as Record<string, any>, runtime);
    const totalScore = options.rewardTracker.update(decision.reward_delta);
    helpers.setTrialState("choice_key", decision.choice_key);
    helpers.setTrialState("choice_side", decision.choice_side);
    helpers.setTrialState("choice_label", decision.choice_label);
    helpers.setTrialState("choice_made", decision.choice_made);
    helpers.setTrialState("choice_forced", decision.choice_forced);
    helpers.setTrialState("choice_rt", decision.response_rt);
    helpers.setTrialState("choice_prob", decision.choice_prob);
    helpers.setTrialState("p_left", condition.p_left);
    helpers.setTrialState("p_right", condition.p_right);
    helpers.setTrialState("block_idx", blockIndex);
    helpers.setTrialState("reward_win", decision.reward_win);
    helpers.setTrialState("reward_delta", decision.reward_delta);
    helpers.setTrialState("total_score", totalScore);
  });

  return trial;
}

export { runTrial as run_trial };

export default runTrial;
