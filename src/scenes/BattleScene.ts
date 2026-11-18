import Phaser from 'phaser';
import { chainTier, nextCharge, SHIELD_CAP_RATIO, SKILL_CHARGE_MAX, techniqueDelay, techniqueHealRatio, techniqueShieldRatio, techniqueSplashRatio } from '../battle/chainTiers';
import { BoardModel, type Pos } from '../battle/BoardModel';
import { BOARD_COLS, BOARD_ROWS, BOARD_X, BOARD_Y, CELL, FONT, GAME_H, GAME_W } from '../config';
import { REWARD_LOSS, REWARD_WIN, cardStats } from '../core/progression';
import { Save } from '../core/SaveManager';
import { applyStageWin, starRules, type JoinedHero, type StageResult } from '../core/story';
import { CARDS, type CardDef } from '../data/cards';
import { SKILLS, type GuardMode, type SkillEffect } from '../data/skills';
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_NAME, elementMultiplier, type Element } from '../data/elements';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { STAGES, STAR_HP_RATIO, type StageDef } from '../data/story';
import { iconText } from '../ui/icons';
import { coverImage } from '../ui/images';
import { offerReason, teamOffer } from '../ui/teamOffer';
import { button, cardView, hex } from '../ui/widgets';
import { STONE_SIZE } from './BootScene';

type Stone = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface Unit {
  def: CardDef;
  atk: number;
  hp: number;
  /** Высота спрайта — для зоны тапа. */
  h: number;
  sprite: Sprite;
  x: number;
  y: number;
  /** Центр спрайта по вертикали — сюда летят камни. */
  cy: number;
  /** Заряд навыка в текущем бою, 0–SKILL_CHARGE_MAX. */
  charge: number;
  maxHp: number;
  /** Верх шкалы — зона тапа захватывает полоску и заряд. */
  top: number;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBack: Phaser.GameObjects.Rectangle;
  pips: Phaser.GameObjects.Arc[];
  glow: Phaser.GameObjects.Ellipse;
  elementIcon: Phaser.GameObjects.Image;
}

/** Враг на поле. Слот — индекс в раскладке волны, по нему же призыв ищет свободное место. */
interface Foe {
  def: EnemyDef;
  hp: number;
  cd: number;
  /** Сколько ходов игрока прожил — для призыва раз в N ходов. */
  turns: number;
  slot: number;
  x: number;
  y: number;
  h: number;
  w: number;
  /** Тень и спрайт; глубина по y, как у героев. */
  root: Phaser.GameObjects.Container;
  /** Полоска HP, ходы до атаки, щит — поверх всех спрайтов. */
  ui: Phaser.GameObjects.Container;
  sprite: Sprite;
  hpBar: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
  guardText: Phaser.GameObjects.Text | null;
}

const MIN_CHAIN = 3;
const CHAIN_LENGTH_BONUS = 0.1;
/** Насколько близко к центру камня должен пройти палец, чтобы камень добавился в цепь (доля клетки). */
const PICK_RADIUS = 0.42;

const FIELD_H = 636;
const HORIZON_Y = 330;
const TEAM_HP_Y = 648;
const HERO_BAR_W = 56;
const HERO_BAR_H = 12;
const UNIT_H = 170;
/** Позиции ступней героев: задний ряд выше, передний ниже. */
const TEAM_SLOTS = [
  { x: 78, y: 460 },
  { x: 200, y: 440 },
  { x: 318, y: 460 },
  { x: 140, y: 600 },
  { x: 268, y: 600 },
];
const ENEMY_H = 200;
/** Раскладки слотов врагов (ступни) по числу врагов в волне; первый слот — главный (для босса). */
const ENEMY_SLOTS: { x: number; y: number }[][] = [
  [{ x: 580, y: 590 }],
  [
    { x: 600, y: 600 },
    { x: 430, y: 470 },
  ],
  [
    { x: 590, y: 580 },
    { x: 445, y: 450 },
    { x: 500, y: 630 },
  ],
];
const FOE_BAR_W = 120;
const FOE_UI_DEPTH = 12;
/** Полоска врага с кружком ходов занимает ±FOE_UI_RIGHT по x от центра; соседние — не ближе FOE_UI_GAP по y. */
const FOE_UI_RIGHT = FOE_BAR_W / 2 + 42;
const FOE_UI_GAP = 40;
const QUICK_WAVES = [['sukuna']];
/** Значки стихий — полоса под полем боя, каждый под своим героем: так они не закрывают лица соседей. */
const BADGE_DEPTH = 10;

export class BattleScene extends Phaser.Scene {
  private model!: BoardModel;
  private stones: (Stone | null)[][] = [];
  private stoneLayer!: Phaser.GameObjects.Container;
  private busy = false;

  private chain: Pos[] = [];
  private chainElement: Element | null = null;
  private chainGfx!: Phaser.GameObjects.Graphics;
  private chainBadge!: Phaser.GameObjects.Text;

  private team: Unit[] = [];
  private teamMaxHp = 0;
  private teamHp = 0;
  private teamShield = 0;
  /** Сколько следующих атак врагов полностью поглощает «Бесконечность». */
  private attackBlocks = 0;
  private shieldText!: Phaser.GameObjects.Text;

  /** Этап сюжета; null — быстрый бой против Сукуны. */
  private stage: StageDef | null = null;
  private waves: string[][] = QUICK_WAVES;
  private waveIndex = 0;
  private slots: { x: number; y: number }[] = [];
  private foes: Foe[] = [];
  private target: Foe | null = null;
  private targetMarker: Phaser.GameObjects.GameObject[] = [];
  private moves = 0;
  /** Итог боя для оверлея и автотестов (scripts/playtest.mjs). */
  outcome: 'win' | 'lose' | null = null;
  private paused = false;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  /** Растёт при перезапуске и закрытии сцены — оборванные анимации хода на этом останавливаются. */
  private epoch = 0;
  /** Эпоха, в которой начат текущий ход. Не совпала с epoch — ход брошен. */
  private flow = 0;
  /** Палец, который ведёт цепочку. Остальные касания его не перебивают. */
  private dragId: number | null = null;

  private headerName!: Phaser.GameObjects.Text;
  private headerSkull!: Phaser.GameObjects.Image;
  private headerElement!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  init(data: { stageId?: string }): void {
    this.stage = (data.stageId && STAGES[data.stageId]) || null;
    this.waves = this.stage ? this.stage.waves : QUICK_WAVES;
  }

  create(): void {
    // Сцена переиспользуется при restart(), поэтому всё состояние сбрасываем здесь.
    const epoch = ++this.epoch;
    this.events.once('shutdown', () => {
      if (this.epoch === epoch) this.epoch++;
    });
    this.busy = false;
    this.paused = false;
    this.dragId = null;
    this.time.paused = false;
    this.pauseLayer = [];
    this.chain = [];
    this.chainElement = null;
    this.stones = [];
    this.team = [];
    this.foes = [];
    this.target = null;
    this.targetMarker = [];
    this.waveIndex = 0;
    this.moves = 0;
    this.outcome = null;
    this.attackBlocks = 0;

    this.drawBackground();
    this.createHeader();
    this.spawnWave(false);
    this.createTeam();
    this.createBoard();
    this.setupInput();
  }

  // ---------- построение сцены ----------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1b1036, 0x1b1036, 0x5a2350, 0x5a2350, 1);
    g.fillRect(0, 0, GAME_W, HORIZON_Y);
    g.fillStyle(0xffe9c4, 0.9).fillCircle(130, 110, 46);
    g.fillStyle(0xffe9c4, 0.15).fillCircle(130, 110, 70);
    g.fillStyle(0x2a1530, 1);
    g.fillTriangle(0, HORIZON_Y, 160, 220, 330, HORIZON_Y);
    g.fillTriangle(260, HORIZON_Y, 470, 190, 720, HORIZON_Y);
    g.fillGradientStyle(0x3b2440, 0x3b2440, 0x1a1024, 0x1a1024, 1);
    g.fillRect(0, HORIZON_Y, GAME_W, FIELD_H - HORIZON_Y);

