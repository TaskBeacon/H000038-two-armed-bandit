import {
  StimBank,
  SubInfo,
  TaskSettings,
  TrialBuilder,
  count_down,
  mountTaskApp,
  next_trial_id,
  parsePsyflowConfig,
  reset_trial_counter,
  set_trial_context,
  type CompiledTrial,
  type RuntimeView,
  type TrialSnapshot
} from "psyflow-web";

import { runTrial } from "./src/run_trial";
import {
  generate_bandit_schedule,
  RewardTracker,
  summarize_bandit_trials,
  type BanditProbabilityRow
} from "./src/utils";

const TASK_ID = "H000038-two-armed-bandit";
const TASK_NAME = "Two-Armed Bandit Task";
const TASK_DESCRIPTION = "Browser companion for the canonical T000038 two-armed bandit task.";

type TaskSettingsView = TaskSettings & Record<string, unknown>;

type ConditionGenerationConfig = {
  block_probabilities?: BanditProbabilityRow[];
  no_choice_policy?: string;
  randomize_within_block?: boolean;
};

async function loadConfig() {
  const configUrl = new URL("./config/config.yaml", import.meta.url);
  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
  }
  const yamlText = await response.text();
  return parsePsyflowConfig(yamlText, import.meta.url);
}

function createInstructionTrial(stimBank: StimBank): CompiledTrial {
  const trial = new TrialBuilder({
    trial_id: "instructions",
    block_id: null,
    trial_index: -1,
    condition: "instructions"
  });
  const unit = trial.unit("instruction_text").addStim(stimBank.get("instruction_text"));
  if (stimBank.has("instruction_text_voice")) {
    unit.addStim(stimBank.get("instruction_text_voice"));
  }
  set_trial_context(unit, {
    trial_id: trial.trial_id,
    phase: "instructions",
    deadline_s: null,
    valid_keys: ["space"],
    block_id: null,
    condition_id: "instructions",
    task_factors: {
      stage: "instructions"
    },
    stim_id: "instruction_text"
  });
  unit.waitAndContinue({ keys: ["space"] });
  return trial.build();
}

function createBlockBreakTrial(
  stimBank: StimBank,
  blockId: string,
  blockIdx: number,
  totalBlocks: number,
  initialScore: number
): CompiledTrial {
  const blockNum = blockIdx + 1;
  const trial = new TrialBuilder({
    trial_id: `block_break_${blockNum}`,
    block_id: blockId,
    trial_index: blockIdx,
    condition: "block_break"
  });
  const unit = trial.unit("block_break").addStim((_snapshot: TrialSnapshot, runtime: RuntimeView) => {
    const blockRows = runtime.getReducedRows().filter((row) => String(row.block_id ?? "") === blockId);
    const summary = summarize_bandit_trials(blockRows, {
      initial_score: Number.isFinite(initialScore) ? initialScore : 1000
    });
    return stimBank.get_and_format("block_break", {
      block_num: blockNum,
      total_blocks: totalBlocks,
      accuracy: summary.accuracy,
      total_score: summary.total_score
    });
  });
  set_trial_context(unit, {
    trial_id: trial.trial_id,
    phase: "block_break",
    deadline_s: null,
    valid_keys: ["space"],
    block_id: blockId,
    condition_id: "block_break",
    task_factors: {
      stage: "block_break",
      block_num: blockNum,
      total_blocks: totalBlocks
    },
    stim_id: "block_break"
  });
  unit.waitAndContinue({ keys: ["space"] });
  return trial.build();
}

function createGoodbyeTrial(stimBank: StimBank, totalTrials: number, initialScore: number): CompiledTrial {
  const trial = new TrialBuilder({
    trial_id: "good_bye",
    block_id: null,
    trial_index: totalTrials,
    condition: "good_bye"
  });
  const unit = trial.unit("good_bye").addStim((_snapshot: TrialSnapshot, runtime: RuntimeView) => {
    const reducedRows = runtime.getReducedRows();
    const summary = summarize_bandit_trials(reducedRows, {
      initial_score: Number.isFinite(initialScore) ? initialScore : 1000
    });
    return stimBank.get_and_format("good_bye", {
      total_score: summary.total_score
    });
  });
  set_trial_context(unit, {
    trial_id: trial.trial_id,
    phase: "good_bye",
    deadline_s: null,
    valid_keys: ["space"],
    block_id: null,
    condition_id: "good_bye",
    task_factors: {
      stage: "good_bye",
      total_trials: totalTrials
    },
    stim_id: "good_bye"
  });
  unit.waitAndContinue({ keys: ["space"] });
  return trial.build();
}

