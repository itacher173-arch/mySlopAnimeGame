import Phaser from 'phaser';
import { BoardModel, type Pos } from '../battle/BoardModel';
import { BOARD_COLS, BOARD_ROWS, BOARD_X, BOARD_Y, CELL, FONT, GAME_H, GAME_W } from '../config';
import { REWARD_LOSS, REWARD_WIN, cardStats } from '../core/progression';
import { Save } from '../core/SaveManager';
import { CARDS, type CardDef } from '../data/cards';
import { ELEMENT_COLOR, ELEMENT_NAME, elementMultiplier, type Element } from '../data/elements';
import { ENEMIES, type EnemyDef } from '../data/enemies';
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
const ENEMY_X = 560;
const ENEMY_Y = 590;
const ENEMY_H = 380;
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

  private enemy!: EnemyDef;
  private enemyHp = 0;
  private enemyCd = 0;
  private enemySprite!: Sprite;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyCdText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  create(): void {
    // Сцена переиспользуется при restart(), поэтому всё состояние сбрасываем здесь.
    this.busy = false;
    this.chain = [];
    this.chainElement = null;
    this.stones = [];
    this.team = [];

    this.drawBackground();
    this.createEnemy(ENEMIES.sukuna);
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
  }

  private createEnemy(def: EnemyDef): void {
    this.enemy = def;
    this.enemyHp = def.hp;
    this.enemyCd = def.cooldown;

    this.add.ellipse(ENEMY_X, ENEMY_Y, 220, 36, 0x000000, 0.4);
    this.enemySprite = this.unitSprite(`unit_${def.id}`, ENEMY_X, ENEMY_Y, ENEMY_H, def.element, def.name, false);
    this.breathe(this.enemySprite);

    this.add.text(24, 16, def.name, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setStroke('#000000', 6);
    this.add
      .text(GAME_W - 24, 18, ELEMENT_NAME[def.element], {
        fontFamily: FONT,
        fontSize: '22px',
        color: hex(ELEMENT_COLOR[def.element]),
      })
      .setOrigin(1, 0)
      .setStroke('#000000', 6);
    const { bar, text } = this.hpBar(24, 56, GAME_W - 48, 22, 0xd8323c);
    this.enemyHpBar = bar;
    this.enemyHpText = text;
    this.updateEnemyHp(false);

    this.add.circle(GAME_W - 70, 140, 40, 0x000000, 0.6).setStrokeStyle(4, 0xff5a5a);
    this.enemyCdText = this.add
      .text(GAME_W - 70, 134, '', { fontFamily: FONT, fontSize: '36px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W - 70, 164, 'ход', { fontFamily: FONT, fontSize: '15px', color: '#ffb0b0' })
      .setOrigin(0.5);
    this.updateEnemyCd();
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
      if (this.busy) return;
      const pos = cellAt(p.x, p.y, 0.75);
      if (!pos) return;
      this.chain = [pos];
      this.chainElement = this.model.get(pos);
      this.refreshChain();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.busy || !this.chainElement || !p.isDown) return;
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
    for (const unit of attackers) await this.heroAttack(unit, chain.length);
    await refill;

    if (this.enemyHp <= 0) {
      await this.tween({ targets: this.enemySprite, alpha: 0, y: ENEMY_Y + 30, duration: 500 });
      return this.finish(true);
    }

    await this.enemyTurn();
    if (this.teamHp <= 0) return this.finish(false);

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
    const mult = elementMultiplier(unit.def.element, this.enemy.element);
    const lengthBonus = 1 + CHAIN_LENGTH_BONUS * (chainLength - MIN_CHAIN);
    const dmg = Math.round(unit.atk * chainLength * 0.5 * lengthBonus * mult);
    const color = ELEMENT_COLOR[unit.def.element];

    await this.tween({ targets: unit.sprite, x: unit.x + 50, duration: 120, ease: 'Quad.easeOut' });

    const from = { x: unit.x + 40, y: unit.y - UNIT_H * 0.55 };
    const to = { x: ENEMY_X, y: ENEMY_Y - ENEMY_H * 0.5 };
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
    this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.flash(this.enemySprite, 0xffffff);
    this.tweens.add({ targets: this.enemySprite, x: ENEMY_X + 14, duration: 50, yoyo: true, repeat: 1 });
    this.floatText(to.x + Phaser.Math.Between(-50, 50), to.y - 40, mult > 1 ? `${dmg}!` : `${dmg}`, color, mult > 1 ? 58 : 46);
    this.updateEnemyHp(true);
    await this.wait(250);
  }

  private async enemyTurn(): Promise<void> {
    this.enemyCd--;
    this.updateEnemyCd();
    if (this.enemyCd > 0) {
      await this.wait(150);
      return;
    }

    await this.tween({ targets: this.enemySprite, x: ENEMY_X - 140, duration: 160, ease: 'Quad.easeIn' });
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(150, 120, 0, 0);
    for (const u of this.team) this.flash(u.sprite, 0xff3030);
    this.teamHp = Math.max(0, this.teamHp - this.enemy.atk);
    this.floatText(220, 420, `-${this.enemy.atk}`, 0xff4040, 52);
    this.updateTeamHp(true);
    await this.tween({ targets: this.enemySprite, x: ENEMY_X, duration: 260, ease: 'Quad.easeOut' });
    this.enemyCd = this.enemy.cooldown;
    this.updateEnemyCd();
    await this.wait(250);
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
    const reward = win ? REWARD_WIN : REWARD_LOSS;
    Save.get().gold += reward;
    Save.write();

    this.time.delayedCall(400, () => {
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.75).setDepth(100).setInteractive();
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 120, win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ', {
          fontFamily: FONT,
          fontSize: '80px',
          color: win ? '#ffe066' : '#ff5a5a',
        })
        .setOrigin(0.5)
        .setStroke('#000000', 10)
        .setDepth(101);
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 30, `+${reward} золота`, { fontFamily: FONT, fontSize: '36px', color: '#ffe066' })
        .setOrigin(0.5)
        .setStroke('#000000', 7)
        .setDepth(101);

      button(this, GAME_W / 2, GAME_H / 2 + 90, 320, 96, 'Ещё раз', () => this.scene.restart()).setDepth(101);
      button(this, GAME_W / 2, GAME_H / 2 + 210, 320, 96, 'В меню', () => this.scene.start('MainMenu')).setDepth(101);
    });
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

  private updateEnemyHp(animate: boolean): void {
    this.setBar(this.enemyHpBar, this.enemyHp / this.enemy.hp, animate);
    this.enemyHpText.setText(`${this.enemyHp} / ${this.enemy.hp}`);
  }

  private updateTeamHp(animate: boolean): void {
    this.setBar(this.teamHpBar, this.teamHp / this.teamMaxHp, animate);
    this.teamHpText.setText(`HP ${this.teamHp} / ${this.teamMaxHp}`);
  }

  private setBar(bar: Phaser.GameObjects.Rectangle, ratio: number, animate: boolean): void {
    if (animate) this.tweens.add({ targets: bar, scaleX: ratio, duration: 250, ease: 'Quad.easeOut' });
    else bar.scaleX = ratio;
  }

  private updateEnemyCd(): void {
    this.enemyCdText.setText(String(this.enemyCd));
    this.enemyCdText.setColor(this.enemyCd === 1 ? '#ff5a5a' : '#ffffff');
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

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
