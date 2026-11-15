import {
  CHAPTERS,
  STAGES,
  STAGE_GOLD_FIRST,
  STAGE_GOLD_REPEAT,
  STAR_HP_RATIO,
  chapterOf,
  type ChapterDef,
  type StageDef,
} from '../data/story';
import { Save } from './SaveManager';

export function stageStars(stageId: string): number {
  return Save.get().story.stars[stageId] ?? 0;
}

export function isChapterComplete(ch: ChapterDef): boolean {
  return ch.stages.length > 0 && ch.stages.every((s) => stageStars(s.id) > 0);
}

export function isChapterOpen(ch: ChapterDef): boolean {
  if (ch.comingSoon || ch.stages.length === 0) return false;
  const prev = CHAPTERS.find((c) => c.id === ch.id - 1);
  return !prev || isChapterComplete(prev);
}

export function isStageOpen(stage: StageDef): boolean {
  const ch = chapterOf(stage);
  if (!isChapterOpen(ch)) return false;
  const i = ch.stages.indexOf(stage);
  return i === 0 || stageStars(ch.stages[i - 1].id) > 0;
}

export interface BattleStats {
  moves: number;
  teamHp: number;
  teamMaxHp: number;
}

/** 1 — победа, 2 — HP команды больше половины, 3 — уложились в лимит ходов. Звёзды за условия независимы. */
export function computeStars(stage: StageDef, stats: BattleStats): number {
  let stars = 1;
  if (stats.teamHp > stats.teamMaxHp * STAR_HP_RATIO) stars++;
  if (stats.moves <= stage.parMoves) stars++;
  return stars;
}

export function starRules(stage: StageDef): string[] {
  return ['Победа', `HP команды > ${Math.round(STAR_HP_RATIO * 100)}%`, `Не больше ${stage.parMoves} ходов`];
}

export interface StageResult {
  stars: number;
  gold: number;
  firstClear: boolean;
  /** Награда за главу, если она выдана этой победой. */
  chapterReward?: ChapterDef['reward'];
}

export function applyStageWin(stageId: string, stats: BattleStats): StageResult {
  const stage = STAGES[stageId];
  const save = Save.get();
  const prev = stageStars(stageId);
  const stars = computeStars(stage, stats);
  const firstClear = prev === 0;
  save.story.stars[stageId] = Math.max(prev, stars);

  let gold = firstClear ? STAGE_GOLD_FIRST : STAGE_GOLD_REPEAT;
  const ch = chapterOf(stage);
  let chapterReward: StageResult['chapterReward'];
  if (isChapterComplete(ch) && !save.story.chaptersClaimed.includes(ch.id)) {
    save.story.chaptersClaimed.push(ch.id);
    if (!save.story.spiritStones.includes(ch.reward.spiritStone)) save.story.spiritStones.push(ch.reward.spiritStone);
    gold += ch.reward.gold;
    chapterReward = ch.reward;
  }
  save.gold += gold;
  Save.write();
  return { stars, gold, firstClear, chapterReward };
}
