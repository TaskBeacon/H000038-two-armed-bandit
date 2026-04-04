import type { TaskSettings } from "psyflow-web";

export type BanditProbabilityRow = {
  left: number;
  right: number;
};

export type BanditCondition = {
  p_left: number;
  p_right: number;
  condition_id: string;
};

export type BanditTrialSummary = {
  n_trials: number;
  n_responded: number;
  n_forced: number;
  left_count: number;
  left_rate: number;
  win_count: number;
  win_rate: number;
  accuracy: number;
  mean_choice_rt: number;
  score_start: number;
  score_end: number;
  score_change: number;
  total_reward_delta: number;
  total_score: number;
};

type SettingsLike = TaskSettings & Record<string, unknown>;

function normalizeChoiceKey(choiceKey: unknown): string {
  return String(choiceKey ?? "").trim();
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeScore(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSeedBase(settings: SettingsLike, blockIdx: number): number {
  const overallSeed = normalizeScore(settings.overall_seed, 2025);
  const blockSeed = Array.isArray(settings.block_seed) ? settings.block_seed : [];
  const candidate = normalizeScore(blockSeed[blockIdx], NaN);
  return Number.isFinite(candidate) ? candidate : overallSeed;
}

function trialSeed(settings: SettingsLike, trialId: number | string, blockIdx: number, suffix: string): number {
  const seedBase = getSeedBase(settings, blockIdx);
  return hashString(`${seedBase}|${blockIdx}|${String(trialId)}|${suffix}`);
}

function formatConditionId(pLeft: number, pRight: number): string {
  const left = String(Math.round(pLeft * 100)).padStart(2, "0");
  const right = String(Math.round(pRight * 100)).padStart(2, "0");
  return `L${left}_R${right}`;
}

export class RewardTracker {
  private score: number;

  constructor(initialScore = 0) {
    this.score = Number.isFinite(initialScore) ? initialScore : 0;
  }

  peek(): number {
    return this.score;
  }

  update(delta: number): number {
    this.score += Number(delta) || 0;
    return this.score;
  }
}

export function createTrialRandom(
  settings: SettingsLike,
  options: {
    trial_id: number | string;
    block_idx: number;
    suffix?: string;
  }
): () => number {
  return makeSeededRandom(trialSeed(settings, options.trial_id, options.block_idx, options.suffix ?? "bandit"));
}

export function generate_bandit_schedule(options: {
  block_idx: number;
  n_trials: number;
  block_probabilities: BanditProbabilityRow[];
}): BanditCondition[] {
  const trialCount = Math.max(0, Math.floor(Number(options.n_trials ?? 0)));
  if (trialCount === 0) {
    return [];
  }

  const rows = Array.isArray(options.block_probabilities) ? options.block_probabilities : [];
  const fallback = { left: 0.5, right: 0.5 };
  const row = rows.length > 0 ? rows[options.block_idx % rows.length] ?? fallback : fallback;
  const pLeft = clampProbability(normalizeScore(row.left, fallback.left));
  const pRight = clampProbability(normalizeScore(row.right, fallback.right));
  const conditionId = formatConditionId(pLeft, pRight);

  return new Array(trialCount).fill(null).map(() => ({
    p_left: pLeft,
    p_right: pRight,
    condition_id: conditionId
  }));
}

export function draw_bandit_reward(
  pLeft: number,
  pRight: number,
  choiceSide: string,
  rng?: () => number
): boolean {
  const probability =
    String(choiceSide).toLowerCase().trim() === "left" ? clampProbability(pLeft) : clampProbability(pRight);
  const draw = rng ? rng() : Math.random();
  return draw < probability;
}

export function get_fallback_choice(
  policy: string,
  leftKey: string,
  rightKey: string,
  rng?: () => number
): string {
  const normalized = String(policy ?? "").toLowerCase().trim();
  if (normalized === "left") {
    return leftKey;
  }
  if (normalized === "right") {
    return rightKey;
  }
  const draw = rng ? rng() : Math.random();
  return draw < 0.5 ? leftKey : rightKey;
}

export function summarize_bandit_trials(
  trials: Array<Record<string, unknown>>,
  options: {
    initial_score: number;
  }
): BanditTrialSummary {
  const trialList = [...trials];
  const scoreStart = Math.round(Number(options.initial_score ?? 0));
  const forcedTrials = trialList.filter((row) => Boolean(row.choice_forced ?? row.timeout));
  const respondedTrials = trialList.filter((row) => !Boolean(row.choice_forced ?? row.timeout));
  const leftCount = trialList.filter((row) => String(row.choice_side ?? "").toLowerCase() === "left").length;
  const winCount = trialList.filter((row) => Boolean(row.reward_win)).length;
  const choiceRts = trialList
    .map((row) => Number(row.choice_rt))
    .filter((value) => Number.isFinite(value));

  let totalRewardDelta = 0;
  let scoreEnd = scoreStart;

  for (const row of trialList) {
    const delta = Number(row.reward_delta);
    if (Number.isFinite(delta)) {
      totalRewardDelta += Math.round(delta);
    }

    const totalScore = Number(row.total_score);
    if (Number.isFinite(totalScore)) {
      scoreEnd = Math.round(totalScore);
    }
  }

  const nTrials = trialList.length;
  const nForced = forcedTrials.length;
  const nResponded = respondedTrials.length;
  const leftRate = nTrials > 0 ? leftCount / nTrials : 0;
  const winRate = nTrials > 0 ? winCount / nTrials : 0;
  const accuracy = nTrials > 0 ? nResponded / nTrials : 0;
  const meanChoiceRt =
    choiceRts.length > 0 ? choiceRts.reduce((sum, value) => sum + value, 0) / choiceRts.length : 0;

  return {
    n_trials: nTrials,
    n_responded: nResponded,
    n_forced: nForced,
    left_count: leftCount,
    left_rate: leftRate,
    win_count: winCount,
    win_rate: winRate,
    accuracy,
    mean_choice_rt: meanChoiceRt,
    score_start: scoreStart,
    score_end: scoreEnd,
    score_change: scoreEnd - scoreStart,
    total_reward_delta: totalRewardDelta,
    total_score: scoreEnd
  };
}

export function choice_side_from_key(choiceKey: unknown, leftKey: string): "left" | "right" {
  return normalizeChoiceKey(choiceKey) === normalizeChoiceKey(leftKey) ? "left" : "right";
}

export function choice_label_for_side(
  side: "left" | "right",
  leftLabel: string,
  rightLabel: string
): string {
  return side === "left" ? leftLabel : rightLabel;
}

export function choice_probability_for_side(side: "left" | "right", pLeft: number, pRight: number): number {
  return side === "left" ? clampProbability(pLeft) : clampProbability(pRight);
}

export default {
  RewardTracker,
  choice_label_for_side,
  choice_probability_for_side,
  choice_side_from_key,
  createTrialRandom,
  draw_bandit_reward,
  generate_bandit_schedule,
  get_fallback_choice,
  summarize_bandit_trials
};