function createTrials(
  settings: TaskSettingsView,
  stimBank: StimBank,
  conditionGeneration: ConditionGenerationConfig,
  rewardTracker: RewardTracker
): CompiledTrial[] {
  reset_trial_counter();

  const totalBlocks = Math.max(1, Number(settings.total_blocks ?? 1));
  const trialsPerBlock = Math.max(1, Number(settings.trials_per_block ?? settings.trial_per_block ?? 1));
  const totalTrials = Math.max(1, Number(settings.total_trials ?? totalBlocks * trialsPerBlock));
  const blockProbabilities = Array.isArray(conditionGeneration.block_probabilities)
    ? conditionGeneration.block_probabilities
    : [];
  const trials: CompiledTrial[] = [];
  const initialScore = Number(settings.initial_score ?? 1000);

  trials.push(createInstructionTrial(stimBank));

  for (let blockIdx = 0; blockIdx < totalBlocks; blockIdx += 1) {
    const blockId = `block_${blockIdx}`;
    trials.push(
      ...count_down({
        seconds: 3,
        block_id: blockId,
        condition: "countdown",
        trial_id_prefix: `countdown_${blockId}`,
        unit_label: "countdown",
        duration_s: 1,
        stim: {
          color: "white",
          height: 48,
          alignment: "center"
        }
      })
    );

    const plannedConditions = generate_bandit_schedule({
      block_idx: blockIdx,
      n_trials: trialsPerBlock,
      block_probabilities: blockProbabilities
    });

    for (const [trialIndex, condition] of plannedConditions.entries()) {
      const trial = new TrialBuilder({
        trial_id: next_trial_id(),
        block_id: blockId,
        trial_index: trialIndex,
        condition: condition.condition_id
      });
      runTrial(trial, condition, {
        settings,
        stimBank,
        blockIdx,
        rewardTracker
      });
      trials.push(trial.build());
    }

    trials.push(createBlockBreakTrial(stimBank, blockId, blockIdx, totalBlocks, initialScore));
  }

  trials.push(createGoodbyeTrial(stimBank, totalTrials, initialScore));
  return trials;
}

export async function main(root: HTMLElement): Promise<unknown> {
  const parsed = await loadConfig();
  const settings = TaskSettings.from_dict(parsed.task_config);
  const settingsView = settings as TaskSettingsView;
  const conditionGeneration = (parsed.raw.condition_generation ?? {}) as ConditionGenerationConfig;
  const initialScore = Number(settingsView.initial_score ?? 1000);
  settingsView.triggers = parsed.trigger_config;
  settingsView.no_choice_policy = String(conditionGeneration.no_choice_policy ?? "random");
  settingsView.initial_score = initialScore;

  const subInfo = new SubInfo(parsed.subform_config);
  const stimBank = new StimBank(parsed.stim_config);
  const rewardTracker = new RewardTracker(initialScore);

  if (Boolean(settingsView.voice_enabled)) {
    const voiceName =
      typeof settingsView.voice_name === "string" && settingsView.voice_name.trim().length > 0
        ? settingsView.voice_name
        : "zh-CN-YunyangNeural";
    stimBank.convert_to_voice("instruction_text", {
      voice: voiceName,
      fallbackToSpeech: true
    });
  }

  return mountTaskApp({
    root,
    task_id: TASK_ID,
    task_name: TASK_NAME,
    task_description: TASK_DESCRIPTION,
    settings,
    subInfo,
    stimBank,
    buildTrials: () => createTrials(settingsView, stimBank, conditionGeneration, rewardTracker)
  });
}

export default main;
