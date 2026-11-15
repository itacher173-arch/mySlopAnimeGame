import Phaser from 'phaser';
import { BoardModel, type Pos } from '../battle/BoardModel';
import { BOARD_COLS, BOARD_ROWS, BOARD_X, BOARD_Y, CELL, FONT, GAME_H, GAME_W } from '../config';
import { REWARD_LOSS, REWARD_WIN, cardStats } from '../core/progression';
import { Save } from '../core/SaveManager';
import { applyStageWin, starRules, type StageResult } from '../core/story';
import { CARDS, type CardDef } from '../data/cards';
import { ELEMENT_COLOR, ELEMENT_NAME, elementMultiplier, type Element } from '../data/elements';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { STAGES, STAR_HP_RATIO, type StageDef } from '../data/story';
import { coverImage } from '../ui/images';
import { button } from '../ui/widgets';
import { STONE_SIZE } from './BootScene';

type Stone = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface Unit {
  def: CardDef;
  atk: number;
  sprite: Sprite;
  x: number;
  y: number;
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
const UNIT_H = 170;
/** Позиции ступней героев: задний ряд выше, передний ниже. */
const TEAM_SLOTS = [
  { x: 85, y: 460 },
  { x: 215, y: 440 },
  { x: 340, y: 460 },
  { x: 150, y: 600 },
  { x: 285, y: 600 },
];
const ENEMY_H = 200;
/** Раскладки слотов врагов (ступни) по числу врагов в волне; первый слот — главный (для босса). */
const ENEMY_SLOTS: { x: number; y: number }[][] = [
  [{ x: 560, y: 590 }],
  [
    { x: 610, y: 600 },
    { x: 460, y: 500 },
  ],
  [
    { x: 600, y: 570 },
    { x: 450, y: 470 },
    { x: 470, y: 625 },
  ],
];
const FOE_BAR_W = 120;
const FOE_UI_DEPTH = 12;
const QUICK_WAVES = [['sukuna']];
/** Значки стихий — полоса под полем боя, каждый под своим героем: так они не закрывают лица соседей. */
const BADGE_Y = 624;
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
  private teamHpBar!: Phaser.GameObjects.Rectangle;
  private teamHpText!: Phaser.GameObjects.Text;

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

  private headerName!: Phaser.GameObjects.Text;
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
    this.busy = false;
    this.paused = false;
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
    if (this.paused || this.pauseLayer.length) return;
    this.paused = true;
    const close = () => {
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = [];
      this.paused = false;
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
    const { x, y } = this.slots[slot];
    const h = def.height ?? ENEMY_H;
    const root = this.add.container(x, y).setDepth(y / 100);
    const sprite = this.unitSprite(`unit_${def.id}`, 0, 0, h, def.element, def.name, !!def.spriteFacesRight);
    const w = sprite instanceof Phaser.GameObjects.Image ? sprite.displayWidth : h * 0.55;
    root.add([this.add.ellipse(0, 0, Math.max(90, w * 0.8), Math.max(18, h * 0.09), 0x000000, 0.4), sprite]);
    this.breathe(sprite);

    // Маленькая полоска HP над головой: значок стихии, полоска, кружок с ходами до атаки.
    const barY = -h - 18;
    const ui = this.add.container(x, y).setDepth(FOE_UI_DEPTH);
    const hpBar = this.add.rectangle(-FOE_BAR_W / 2 + 2, barY, FOE_BAR_W - 4, 10, 0xd8323c).setOrigin(0, 0.5);
    const cdText = this.add
      .text(FOE_BAR_W / 2 + 22, barY, String(def.cooldown), { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 4);
    ui.add([
      this.add.rectangle(0, barY, FOE_BAR_W, 14, 0x000000, 0.75).setStrokeStyle(2, 0xffffff, 0.7),
      hpBar,
      this.add.image(-FOE_BAR_W / 2 - 16, barY, `stone_${def.element}`).setScale(0.3),
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

    if (animate) {
      for (const c of [root, ui]) {
        c.x = x + 320;
        c.setAlpha(0);
        this.tweens.add({ targets: c, x, alpha: 1, duration: 450, ease: 'Back.easeOut' });
      }
    }
    return foe;
  }

  private async killFoe(foe: Foe): Promise<void> {
    this.foes = this.foes.filter((f) => f !== foe);
    if (this.target === foe) this.selectTarget(this.foes[0] ?? null);
    this.updateGuards();
    const { root, ui } = foe;
    ui.destroy();
    this.burst(foe.x, foe.y - foe.h / 2, ELEMENT_COLOR[foe.def.element]);
    await this.tween({ targets: root, alpha: 0, y: foe.y + 30, duration: 380 });
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

  private foeAt(px: number, py: number): Foe | null {
    let best: Foe | null = null;
    for (const f of this.foes) {
      const inside = Math.abs(px - f.x) <= Math.max(f.w, 100) / 2 && py <= f.y + 20 && py >= f.y - f.h - 40;
      // При наложении выбираем того, кто стоит ближе (ниже на экране).
      if (inside && (!best || f.y > best.y)) best = f;
    }
    return best;
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
    this.headerName.setText(t.def.rank === 'boss' ? `☠ ${t.def.name}` : t.def.name);
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
    this.spawnWave(true);
    await this.wait(500);
    await this.tween({ targets: banner, alpha: 0, y: banner.y - 40, duration: 250 });
    banner.destroy();
  }

  private createTeam(): void {
    const save = Save.get();
    let maxHp = 0;
    save.team.forEach((id, i) => {
      const def = CARDS[id];
      const stats = cardStats(def, save.cards[id].level);
      maxHp += stats.hp;
      const { x, y } = TEAM_SLOTS[i];
      this.add.ellipse(x, y, 110, 22, 0x000000, 0.4).setDepth(y / 100 - 0.01);
      const sprite = this.unitSprite(`unit_${def.id}`, x, y, UNIT_H, def.element, def.name, !!def.spriteFacesLeft);
      sprite.setDepth(y / 100);
      this.add.image(x, BADGE_Y, `stone_${def.element}`).setScale(0.3).setDepth(BADGE_DEPTH);
      this.breathe(sprite);
      this.team.push({ def, atk: stats.atk, sprite, x, y });
    });

    this.teamMaxHp = maxHp;
    this.teamHp = this.teamMaxHp;
    const { bar, text } = this.hpBar(14, TEAM_HP_Y, GAME_W - 28, 22, 0x3fcf5a);
    this.teamHpBar = bar;
    this.teamHpText = text;
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
      if (this.paused) return;
      if (p.y < FIELD_H) {
        const foe = this.foeAt(p.x, p.y);
        if (foe && foe !== this.target) this.selectTarget(foe);
        return;
      }
      if (this.busy) return;
      const pos = cellAt(p.x, p.y, 0.75);
      if (!pos) return;
      this.chain = [pos];
      this.chainElement = this.model.get(pos);
      this.refreshChain();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.busy || this.paused || !this.chainElement || !p.isDown) return;
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

    const release = () => {
      if (!this.chainElement) return;
      const chain = this.chain;
      const element = this.chainElement;
      this.chain = [];
      this.chainElement = null;
      this.refreshChain();
      if (chain.length >= MIN_CHAIN) void this.resolveChain(chain, element);
    };
    this.input.on('pointerup', release);
    this.input.on('gameout', release);
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
    this.chainBadge
      .setText(String(this.chain.length))
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
    this.busy = true;
    this.moves++;
    this.updateInfo();
    const attackers = this.team.filter((u) => u.def.element === element);
    const target = attackers[0] ?? this.team[0];

    // Камни улетают к герою своей стихии, параллельно поле досыпается сверху.
    const absorbs = chain.map((p, i) => {
      const s = this.stones[p.r][p.c]!;
      this.stones[p.r][p.c] = null;
      const fx = this.add.image(s.x, s.y, s.texture.key).setScale(1.12).setDepth(30);
      s.destroy();
      return this.tween({
        targets: fx,
        x: target.x,
        y: target.y - UNIT_H / 2,
        scale: 0.25,
        alpha: 0.7,
        delay: i * 40,
        duration: 340,
        ease: 'Quad.easeIn',
      }).then(() => fx.destroy());
    });
    this.model.clear(chain);
    const refill = this.dropStones();

    await Promise.all(absorbs);
    for (const unit of attackers) {
      if (this.foes.length === 0) break;
      await this.heroAttack(unit, chain.length);
    }
    await refill;

    if (this.foes.length === 0) {
      if (this.waveIndex >= this.waves.length - 1) return this.finish(true);
      await this.nextWave();
    } else {
      await this.enemyTurn();
      if (this.teamHp <= 0) return this.finish(false);
    }

    if (!this.model.hasChain()) await this.reshuffle();
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

  private async heroAttack(unit: Unit, chainLength: number): Promise<void> {
    const foe = this.currentTarget();
    if (!foe) return;
    const mult = elementMultiplier(unit.def.element, foe.def.element);
    const guard = this.guardMult(foe);
    const lengthBonus = 1 + CHAIN_LENGTH_BONUS * (chainLength - MIN_CHAIN);
    const dmg = Math.round(unit.atk * chainLength * 0.5 * lengthBonus * mult * guard);
    const color = ELEMENT_COLOR[unit.def.element];

    await this.tween({ targets: unit.sprite, x: unit.x + 50, duration: 120, ease: 'Quad.easeOut' });

    const from = { x: unit.x + 40, y: unit.y - UNIT_H * 0.55 };
    const to = { x: foe.x, y: foe.y - foe.h * 0.5 };
    const orb = this.add.image(from.x, from.y, `stone_${unit.def.element}`).setScale(0.45).setDepth(40);
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
      .setDepth(39);

    void this.tween({ targets: unit.sprite, x: unit.x, duration: 220, ease: 'Quad.easeInOut' });
    await this.tween({ targets: orb, x: to.x, y: to.y, angle: 360, duration: 280, ease: 'Quad.easeIn' });
    orb.destroy();
    trail.stop();
    this.time.delayedCall(400, () => trail.destroy());

    this.burst(to.x, to.y, color);
    foe.hp = Math.max(0, foe.hp - dmg);
    this.flash(foe.sprite, 0xffffff);
    this.tweens.add({ targets: foe.root, x: foe.x + 14, duration: 50, yoyo: true, repeat: 1 });
    const label = guard < 1 ? `${dmg} щит` : mult > 1 ? `${dmg}!` : `${dmg}`;
    this.floatText(to.x + Phaser.Math.Between(-40, 40), to.y - 40, label, guard < 1 ? 0x8fd3ff : color, mult > 1 ? 54 : 42);
    this.updateFoeHp(foe);
    if (foe.hp <= 0) await this.killFoe(foe);
    else await this.wait(250);
  }

  private async enemyTurn(): Promise<void> {
    // Копия списка: призванные в этом ходу враги действуют со следующего.
    for (const foe of [...this.foes]) {
      if (!this.foes.includes(foe)) continue;
      foe.turns++;
      await this.trySummon(foe);
      foe.cd--;
      this.updateFoeCd(foe);
      if (foe.cd > 0) continue;
      await this.foeAttack(foe);
      if (this.teamHp <= 0) return;
    }
    await this.wait(150);
  }

  private async trySummon(foe: Foe): Promise<void> {
    for (const t of foe.def.traits ?? []) {
      if (t.kind !== 'summon' || foe.turns % t.every !== 0 || this.foes.length >= t.max) continue;
      const def = ENEMIES[t.enemyId];
      const slot = this.slots.findIndex((_, i) => !this.foes.some((f) => f.slot === i));
      if (!def || slot < 0) continue;
      this.floatText(foe.x, foe.y - foe.h - 70, 'Призыв!', 0xffe066, 36);
      await this.tween({ targets: foe.root, scaleY: 1.08, duration: 150, yoyo: true });
      this.addFoe(def, slot, true);
      this.updateGuards();
      await this.wait(450);
    }
  }

  private async foeAttack(foe: Foe): Promise<void> {
    const boss = foe.def.rank === 'boss';
    await this.tween({ targets: foe.root, x: foe.x - (boss ? 140 : 90), duration: 160, ease: 'Quad.easeIn' });
    this.cameras.main.shake(250, boss ? 0.012 : 0.006);
    this.cameras.main.flash(150, 120, 0, 0);
    for (const u of this.team) this.flash(u.sprite, 0xff3030);
    this.teamHp = Math.max(0, this.teamHp - foe.def.atk);
    this.floatText(220, 420, `-${foe.def.atk}`, 0xff4040, 52);
    this.updateTeamHp(true);
    await this.tween({ targets: foe.root, x: foe.x, duration: 260, ease: 'Quad.easeOut' });
    foe.cd = foe.def.cooldown;
    this.updateFoeCd(foe);
    await this.wait(200);
  }

  private async reshuffle(): Promise<void> {
    this.floatText(GAME_W / 2, BOARD_Y + (BOARD_ROWS * CELL) / 2, 'Нет цепочек — перемешиваю', 0xffffff, 32);
    await Promise.all(this.stones.flat().map((s) => this.tween({ targets: s, alpha: 0, scale: 0, duration: 250 })));
    this.stones.flat().forEach((s) => s?.destroy());
    this.model.shuffle();
    this.buildStones();
    await Promise.all(
      this.stones.flat().map((s) => {
        s!.setScale(0);
        return this.tween({ targets: s, scale: 1, duration: 250 });
      }),
    );
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
    this.time.delayedCall(400, () => this.showResult(win, reward, result));
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

    this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.75).setDepth(100).setInteractive();
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
        const detail = i === 1 ? ` (${Math.round((this.teamHp / this.teamMaxHp) * 100)}%)` : i === 2 ? ` (${this.moves})` : '';
        text(cy - 80 + i * 36, `${stars[i] ? '✔' : '✘'} ${rule}${detail}`, 24, stars[i] ? '#b8ffb8' : '#ff9a9a');
      });
      text(cy + 40, `+${reward} золота${result.firstClear ? ' (первое прохождение)' : ''}`, 30, '#ffe066');
      if (result.chapterReward) {
        text(cy + 90, `Получен Камень Духа: ${ELEMENT_NAME[result.chapterReward.spiritStone]}!`, 30, hex(ELEMENT_COLOR[result.chapterReward.spiritStone]));
      }
    } else if (reward > 0) {
      text(cy - 30, `+${reward} золота`, 36, '#ffe066');
    }

    const by = cy + 210;
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
    const text = this.add
      .text(x + w / 2, y + h / 2, '', { fontFamily: FONT, fontSize: `${h - 4}px`, color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 4);
    return { bar, text };
  }

  private updateTeamHp(animate: boolean): void {
    this.setBar(this.teamHpBar, this.teamHp / this.teamMaxHp, animate);
    this.teamHpText.setText(`HP ${this.teamHp} / ${this.teamMaxHp}`);
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
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}

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

function rankWeight(def: EnemyDef): number {
  return def.rank === 'boss' ? 2 : def.rank === 'elite' ? 1 : 0;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