    g.fillStyle(0x161229, 1).fillRect(0, FIELD_H, GAME_W, GAME_H - FIELD_H);
    g.fillStyle(0x0b0918, 1).fillRoundedRect(BOARD_X - 8, BOARD_Y - 8, BOARD_COLS * CELL + 16, BOARD_ROWS * CELL + 16, 14);
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        g.fillStyle((r + c) % 2 ? 0x221c3d : 0x2a2349, 1);
        g.fillRect(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, CELL);
      }
    }

    const bgKey = this.stage ? `bg_${this.stage.background}` : '';
    if (this.textures.exists(bgKey)) {
      coverImage(this, bgKey, GAME_W / 2, FIELD_H / 2, GAME_W, FIELD_H, 0.6);
      // Затемнение сверху, чтобы читались имя врага и полоска HP.
      const shade = this.add.graphics();
      shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.65, 0.65, 0, 0);
      shade.fillRect(0, 0, GAME_W, 170);
    }
  }

  private createHeader(): void {
    const style = { fontFamily: FONT, fontSize: '28px', color: '#ffffff' };
    this.headerName = this.add.text(24, 16, '', style).setStroke('#000000', 6);
    this.headerSkull = this.add.image(42, 34, 'icon_skull').setDisplaySize(40, 40).setVisible(false);
    this.headerElement = this.add
      .text(GAME_W - 24, 18, '', { ...style, fontSize: '22px' })
      .setOrigin(1, 0)
      .setStroke('#000000', 6);
    const { bar, text } = this.hpBar(24, 56, GAME_W - 48, 22, 0xd8323c);
    this.enemyHpBar = bar;
    this.enemyHpText = text;

    this.waveText = this.add
      .text(GAME_W / 2, 92, '', { ...style, fontSize: '24px', color: '#ffe066' })
      .setOrigin(0.5, 0)
      .setStroke('#000000', 6);
    this.movesText = this.add
      .text(GAME_W - 24, 94, '', { ...style, fontSize: '20px' })
      .setOrigin(1, 0)
      .setStroke('#000000', 5);
    this.createPauseButton();
    this.createElementHelpButton();
  }

  private createPauseButton(): void {
    const btn = this.add.container(52, 130).setDepth(FOE_UI_DEPTH);
    btn.add([
      this.add.circle(0, 0, 28, 0x000000, 0.6).setStrokeStyle(3, 0xffffff, 0.9),
      this.add.rectangle(-8, 0, 8, 26, 0xffffff),
      this.add.rectangle(8, 0, 8, 26, 0xffffff),
    ]);
    btn.setSize(64, 64).setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => this.openPause());
  }

  private openPause(): void {
    if (this.paused || this.pauseLayer.length || this.outcome) return;
    this.paused = true;
    // Замораживаем анимации хода и таймеры, чтобы враги не били за оверлеем паузы.
    this.tweens.pauseAll();
    this.time.paused = true;
    this.cancelChain();
    const close = () => {
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = [];
      this.paused = false;
      this.tweens.resumeAll();
      this.time.paused = false;
    };
    const leave = () => (this.stage ? this.scene.start('StoryMap', { chapterId: this.stage.chapter }) : this.scene.start('MainMenu'));
    this.pauseLayer = [
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.75).setDepth(200).setInteractive(),
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 160, 'Пауза', { fontFamily: FONT, fontSize: '72px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#000000', 10)
        .setDepth(201),
      button(this, GAME_W / 2, GAME_H / 2, 340, 96, 'Продолжить', close).setDepth(201),
      button(this, GAME_W / 2, GAME_H / 2 + 120, 340, 96, 'Сдаться', leave, 0xd8323c).setDepth(201),
    ];
  }

  private createElementHelpButton(): void {
    const btn = this.add.container(26, 520).setDepth(FOE_UI_DEPTH);
    btn.add([this.add.circle(0, 0, 26, 0x000000, 0.6).setStrokeStyle(3, 0xffffff, 0.9)]);
    btn.add(this.add.text(0, 0, '?', { fontFamily: FONT, fontSize: '34px', color: '#ffe066' }).setOrigin(0.5).setStroke('#000000', 5));
    btn.setSize(60, 60).setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => this.openElementHelp());
  }

  private openElementHelp(): void {
    if (this.paused || this.pauseLayer.length || this.outcome) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.cancelChain();

    const close = () => {
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = [];
      this.paused = false;
      this.tweens.resumeAll();
      this.time.paused = false;
    };

    const cx = GAME_W / 2;
    const panelW = 620;
    const rowH = 120;
    const panelH = 90 + ELEMENTS.length * rowH + 70;

    const effectText: Record<Element, string> = {
      fire: 'чистый урон',
      dark: 'чистый урон',
      water: 'лечит команду',
      light: 'лечит команду',
      earth: 'создаёт щит команде',
    };

    const layer: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.75).setDepth(200).setInteractive(),
      this.add
        .rectangle(cx, GAME_H / 2, panelW, panelH, 0x1a1530, 0.96)
        .setStrokeStyle(3, 0xffe066, 0.9)
        .setDepth(201),
      this.add
        .text(cx, GAME_H / 2 - panelH / 2 + 42, 'Стихии и их эффекты', { fontFamily: FONT, fontSize: '34px', color: '#ffe066' })
        .setOrigin(0.5, 0.5)
        .setStroke('#000000', 7)
        .setDepth(202),
    ];

    let rowY = GAME_H / 2 - panelH / 2 + 90;
    for (const e of ELEMENTS) {
      const strong = (Object.keys(ELEMENT_NAME) as Element[]).filter((f) => elementMultiplier(e, f) > 1);
      const weakTo = (Object.keys(ELEMENT_NAME) as Element[]).filter((f) => elementMultiplier(f, e) > 1);
      const color = hex(ELEMENT_COLOR[e]);
      const matchup = [
        strong.length ? `Сильный против: ${strong.map((f) => ELEMENT_NAME[f]).join(', ')}` : '',
        weakTo.length ? `Уязвим к: ${weakTo.map((f) => ELEMENT_NAME[f]).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('   ·   ');

      const top = rowY - rowH / 2 + 26;
      layer.push(
        this.add.rectangle(cx, rowY, panelW - 40, rowH - 16, 0x241a3a, 0.8).setStrokeStyle(2, ELEMENT_COLOR[e], 0.8).setDepth(202),
        this.add.image(cx - panelW / 2 + 46, rowY, `stone_${e}`).setScale(0.55).setDepth(203),
        this.add
          .text(cx - panelW / 2 + 120, top, ELEMENT_NAME[e], { fontFamily: FONT, fontSize: '30px', color })
          .setOrigin(0, 0.5)
          .setStroke('#000000', 6)
          .setDepth(203),
        this.add
          .text(cx - panelW / 2 + 120, rowY - rowH / 2 + 62, matchup, {
            fontFamily: FONT,
            fontSize: '22px',
            color: '#b9aedd',
            align: 'left',
            wordWrap: { width: panelW - 300, useAdvancedWrap: true },
          })
          .setOrigin(0, 0.5)
          .setStroke('#000000', 4)
          .setDepth(203),
        this.add
          .text(cx - panelW / 2 + 120, rowY - rowH / 2 + 92, `Эффект (5+ камней): ${effectText[e]}`, {
            fontFamily: FONT,
            fontSize: '24px',
            color: '#ffe066',
          })
          .setOrigin(0, 0.5)
          .setStroke('#000000', 4)
          .setDepth(203),
      );
      rowY += rowH;
    }

    layer.push(button(this, cx, rowY + 30, 260, 70, 'Закрыть', close).setDepth(202));
    this.pauseLayer = layer;
  }

  // ---------- враги и волны ----------

  private spawnWave(animate: boolean): void {
    const defs = this.waves[this.waveIndex].map((id) => ENEMIES[id]).filter(Boolean);
    // Призывателю нужны свободные слоты под свиту.
    const maxSummon = Math.max(0, ...defs.flatMap((d) => d.traits ?? []).map((t) => (t.kind === 'summon' ? t.max : 0)));
    const n = Phaser.Math.Clamp(Math.max(defs.length, maxSummon), 1, ENEMY_SLOTS.length);
    this.slots = ENEMY_SLOTS[n - 1];
    // Босс и элита занимают главный слот, остальные — по порядку волны.
    const order = [...defs].sort((a, b) => rankWeight(b) - rankWeight(a));
    order.slice(0, this.slots.length).forEach((def, i) => this.addFoe(def, i, animate));
    this.target = null;
    this.selectTarget(this.foes[0] ?? null);
    this.updateGuards();
    this.updateInfo();
  }

  private addFoe(def: EnemyDef, slot: number, animate: boolean): Foe {
    const h = def.height ?? ENEMY_H;
    const sprite = this.unitSprite(`unit_${def.id}`, 0, 0, h, def.element, def.name, !!def.spriteFacesRight);
    const w = sprite instanceof Phaser.GameObjects.Image ? sprite.displayWidth : h * 0.55;
    // Правый край спрайта остаётся на экране.
    const x = Math.min(this.slots[slot].x, GAME_W - 8 - w / 2);
    const y = this.slots[slot].y;
    const root = this.add.container(x, y).setDepth(y / 100);
    root.add([this.add.ellipse(0, 0, Math.max(90, w * 0.8), Math.max(18, h * 0.09), 0x000000, 0.4), sprite]);
    this.breathe(sprite);

    // Полоска над головой: значок стихии слева, затем HP и ходы до атаки.
    const barY = -h - 36;
    const ui = this.add.container(Math.min(x, GAME_W - FOE_UI_RIGHT), y).setDepth(FOE_UI_DEPTH);
    const iconX = -FOE_BAR_W / 2 - 20;
    const hpBar = this.add.rectangle(-FOE_BAR_W / 2 + 2, barY, FOE_BAR_W - 4, 10, 0xd8323c).setOrigin(0, 0.5);
    const cdText = this.add
      .text(FOE_BAR_W / 2 + 22, barY, String(def.cooldown), { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 4);
    const elementIcon = this.add.image(iconX, barY, `stone_${def.element}`).setDisplaySize(32, 32);
    ui.add([
      this.add.rectangle(0, barY, FOE_BAR_W, 14, 0x000000, 0.75).setStrokeStyle(2, 0xffffff, 0.7),
      hpBar,
      this.add.circle(iconX, barY, 18, 0x140e22, 0.85),
      elementIcon,
      this.add.circle(FOE_BAR_W / 2 + 22, barY, 17, 0x000000, 0.75).setStrokeStyle(3, 0xff5a5a),
      cdText,
    ]);
    let guardText: Phaser.GameObjects.Text | null = null;
    if (def.traits?.some((t) => t.kind === 'guarded')) {
      guardText = this.add
        .text(0, barY - 24, 'ЩИТ свиты', { fontFamily: FONT, fontSize: '18px', color: '#8fd3ff' })
        .setOrigin(0.5)
        .setStroke('#000000', 5);
      ui.add(guardText);
    }

    const foe: Foe = { def, hp: def.hp, cd: def.cooldown, turns: 0, slot, x, y, h, w, root, ui, sprite, hpBar, cdText, guardText };
    this.foes.push(foe);
    this.updateFoeCd(foe);
    this.layoutFoeUi();

    if (animate) {
      for (const c of [root, ui]) {
        const to = c.x;
        c.x = to + 320;
        c.setAlpha(0);
        this.tweens.add({ targets: c, x: to, alpha: 1, duration: 450, ease: 'Back.easeOut' });
      }
    }
    return foe;
  }

  /**
   * Раздвигает полоски HP: сначала от чужих полосок, затем выше чужих спрайтов,
   * чтобы бар жабы не ложился на слизня, а бар гоблина — на туловище хобгоблина.
   */
  private layoutFoeUi(): void {
    const natural = (f: Foe) => f.y - f.h - 36;
    const placed: { l: number; r: number; y: number; top: number }[] = [];
    const bodies = this.foes.map((f) => ({ f, l: f.x - f.w / 2, r: f.x + f.w / 2, t: f.y - f.h, b: f.y }));
    for (const f of [...this.foes].sort((a, b) => natural(b) - natural(a))) {
      f.ui.x = Math.min(f.x, GAME_W - FOE_UI_RIGHT);
      const l = f.ui.x - FOE_UI_RIGHT;
      const r = f.ui.x + FOE_UI_RIGHT;
      const pad = f.guardText ? 46 : 24;
      let bar = natural(f);
      for (let n = 0; n < 8; n++) {
        let next = bar;
        for (const p of placed) {
          // top учитывает подпись «ЩИТ свиты», иначе чужая полоска садится на неё.
          if (r > p.l && l < p.r && bar > p.top - 10 && bar < p.y + 18) next = Math.min(next, p.top - 22);
        }
        for (const o of bodies) {
          if (o.f === f) continue;
          if (r > o.l + 6 && l < o.r - 6 && bar > o.t - 6 && bar < o.b - 6) next = Math.min(next, o.t - pad);
        }
        if (next === bar) break;
        bar = next;
      }
      // Не заезжать под шапку с именем и кнопкой паузы.
      bar = Math.max(bar, 168);
      placed.push({ l, r, y: bar, top: bar - (f.guardText ? 44 : 16) });
      f.ui.y = f.y + (bar - natural(f));
    }
  }

  private async killFoe(foe: Foe): Promise<void> {
    this.foes = this.foes.filter((f) => f !== foe);
    if (this.target === foe) this.selectTarget(this.foes[0] ?? null);
    this.updateGuards();
    this.layoutFoeUi();
    const { root, ui } = foe;
    ui.destroy();
    this.burst(foe.x, foe.y - foe.h / 2, ELEMENT_COLOR[foe.def.element]);
    await this.tween({ targets: root, alpha: 0, y: foe.y + 30, duration: 380 });
    this.guard();
    root.destroy();
  }

  private selectTarget(foe: Foe | null): void {
    this.targetMarker.forEach((o) => o.destroy());
    this.targetMarker = [];
    this.target = foe;
    if (foe) {
      const { root, ui } = foe;
      const ring = this.add.ellipse(0, 0, Math.max(110, foe.w * 0.95), Math.max(26, foe.h * 0.13)).setStrokeStyle(4, 0xffe066);
      root.addAt(ring, 0);
      const arrow = this.add.triangle(0, -foe.h - 52 - (foe.guardText ? 22 : 0), 0, 0, 24, 0, 12, 16, 0xffe066).setStrokeStyle(2, 0x000000);
      ui.add(arrow);
      this.tweens.add({ targets: arrow, y: arrow.y - 8, duration: 400, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: ring, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
      this.targetMarker = [ring, arrow];
    }
    this.updateHeader(false);
  }

  /** Текущая цель; если выбранная погибла — первая живая. */
  private currentTarget(): Foe | null {
    if (!this.target || !this.foes.includes(this.target)) this.selectTarget(this.foes[0] ?? null);
    return this.target;
  }

  /** Враг под пальцем: его полоска HP, затем непрозрачный пиксель спрайта (спереди назад), затем ближайший центр. */
  private foeAt(px: number, py: number): Foe | null {
    for (const f of this.foes) {
      if (Math.abs(px - f.ui.x) <= FOE_BAR_W / 2 + 30 && Math.abs(py - (f.ui.y - f.h - 18)) <= 24) return f;
    }
    const front = [...this.foes].sort((a, b) => b.root.depth - a.root.depth);
    const hit = front.find((f) => this.opaqueAt(f, px, py));
    if (hit) return hit;
    let best: Foe | null = null;
    let bestD = Infinity;
    for (const f of this.foes) {
      const inside = Math.abs(px - f.x) <= Math.max(f.w, 100) / 2 + 10 && py <= f.y + 30 && py >= f.y - f.h - 40;
      const d = Math.hypot(px - f.x, py - (f.y - f.h / 2));
      if (inside && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  private opaqueAt(f: Foe, px: number, py: number): boolean {
    const s = f.sprite;
    if (!(s instanceof Phaser.GameObjects.Image)) return false;
    const lx = (px - f.root.x) / s.scaleX + s.width / 2;
    const ly = (py - f.root.y) / s.scaleY + s.height;
    if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) return false;
    const tx = Math.floor(s.flipX ? s.width - 1 - lx : lx);
    return (this.textures.getPixelAlpha(tx, Math.floor(ly), s.texture.key) ?? 0) > 40;
  }

  private guardMult(foe: Foe): number {
    const guard = foe.def.traits?.find((t) => t.kind === 'guarded');
    return guard && this.foes.some((f) => f !== foe) ? guard.mult : 1;
  }

  private updateGuards(): void {
    for (const f of this.foes) f.guardText?.setVisible(this.guardMult(f) < 1);
  }

  private updateHeader(animate: boolean): void {
    const t = this.target;
    if (!t) return;
    const boss = t.def.rank === 'boss';
    this.headerSkull.setVisible(boss);
    this.headerName.setText(t.def.name).setX(boss ? 64 : 24);
    this.headerElement.setText(ELEMENT_NAME[t.def.element]).setColor(hex(ELEMENT_COLOR[t.def.element]));
    this.setBar(this.enemyHpBar, t.hp / t.def.hp, animate);
    this.enemyHpText.setText(`${t.hp} / ${t.def.hp}`);
  }

  private updateFoeHp(foe: Foe): void {
    this.setBar(foe.hpBar, foe.hp / foe.def.hp, true);
    if (foe === this.target) this.updateHeader(true);
  }

  private updateFoeCd(foe: Foe): void {
    foe.cdText.setText(String(foe.cd)).setColor(foe.cd === 1 ? '#ff5a5a' : '#ffffff');
  }

  private updateInfo(): void {
    this.waveText.setText(this.waves.length > 1 ? `Волна ${this.waveIndex + 1}/${this.waves.length}` : '');
    this.movesText.setText(this.stage ? `Ходы: ${this.moves}/${this.stage.parMoves}` : `Ходы: ${this.moves}`);
    if (this.stage) this.movesText.setColor(this.moves > this.stage.parMoves ? '#ff8a8a' : '#ffffff');
  }

  private async nextWave(): Promise<void> {
    this.waveIndex++;
    const banner = this.add
      .text(GAME_W / 2, FIELD_H / 2 - 40, `Волна ${this.waveIndex + 1}/${this.waves.length}`, {
        fontFamily: FONT,
        fontSize: '72px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setStroke('#000000', 10)
      .setDepth(60)
      .setScale(0.4)
      .setAlpha(0);
    await this.tween({ targets: banner, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.guard();
    this.spawnWave(true);
    await this.wait(500);
    this.guard();
    await this.tween({ targets: banner, alpha: 0, y: banner.y - 40, duration: 250 });
    this.guard();
    banner.destroy();
  }

  private createTeam(): void {
    const save = Save.get();
    let maxHp = 0;
    save.team.forEach((id, i) => {
      const def = CARDS[id];
      const stats = cardStats(def, save.cards[id].level, save.cards[id].awakening);
      maxHp += stats.hp;
      const { x, y } = TEAM_SLOTS[i];
      const h = UNIT_H * (def.battleScale ?? 1);
      const hover = def.hover ?? 0;
      this.add.ellipse(x, y, hover ? 80 : 110, hover ? 16 : 22, 0x000000, hover ? 0.3 : 0.4).setDepth(y / 100 - 0.01);
      const sprite = this.unitSprite(`unit_${def.id}`, x, y - hover, h, def.element, def.name, !!def.spriteFacesLeft);
      sprite.setDepth(y / 100);
      const glow = this.add
        .ellipse(x, y - hover - h * 0.45, 120, h * 0.95, ELEMENT_COLOR[def.element], 0.45)
        .setDepth(y / 100 - 0.02)
        .setVisible(false);
      this.tweens.add({ targets: glow, alpha: 0.18, duration: 520, yoyo: true, repeat: -1 });
      const head = y - hover - h;
      const barY = head - 34;
      const barX = x + 12;
      const elementIcon = this.add
        .image(barX - HERO_BAR_W / 2 - 16, barY, `stone_${def.element}`)
        .setDisplaySize(24, 24)
        .setDepth(BADGE_DEPTH);
      const hpBack = this.add
        .rectangle(barX, barY, HERO_BAR_W, HERO_BAR_H, 0x000000, 0.75)
        .setStrokeStyle(2, 0xffffff, 0.8)
        .setDepth(BADGE_DEPTH);
      const hpBar = this.add
        .rectangle(barX - (HERO_BAR_W - 4) / 2, barY, HERO_BAR_W - 4, HERO_BAR_H - 4, 0x3fcf5a)
        .setOrigin(0, 0.5)
        .setDepth(BADGE_DEPTH + 0.1);
      const pips = Array.from({ length: SKILL_CHARGE_MAX }, (_, pip) =>
        this.add
          .circle(x + (pip - 1) * 18, barY + 18, 8, 0x1a1428)
          .setStrokeStyle(3, 0xffffff, 0.9)
          .setDepth(BADGE_DEPTH),
      );
      if (hover) this.tweens.add({ targets: sprite, y: sprite.y - 8, duration: 1100 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      else this.breathe(sprite);
      const unit: Unit = {
        def,
        atk: stats.atk,
        hp: stats.hp,
        maxHp: stats.hp,
        h,
        sprite,
        x,
        y,
        cy: y - hover - h / 2,
        top: barY - 16,
        charge: 0,
        hpBar,
        hpBack,
        pips,
        glow,
        elementIcon,
      };
      this.team.push(unit);
      this.refreshCharge(unit);
    });

    this.teamMaxHp = maxHp;
    this.teamHp = this.teamMaxHp;
    this.teamShield = 0;
    this.shieldText = this.add
      .text(GAME_W / 2, TEAM_HP_Y, '', { fontFamily: FONT, fontSize: '22px', color: '#9ecbff' })
      .setOrigin(0.5)
      .setStroke('#000000', 5)
      .setDepth(BADGE_DEPTH)
      .setVisible(false);
    this.updateTeamHp(false);
  }

  private createBoard(): void {
    this.model = new BoardModel(BOARD_COLS, BOARD_ROWS, MIN_CHAIN);
    this.stoneLayer = this.add.container(0, 0);
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(BOARD_X, BOARD_Y, BOARD_COLS * CELL, BOARD_ROWS * CELL);
    this.stoneLayer.setMask(maskShape.createGeometryMask());

    this.chainGfx = this.add.graphics().setDepth(20);
    this.chainBadge = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 7)
      .setDepth(21)
      .setVisible(false);

    this.buildStones();
  }

  private buildStones(): void {
    this.stones = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      this.stones.push([]);
      for (let c = 0; c < BOARD_COLS; c++) {
        this.stones[r].push(this.createStone(c, this.model.grid[r][c]!, cellY(r)));
      }
    }
  }

  private createStone(c: number, e: Element, y: number): Stone {
    const s = this.add.image(cellX(c), y, `stone_${e}`).setDisplaySize(STONE_SIZE, STONE_SIZE);
    this.stoneLayer.add(s);
    return s;
  }

  // ---------- ввод: цепочка ----------

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.outcome) return;
      // Второй палец не начинает новую цепочку и не сбрасывает уже ведущуюся.
      if (this.dragId !== null && p.id !== this.dragId) return;
      if (p.y < FIELD_H) {
        const hero = this.heroAt(p.x, p.y);
        if (hero) {
          if (!this.busy && hero.charge >= SKILL_CHARGE_MAX) void this.castSkill(hero);
          return;
        }
        const foe = this.foeAt(p.x, p.y);
        if (foe && foe !== this.target) this.selectTarget(foe);
        return;
      }
      if (this.busy) return;
      const pos = cellAt(p.x, p.y, 0.75);
      if (!pos) return;
      this.dragId = p.id;
      this.chain = [pos];
      this.chainElement = this.model.get(pos);
      this.refreshChain();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.dragId || this.busy || this.paused || !this.chainElement || !p.isDown) return;
      const pos = cellAt(p.x, p.y, PICK_RADIUS);
      if (!pos) return;
      const last = this.chain[this.chain.length - 1];
      if (samePos(pos, last)) return;

      const prev = this.chain[this.chain.length - 2];
      if (prev && samePos(pos, prev)) {
        this.chain.pop();
      } else if (
        BoardModel.adjacent(last, pos) &&
        this.model.get(pos) === this.chainElement &&
        !this.chain.some((q) => samePos(q, pos))
      ) {
        this.chain.push(pos);
      } else {
        return;
      }
      this.refreshChain();
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.release(p));
    this.input.on('gameout', () => this.release(null));
  }

  /** Завершает цепочку. Чужой палец и повторный pointerup ход не удваивают. */
  private release(p: Phaser.Input.Pointer | null): void {
    if (this.dragId === null) return;
    if (p && p.id !== this.dragId) return;
    this.dragId = null;
    if (!this.chainElement || this.paused || this.busy) {
      this.cancelChain();
      return;
    }
    const chain = this.chain;
    const element = this.chainElement;
    this.chain = [];
    this.chainElement = null;
    this.refreshChain();
    if (chain.length >= MIN_CHAIN) void this.resolveChain(chain, element);
  }

  private cancelChain(): void {
    this.dragId = null;
    this.chain = [];
    this.chainElement = null;
    this.refreshChain();
  }

  private refreshChain(): void {
    for (const row of this.stones) for (const s of row) s?.setScale(1).clearTint();

    this.chainGfx.clear();
    if (!this.chainElement || this.chain.length === 0) {
      this.chainBadge.setVisible(false);
      return;
    }

    const color = ELEMENT_COLOR[this.chainElement];
    const ready = this.chain.length >= MIN_CHAIN;
    for (const p of this.chain) this.stones[p.r][p.c]?.setScale(1.12);

    if (this.chain.length > 1) {
      this.chainGfx.lineStyle(18, 0xffffff, ready ? 0.9 : 0.5);
      this.strokeChain();
      this.chainGfx.lineStyle(10, color, 1);
      this.strokeChain();
    }
    for (const p of this.chain) {
      this.chainGfx.fillStyle(0xffffff, 1).fillCircle(cellX(p.c), cellY(p.r), 9);
    }

    const last = this.chain[this.chain.length - 1];
    const tier = chainTier(this.chain.length);
    this.chainBadge
      .setText(ready ? `${this.chain.length} ${tier.name}` : String(this.chain.length))
      .setColor(ready ? '#ffe066' : '#ffffff')
      .setPosition(cellX(last.c) + 30, cellY(last.r) - 34)
      .setVisible(true);
  }

  private strokeChain(): void {
    this.chainGfx.beginPath();
    this.chain.forEach((p, i) => {
      if (i === 0) this.chainGfx.moveTo(cellX(p.c), cellY(p.r));
      else this.chainGfx.lineTo(cellX(p.c), cellY(p.r));
    });
    this.chainGfx.strokePath();
  }

  // ---------- ход ----------

  private async resolveChain(chain: Pos[], element: Element): Promise<void> {
    const epoch = this.epoch;
    try {
      await this.playChain(chain, element);
    } catch (e) {
      if (e instanceof BattleGone || epoch !== this.epoch) return;
      console.error(e);
      this.busy = false;
    }
  }

  private guard(): void {
    // flow === 0 — ход игрока не идёт (отладка, смена волны снаружи). Иначе эпоха сцены уже другая.
    if (this.flow !== 0 && this.flow !== this.epoch) throw new BattleGone();
  }

  private async playChain(chain: Pos[], element: Element): Promise<void> {
    this.flow = this.epoch;
    this.busy = true;
    this.moves++;
    this.updateInfo();
    const allies = this.team.filter((u) => u.def.element === element);
    const attackers = allies.filter((u) => u.hp > 0);
    const target = attackers[0];
    if (!target) {
      this.floatText(GAME_W / 2, BOARD_Y - 20, allies.length ? 'Герой без сознания' : 'Нет героя этой стихии', 0xffffff, 30);
    }

    // Камни улетают к герою своей стихии (а без него просто тают), параллельно поле досыпается сверху.
    const absorbs = chain.map((p, i) => {
      const s = this.stones[p.r][p.c]!;
      this.stones[p.r][p.c] = null;
      const fx = this.add.image(s.x, s.y, s.texture.key).setScale(1.12).setDepth(30);
      s.destroy();
      const to = target ? { x: target.x, y: target.cy, alpha: 0.7 } : { alpha: 0 };
      return this.tween({
        targets: fx,
        ...to,
        scale: 0.25,
        delay: i * 40,
        duration: 340,
        ease: 'Quad.easeIn',
      }).then(() => fx.destroy());
    });
    this.model.clear(chain);
    const refill = this.dropStones();

    await Promise.all(absorbs);
    this.guard();
    let lastDamage = 0;
    for (const unit of attackers) {
      if (this.foes.length === 0) break;
      lastDamage = await this.heroAttack(unit, chain.length);
      this.guard();
    }
    if (attackers.length > 0) {
      await this.applyTechnique(element, chain.length, lastDamage);
      this.guard();
      this.gainCharge(element, chain.length);
    }
    await refill;
    this.guard();

    if (this.foes.length === 0) {
      if (this.waveIndex >= this.waves.length - 1) return this.finish(true);
      await this.nextWave();
    } else {
      await this.enemyTurn();
      if (this.living().length === 0) return this.finish(false);
    }
    this.guard();

    if (!this.model.hasChain()) await this.reshuffle();
    this.guard();
    this.busy = false;
  }

  private dropStones(): Promise<unknown> {
    const anims: Promise<unknown>[] = [];
    for (const f of this.model.collapse()) {
      const s = this.stones[f.fromR][f.c]!;
      this.stones[f.fromR][f.c] = null;
      this.stones[f.toR][f.c] = s;
      anims.push(this.fall(s, f.toR, f.toR - f.fromR));
    }
    for (const sp of this.model.refill()) {
      const s = this.createStone(sp.c, sp.element, cellY(sp.r - sp.offset));
      this.stones[sp.r][sp.c] = s;
      anims.push(this.fall(s, sp.r, sp.offset));
    }
    return Promise.all(anims);
  }

  private fall(s: Stone, toR: number, distance: number): Promise<void> {
    return this.tween({ targets: s, y: cellY(toR), duration: 140 + distance * 60, ease: 'Bounce.easeOut' });
  }

  private async heroAttack(unit: Unit, chainLength: number): Promise<number> {
    const foe = this.currentTarget();
    if (!foe) return 0;
    const mult = elementMultiplier(unit.def.element, foe.def.element);
    const lengthBonus = 1 + CHAIN_LENGTH_BONUS * (chainLength - MIN_CHAIN);
    const tier = chainTier(chainLength).damageMultiplier;
    const dmg = Math.round(unit.atk * chainLength * 0.5 * mult * lengthBonus * this.guardMult(foe) * tier);

    const color = ELEMENT_COLOR[unit.def.element];

    await this.tween({ targets: unit.sprite, x: unit.x + 50, duration: 120, ease: 'Quad.easeOut' });
    this.guard();

    const from = { x: unit.x + 40, y: unit.cy };
    const to = { x: foe.x, y: foe.y - foe.h * 0.5 };
    // Ниже полосок HP (глубина 12), но выше спрайтов — снаряд не затирает цифры ходов.
    const orb = this.add.image(from.x, from.y, `stone_${unit.def.element}`).setScale(0.45).setDepth(11);
    const trail = this.add
      .particles(0, 0, 'spark', {
        follow: orb,
        lifespan: 320,
        frequency: 12,
        speed: { min: 10, max: 40 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: color,
        blendMode: 'ADD',
      })
      .setDepth(10);

    this.tweens.add({ targets: unit.sprite, x: unit.x, duration: 220, ease: 'Quad.easeInOut' });
    await this.tween({ targets: orb, x: to.x, y: to.y, angle: 360, duration: 280, ease: 'Quad.easeIn' });
    this.guard();
    orb.destroy();
    trail.stop();
    this.time.delayedCall(400, () => trail.destroy());

    this.burst(to.x, to.y, color);
    await this.dealDamage(foe, dmg, mult > 1 ? 0xffeb3b : color, mult > 1);
    this.guard();
    return dmg;
  }

  /** Стихийный приём цепочки из 10+. Огонь бьёт всех долей последней атаки. */
  private async applyTechnique(element: Element, chainLength: number, lastDamage: number): Promise<void> {
    if (!chainTier(chainLength).technique) return;
    this.floatText(GAME_W / 2, 200, chainTier(chainLength).name, ELEMENT_COLOR[element], 40);
    const splashRatio = techniqueSplashRatio(element);
    if (splashRatio > 0 && lastDamage > 0) {
      const splash = Math.max(1, Math.round(lastDamage * splashRatio));
      for (const foe of [...this.foes]) {
        if (!this.foes.includes(foe)) continue;
        await this.dealDamage(foe, splash, ELEMENT_COLOR[element], false);
        this.guard();
      }
    }
    const healRatio = techniqueHealRatio(element);
    if (healRatio > 0) this.healTeam(healRatio);
    const shieldRatio = techniqueShieldRatio(element);
    if (shieldRatio > 0) this.addShield(Math.round(this.teamMaxHp * shieldRatio));
    const delay = techniqueDelay(element);
    if (delay > 0) this.delayFoes([...this.foes], delay);
  }

  private gainCharge(element: Element, chainLength: number): void {
    for (const unit of this.team) {
      if (unit.def.element !== element || unit.hp <= 0) continue;
      const before = unit.charge;
      unit.charge = nextCharge(unit.charge, chainLength);
      this.refreshCharge(unit);
      if (before < SKILL_CHARGE_MAX && unit.charge >= SKILL_CHARGE_MAX) {
        this.floatText(unit.x, unit.cy, 'Навык готов', ELEMENT_COLOR[element], 26);
      }
    }
  }

  private refreshCharge(unit: Unit): void {
    const ready = unit.charge >= SKILL_CHARGE_MAX;
    unit.glow.setVisible(ready);
    unit.pips.forEach((pip, i) => {
      pip.setFillStyle(i < unit.charge ? ELEMENT_COLOR[unit.def.element] : 0x1a1428, 1);
      pip.setStrokeStyle(2, ready ? 0xffe066 : 0xffffff, 0.85);
    });
  }

  /** Герой под пальцем. Передний ряд перекрывает задний. */
  private heroAt(px: number, py: number): Unit | null {
    const front = [...this.team].sort((a, b) => b.y - a.y);
    return front.find((u) => u.hp > 0 && Math.abs(px - u.x) <= 58 && py <= u.y + 28 && py >= u.top) ?? null;
  }

  /** Свободное действие: ход не тратится и враги не отвечают. */
  private async castSkill(unit: Unit): Promise<void> {
    const skill = SKILLS[unit.def.skill];
    if (!skill || unit.hp <= 0 || unit.charge < SKILL_CHARGE_MAX || this.busy || this.paused || this.outcome) return;
    const needsFoe = skill.effect.kind === 'damage' || skill.effect.kind === 'delay';
    if (needsFoe && this.foes.length === 0) return;

    const epoch = this.epoch;
    this.busy = true;
    this.flow = epoch;
    unit.charge = 0;
    this.refreshCharge(unit);
    this.floatText(unit.x, unit.cy - 30, skill.name, 0xffe066, 28);
    try {
      await this.applySkill(unit, skill.effect);
      this.guard();
      if (this.foes.length === 0) {
        if (this.waveIndex >= this.waves.length - 1) return this.finish(true);
        await this.nextWave();
      }
      if (!this.model.hasChain()) await this.reshuffle();
    } catch (e) {
      if (e instanceof BattleGone || epoch !== this.epoch) return;
      console.error(e);
    }
    if (epoch !== this.epoch || this.outcome) return;
    this.busy = false;
  }

  private async applySkill(unit: Unit, effect: SkillEffect): Promise<void> {
    if (effect.kind === 'damage') {
      const hits = effect.hits ?? 1;
      for (let hit = 0; hit < hits; hit++) {
        const foe = this.currentTarget();
        if (!foe) return;
        const dmg = this.skillDamage(unit, foe, effect.multiplier, effect.guard ?? 'normal');
        this.flash(unit.sprite, ELEMENT_COLOR[unit.def.element]);
        await this.dealDamage(foe, dmg, ELEMENT_COLOR[unit.def.element], false);
        this.guard();
      }
      return;
    }
    if (effect.kind === 'heal') {
      this.healTeam(effect.ratio);
      return;
    }
    if (effect.kind === 'shield') {
      this.addShield(Math.round(this.teamMaxHp * effect.ratio));
      return;
    }
    if (effect.kind === 'delay') {
      const targets = effect.all ? [...this.foes] : [this.currentTarget()].filter((foe): foe is Foe => !!foe);
      this.delayFoes(targets, effect.turns);
      return;
    }
    if (effect.kind === 'convert') {
      this.convertStones(unit.def.element, effect.count);
      return;
    }
    this.attackBlocks++;
    this.floatText(unit.x, unit.y - unit.h, 'Бесконечность', 0xb9f6ff, 28);
  }

  private skillDamage(unit: Unit, foe: Foe, multiplier: number, guardMode: GuardMode): number {
    let guard = this.guardMult(foe);
    if (guardMode === 'ignore') guard = 1;
    else if (guardMode === 'half') guard = 1 - (1 - guard) / 2;
    const element = elementMultiplier(unit.def.element, foe.def.element);
    return Math.max(1, Math.round(unit.atk * multiplier * element * guard));
  }

  private async dealDamage(foe: Foe, dmg: number, color: number, advantage: boolean): Promise<void> {
    foe.hp = Math.max(0, foe.hp - dmg);
    this.flash(foe.sprite, 0xffffff);
    this.tweens.add({ targets: foe.root, x: foe.x + 14, duration: 50, yoyo: true, repeat: 1 });
    this.floatText(foe.x + Phaser.Math.Between(-30, 30), foe.y - foe.h * 0.55, advantage ? `${dmg}!` : `${dmg}`, color, advantage ? 54 : 42);
    this.updateFoeHp(foe);
    if (foe.hp <= 0) await this.killFoe(foe);
    else await this.wait(180);
  }

  /** Лечит каждого живого героя на долю его собственного максимума. */
  private healTeam(ratio: number): void {
    let healed = 0;
    for (const unit of this.living()) {
      const amount = Math.min(unit.maxHp - unit.hp, Math.round(unit.maxHp * ratio));
      if (amount <= 0) continue;
      unit.hp += amount;
      healed += amount;
      this.floatText(unit.x, unit.cy, `+${amount}`, 0x3fcf5a, 28);
    }
    if (healed > 0) this.updateTeamHp(true);
  }

  private addShield(amount: number): void {
    const cap = Math.round(this.teamMaxHp * SHIELD_CAP_RATIO);
    const added = Math.max(0, Math.min(amount, cap - this.teamShield));
    if (added <= 0) return;
    this.teamShield += added;
    this.updateTeamHp(false);
    this.floatText(212, 420, `+${added} Щит`, 0x6fb7ff, 42);
  }

  private delayFoes(foes: Foe[], turns: number): void {
    for (const foe of foes) {
      if (!this.foes.includes(foe)) continue;
      foe.cd += turns;
      this.updateFoeCd(foe);
      this.floatText(foe.x, foe.y - foe.h - 36, `+${turns}`, 0x9ad7ff, 36);
    }
  }

  /** Меняет случайные камни другого цвета на стихию навыка. */
  private convertStones(element: Element, count: number): void {
    const pool: Pos[] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) if (this.model.grid[r][c] !== element) pool.push({ r, c });
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let changed = 0;
    for (const pos of pool) {
      if (changed >= count) break;
      this.model.grid[pos.r][pos.c] = element;
      const stone = this.stones[pos.r][pos.c];
      stone?.setTexture(`stone_${element}`);
      changed++;
    }
    if (changed > 0) this.floatText(GAME_W / 2, BOARD_Y - 24, `${changed}`, ELEMENT_COLOR[element], 36);
  }

  private async enemyTurn(): Promise<void> {
    // Копия списка: призванные в этом ходу враги действуют со следующего.
    for (const foe of [...this.foes]) {
      if (!this.foes.includes(foe)) continue;
      foe.turns++;
      await this.trySummon(foe);
      this.guard();
      foe.cd--;
      this.updateFoeCd(foe);
      if (foe.cd > 0) continue;
      await this.foeAttack(foe);
      this.guard();
      if (this.living().length === 0) return;
    }
    await this.wait(150);
    this.guard();
  }

  private async trySummon(foe: Foe): Promise<void> {
    for (const t of foe.def.traits ?? []) {
      if (t.kind !== 'summon' || foe.turns % t.every !== 0 || this.foes.length >= t.max) continue;
      const def = ENEMIES[t.enemyId];
      const slot = this.slots.findIndex((_, i) => !this.foes.some((f) => f.slot === i));
      if (!def || slot < 0) continue;
      this.floatText(foe.x, foe.y - foe.h - 70, 'Призыв!', 0xffe066, 36);
      await this.tween({ targets: foe.root, scaleY: 1.08, duration: 150, yoyo: true });
      this.guard();
      this.addFoe(def, slot, true);
      this.updateGuards();
      await this.wait(450);
      this.guard();
    }
  }

  private async foeAttack(foe: Foe): Promise<void> {
    const boss = foe.def.rank === 'boss';
    await this.tween({ targets: foe.root, x: foe.x - (boss ? 140 : 90), duration: 160, ease: 'Quad.easeIn' });
    this.guard();
    if (this.attackBlocks > 0) {
      this.attackBlocks--;
      this.floatText(220, 420, 'Бесконечность', 0xb9f6ff, 40);
      await this.tween({ targets: foe.root, x: foe.x, duration: 260, ease: 'Quad.easeOut' });
      this.guard();
      foe.cd = foe.def.cooldown;
      this.updateFoeCd(foe);
      await this.wait(200);
      this.guard();
      return;
    }
    const target = this.attackTarget();
    if (!target) return;
    this.cameras.main.shake(250, boss ? 0.012 : 0.006);
    this.cameras.main.flash(150, 120, 0, 0);
    this.flash(target.sprite, 0xff3030);
    // Общий щит по-прежнему закрывает команду и сгорает раньше личного HP.
    const absorb = Math.min(foe.def.atk, this.teamShield);
    this.teamShield -= absorb;
    const realDmg = foe.def.atk - absorb;
    if (absorb > 0) this.floatText(target.x, target.cy - 28, `Щит -${absorb}`, 0x6fb7ff, 32);
    if (realDmg > 0) this.hurtUnit(target, realDmg);
    else this.updateTeamHp(false);
    await this.tween({ targets: foe.root, x: foe.x, duration: 260, ease: 'Quad.easeOut' });
    this.guard();
    foe.cd = foe.def.cooldown;
    this.updateFoeCd(foe);
    await this.wait(200);
    this.guard();
  }

  private async reshuffle(): Promise<void> {
    this.floatText(GAME_W / 2, BOARD_Y + (BOARD_ROWS * CELL) / 2, 'Нет цепочек — перемешиваю', 0xffffff, 32);
    await Promise.all(this.stones.flat().map((s) => this.tween({ targets: s, alpha: 0, scale: 0, duration: 250 })));
    this.guard();
    this.stones.flat().forEach((s) => s?.destroy());
    this.model.shuffle();
    this.buildStones();
    await Promise.all(
      this.stones.flat().map((s) => {
        s!.setScale(0);
        return this.tween({ targets: s, scale: 1, duration: 250 });
      }),
    );
    this.guard();
  }

  private finish(win: boolean): void {
    this.busy = true;
    this.outcome = win ? 'win' : 'lose';
    let result: StageResult | null = null;
    let reward = 0;
    if (this.stage) {
      if (win) {
        result = applyStageWin(this.stage.id, { moves: this.moves, teamHp: this.teamHp, teamMaxHp: this.teamMaxHp });
        reward = result.gold;
      }
    } else {
      reward = win ? REWARD_WIN : REWARD_LOSS;
      Save.get().gold += reward;
      Save.write();
    }
    const epoch = this.epoch;
    this.time.delayedCall(400, () => {
      if (epoch === this.epoch) this.showResult(win, reward, result);
    });
  }

  private showResult(win: boolean, reward: number, result: StageResult | null): void {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const text = (y: number, s: string, size: number, color: string) =>
      this.add
        .text(cx, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
        .setOrigin(0.5)
        .setStroke('#000000', Math.round(size / 7))
        .setDepth(101);

    this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.82).setDepth(100).setInteractive();
    text(cy - 300, win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ', 80, win ? '#ffe066' : '#ff5a5a');

    const stage = this.stage;
    if (stage && result) {
      const stars = [true, this.teamHp > this.teamMaxHp * STAR_HP_RATIO, this.moves <= stage.parMoves];
      stars.forEach((lit, i) => {
        const star = this.add
          .text(cx + (i - 1) * 120, cy - 180, '★', { fontFamily: FONT, fontSize: '110px', color: lit ? '#ffe066' : '#3a3550' })
          .setOrigin(0.5)
          .setStroke('#000000', 8)
          .setDepth(101)
          .setScale(0);
        this.tweens.add({ targets: star, scale: 1, delay: 200 + i * 220, duration: 300, ease: 'Back.easeOut' });
      });
      starRules(stage).forEach((rule, i) => {
        const detail = i === 1 ? ` (${hpPercent(this.teamHp, this.teamMaxHp, STAR_HP_RATIO)})` : i === 2 ? ` (${this.moves})` : '';
        text(cy - 80 + i * 36, `${stars[i] ? '✔' : '✘'} ${rule}${detail}`, 24, stars[i] ? '#b8ffb8' : '#ff9a9a');
      });
      const loot: Parameters<typeof iconText>[3] = [{ icon: 'icon_gold' }, `+${reward}`];
      if (result.crystals > 0) loot.push('    ', { icon: 'icon_crystal' }, `+${result.crystals}`);
      if (result.tickets > 0) loot.push('    ', { icon: 'icon_ticket' }, `+${result.tickets}`);
      iconText(this, cx, cy + 36, loot, { size: 32, color: '#ffe066', stroke: 6 }).setDepth(101);
      if (result.firstClear) text(cy + 76, 'Первое прохождение', 20, '#c9b8ff');
      let ry = cy + 112;
      for (const h of result.newHeroes) {
        text(ry, `Новый герой: ${CARDS[h.id].name}!`, 28, '#ffb0f0');
        ry += 38;
      }
      if (result.chapterReward) {
        text(ry, `Получен Камень Духа: ${ELEMENT_NAME[result.chapterReward.spiritStone]}!`, 28, hex(ELEMENT_COLOR[result.chapterReward.spiritStone]));
      }
      if (result.newHeroes.length) this.showNewHero(result.newHeroes[0]);
    } else if (reward > 0) {
      iconText(this, cx, cy - 30, [{ icon: 'icon_gold' }, `+${reward}`], { size: 40, color: '#ffe066', stroke: 6 }).setDepth(101);
    }

    const by = cy + 240;
    if (stage) {
      const toMap = () => this.scene.start('StoryMap', { chapterId: stage.chapter });
      const retry = () => this.scene.restart({ stageId: stage.id });
      if (win) {
        button(this, cx, by, 320, 96, 'Далее', () => this.scene.start('Dialogue', { stageId: stage.id, phase: 'post' }), 0xd8323c).setDepth(101);
        button(this, cx, by + 120, 320, 90, 'Повтор', retry).setDepth(101);
      } else {
        button(this, cx, by, 320, 96, 'Повтор', retry, 0xd8323c).setDepth(101);
        button(this, cx, by + 120, 320, 90, 'На карту', toMap).setDepth(101);
      }
    } else {
      button(this, cx, by, 320, 96, 'Ещё раз', () => this.scene.restart({})).setDepth(101);
      button(this, cx, by + 120, 320, 96, 'В меню', () => this.scene.start('MainMenu')).setDepth(101);
    }
  }

  /**
   * Всплывающее окно «Новый герой!» поверх итогов боя. Если герой не встал в команду сам (место его стихии занято
   * героем), предлагаем выбрать, кого он заменит.
   */
  private showNewHero(hero: JoinedHero): void {
    const def = CARDS[hero.id];
    const offer = !hero.inTeam;
    const cx = GAME_W / 2;
    const cy = offer ? 450 : GAME_H / 2 - 60;
    const [cw, ch] = offer ? [228, 304] : [300, 400];
    const bg = this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x07060f, 1).setDepth(110).setInteractive();
    const glow = this.add.circle(cx, cy, cw * 0.77, ELEMENT_COLOR[def.element], 0.35).setDepth(110);
    const owned = Save.get().cards[hero.id];
    const card = cardView(this, cx, cy, cw, ch, def, owned?.level, owned?.awakening).setDepth(111).setScale(0);
    const status = offer
      ? offerReason(hero.id)
      : hero.replaced
        ? `${def.name} занимает место духа «${CARDS[hero.replaced].name}»`
        : `${def.name} в команде!`;
    const parts: Phaser.GameObjects.GameObject[] = [
      bg,
      glow,
      card,
      this.add
        .text(cx, cy - ch / 2 - 56, 'НОВЫЙ ГЕРОЙ!', { fontFamily: FONT, fontSize: '60px', color: '#ffb0f0' })
        .setOrigin(0.5)
        .setStroke('#000000', 10)
        .setDepth(111),
      this.add
        .text(cx, cy + ch / 2 + 44, status, {
          fontFamily: FONT,
          fontSize: offer ? '24px' : '28px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: GAME_W - 60 },
        })
        .setOrigin(0.5)
        .setStroke('#000000', 7)
        .setDepth(111),
    ];
    const close = () => parts.forEach((p) => p.destroy());
    if (offer) {
      const btn = button(this, cx, 1090, 400, 90, 'Оставить в коллекции', close, 0x3a3157).setDepth(111);
      (btn.list[1] as Phaser.GameObjects.Text).setFontSize(28);
      parts.push(
        teamOffer(this, hero.id, 880, () => (btn.list[1] as Phaser.GameObjects.Text).setText('Продолжить')).setDepth(111),
        btn,
      );
    } else {
      parts.push(
        this.add
          .text(cx, cy + ch / 2 + 100, 'Нажми, чтобы продолжить', { fontFamily: FONT, fontSize: '22px', color: '#c9b8ff' })
          .setOrigin(0.5)
          .setDepth(111),
      );
      bg.once('pointerup', close);
    }
    this.tweens.add({ targets: card, scale: 1, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: glow, scale: 1.15, alpha: 0.15, duration: 800, yoyo: true, repeat: -1 });
    this.burst(cx, cy, ELEMENT_COLOR[def.element]);
  }

  // ---------- помощники ----------

  /** Спрайт персонажа, стоящий ступнями в (x, y); без текстуры — цветной силуэт-заглушка. */
  private unitSprite(key: string, x: number, y: number, h: number, e: Element, label: string, flip: boolean): Sprite {
    if (this.textures.exists(key)) {
      const img = this.add.image(x, y, key).setOrigin(0.5, 1);
      img.setScale(h / img.height).setFlipX(flip);
      return img;
    }
    const w = h * 0.55;
    const body = this.add.rectangle(0, -h / 2, w, h, ELEMENT_COLOR[e], 0.7).setStrokeStyle(3, 0xffffff);
    const text = this.add
      .text(0, -h / 2, label, { fontFamily: FONT, fontSize: `${Math.round(w / 4)}px`, color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 5);
    return this.add.container(x, y, [body, text]);
  }

  private breathe(sprite: Sprite): void {
    this.tweens.add({
      targets: sprite,
      scaleY: sprite.scaleY * 1.03,
      duration: 900 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 500,
    });
  }

  private flash(sprite: Sprite, color: number): void {
    if (!(sprite instanceof Phaser.GameObjects.Image)) return;
    sprite.setTintFill(color);
    this.time.delayedCall(90, () => sprite.clearTint());
  }

  private burst(x: number, y: number, color: number): void {
    const p = this.add
      .particles(x, y, 'spark', {
        lifespan: 450,
        speed: { min: 120, max: 320 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [color, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(41);
    p.explode(18);
    this.time.delayedCall(500, () => p.destroy());
  }

  private hpBar(x: number, y: number, w: number, h: number, color: number) {
    this.add.rectangle(x, y, w, h, 0x000000, 0.7).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.6);
    const bar = this.add.rectangle(x + 2, y + 2, w - 4, h - 4, color).setOrigin(0);
    const hpText = this.add
      .text(x + 8, y + h / 2, '', { fontFamily: FONT, fontSize: `${h - 4}px`, color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setStroke('#000000', 4);
    return { bar, text: hpText };
  }

  private living(): Unit[] {
    return this.team.filter((unit) => unit.hp > 0);
  }

  /** Враг бьёт ближайшего к себе живого героя — передний ряд раньше заднего. */
  private attackTarget(): Unit | null {
    const living = this.living();
    if (living.length === 0) return null;
    return [...living].sort((a, b) => b.y - a.y || b.x - a.x)[0];
  }

  private hurtUnit(unit: Unit, amount: number): void {
    unit.hp = Math.max(0, unit.hp - amount);
    this.floatText(unit.x, unit.cy, `-${amount}`, 0xff4040, 36);
    if (unit.hp <= 0) this.knockOut(unit);
    this.updateTeamHp(true);
  }

  private knockOut(unit: Unit): void {
    unit.charge = 0;
    unit.glow.setVisible(false);
    unit.sprite.setAlpha(0.35);
    unit.elementIcon.setAlpha(0.35);
    unit.hpBar.setAlpha(0.45);
    unit.hpBack.setAlpha(0.45);
    unit.pips.forEach((pip) => pip.setAlpha(0.35));
    this.refreshCharge(unit);
  }

  private updateTeamHp(animate: boolean): void {
    this.teamHp = this.team.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0);
    for (const unit of this.team) this.setBar(unit.hpBar, Math.max(0, unit.hp) / unit.maxHp, animate);
    this.shieldText.setVisible(this.teamShield > 0);
    if (this.teamShield > 0) this.shieldText.setText(`Щит ${this.teamShield}`);
  }

  private setBar(bar: Phaser.GameObjects.Rectangle, ratio: number, animate: boolean): void {
    if (animate) this.tweens.add({ targets: bar, scaleX: ratio, duration: 250, ease: 'Quad.easeOut' });
    else bar.scaleX = ratio;
  }

  private floatText(x: number, y: number, text: string, color: number, size: number): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: hex(color) })
      .setOrigin(0.5)
      .setStroke('#000000', 8)
      .setDepth(50);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.events.off('shutdown', onShutdown);
        resolve();
      };
      const onShutdown = () => finish();
      this.events.once('shutdown', onShutdown);
      this.tweens.add({ ...config, onComplete: finish, onStop: finish });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let ev: Phaser.Time.TimerEvent | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.events.off('shutdown', onShutdown);
        resolve();
      };
      const onShutdown = () => {
        ev?.remove(false);
        finish();
      };
      ev = this.time.delayedCall(ms, finish);
      this.events.once('shutdown', onShutdown);
    });
  }
}

/** Ход прерван закрытием сцены — обещание анимации больше некуда вести. */
class BattleGone extends Error {}

function cellX(c: number): number {
  return BOARD_X + c * CELL + CELL / 2;
}

function cellY(r: number): number {
  return BOARD_Y + r * CELL + CELL / 2;
}

function samePos(a: Pos, b: Pos): boolean {
  return a.r === b.r && a.c === b.c;
}

/** Клетка под точкой, если точка не дальше radius·CELL от её центра (чтобы диагонали не цепляли соседей). */
function cellAt(x: number, y: number, radius: number): Pos | null {
  const p = { r: Math.floor((y - BOARD_Y) / CELL), c: Math.floor((x - BOARD_X) / CELL) };
  if (p.r < 0 || p.r >= BOARD_ROWS || p.c < 0 || p.c >= BOARD_COLS) return null;
  if (Math.hypot(x - cellX(p.c), y - cellY(p.r)) > radius * CELL) return null;
  return p;
}

/** Процент HP для итогов: у порога звезды показываем десятые, чтобы «50%» не спорило с условием «> 50%». */
function hpPercent(hp: number, max: number, threshold: number): string {
  const pct = (hp / max) * 100;
  const whole = Math.floor(pct);
  return Math.abs(pct - threshold * 100) < 1 ? `${pct.toFixed(1)}%` : `${whole}%`;
}

function rankWeight(def: EnemyDef): number {
  return def.rank === 'boss' ? 2 : def.rank === 'elite' ? 1 : 0;
}
