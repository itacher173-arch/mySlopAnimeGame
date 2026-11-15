import Phaser from 'phaser';
import { BoardModel, type Pos } from '../battle/BoardModel';
import { BOARD_COLS, BOARD_ROWS, BOARD_X, BOARD_Y, CELL, FONT, GAME_H, GAME_W } from '../config';
import { CARDS, STARTER_TEAM, type CardDef } from '../data/cards';
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_NAME, elementMultiplier, type Element } from '../data/elements';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { STONE_SIZE } from './BootScene';

type Stone = Phaser.GameObjects.Image;
type Portrait = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface CardView {
  def: CardDef;
  container: Phaser.GameObjects.Container;
}

const CARD_W = 132;
const CARD_H = 176;
const CARD_GAP = 8;
const CARD_Y = 455 + CARD_H / 2;
const TEAM_HP_Y = 648;
const ENEMY_X = GAME_W / 2;
const ENEMY_Y = 200;
const COMBO_BONUS = 0.25;

export class BattleScene extends Phaser.Scene {
  private model!: BoardModel;
  private stones: (Stone | null)[][] = [];
  private stoneLayer!: Phaser.GameObjects.Container;
  private busy = false;
  private selected: Pos | null = null;
  private selectFx!: Phaser.GameObjects.Rectangle;
  private dragStart: { pos: Pos; x: number; y: number } | null = null;

  private team: CardView[] = [];
  private teamMaxHp = 0;
  private teamHp = 0;
  private teamHpBar!: Phaser.GameObjects.Rectangle;
  private teamHpText!: Phaser.GameObjects.Text;

  private enemy!: EnemyDef;
  private enemyHp = 0;
  private enemyCd = 0;
  private enemyView!: Portrait;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyCdText!: Phaser.GameObjects.Text;

  private comboText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  create(): void {
    // Сцена переиспользуется при restart(), поэтому всё состояние сбрасываем здесь.
    this.busy = false;
    this.selected = null;
    this.dragStart = null;
    this.stones = [];
    this.team = [];

    this.drawBackground();
    this.createEnemy(ENEMIES.sukuna);
    this.createTeam(STARTER_TEAM.map((id) => CARDS[id]));
    this.createBoard();
    this.setupInput();
  }

  // ---------- построение сцены ----------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x3a1d5c, 0x3a1d5c, 0x120c22, 0x120c22, 1);
    g.fillRect(0, 0, GAME_W, 440);
    g.fillStyle(0x161229, 1).fillRect(0, 440, GAME_W, GAME_H - 440);

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

    this.add.ellipse(ENEMY_X, ENEMY_Y + 175, 300, 40, 0x000000, 0.35);
    this.enemyView = this.portrait(`enemy_${def.id}`, ENEMY_X, ENEMY_Y, 255, 340, def.element, def.name);

    this.add
      .text(40, 388, `${def.name}`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' })
      .setStroke('#000000', 5);
    this.add
      .text(GAME_W - 40, 388, ELEMENT_NAME[def.element], {
        fontFamily: FONT,
        fontSize: '22px',
        color: hex(ELEMENT_COLOR[def.element]),
      })
      .setOrigin(1, 0)
      .setStroke('#000000', 5);

    const { bar, text } = this.hpBar(40, 422, GAME_W - 80, 20, 0xd8323c);
    this.enemyHpBar = bar;
    this.enemyHpText = text;
    this.updateEnemyHp(false);

    this.add.circle(GAME_W - 80, 80, 44, 0x000000, 0.6).setStrokeStyle(4, 0xff5a5a);
    this.enemyCdText = this.add
      .text(GAME_W - 80, 74, '', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W - 80, 108, 'ход', { fontFamily: FONT, fontSize: '16px', color: '#ffb0b0' })
      .setOrigin(0.5);
    this.updateEnemyCd();
  }

  private createTeam(defs: CardDef[]): void {
    const totalW = defs.length * CARD_W + (defs.length - 1) * CARD_GAP;
    const startX = (GAME_W - totalW) / 2 + CARD_W / 2;

    defs.forEach((def, i) => {
      const x = startX + i * (CARD_W + CARD_GAP);
      const pic = this.portrait(`card_${def.id}`, 0, 0, CARD_W, CARD_H, def.element, def.name);
      const frame = this.add.rectangle(0, 0, CARD_W, CARD_H).setStrokeStyle(4, ELEMENT_COLOR[def.element]);
      const badge = this.add.image(-CARD_W / 2 + 18, -CARD_H / 2 + 18, `stone_${def.element}`).setScale(0.4);
      const nameBg = this.add.rectangle(0, CARD_H / 2 - 14, CARD_W - 4, 26, 0x000000, 0.6);
      const name = this.add
        .text(0, CARD_H / 2 - 14, def.name, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
        .setOrigin(0.5);
      const container = this.add.container(x, CARD_Y, [pic, frame, badge, nameBg, name]);
      this.team.push({ def, container });
    });

    this.teamMaxHp = defs.reduce((s, d) => s + d.hp, 0);
    this.teamHp = this.teamMaxHp;
    const { bar, text } = this.hpBar(14, TEAM_HP_Y, GAME_W - 28, 22, 0x3fcf5a);
    this.teamHpBar = bar;
    this.teamHpText = text;
    this.updateTeamHp(false);
  }

  private createBoard(): void {
    this.model = new BoardModel(BOARD_COLS, BOARD_ROWS);
    this.stoneLayer = this.add.container(0, 0);
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(BOARD_X, BOARD_Y, BOARD_COLS * CELL, BOARD_ROWS * CELL);
    this.stoneLayer.setMask(maskShape.createGeometryMask());

    this.selectFx = this.add
      .rectangle(0, 0, CELL - 4, CELL - 4)
      .setStrokeStyle(4, 0xffffff)
      .setVisible(false);
    this.tweens.add({ targets: this.selectFx, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });

    this.comboText = this.add
      .text(GAME_W / 2, BOARD_Y + (BOARD_ROWS * CELL) / 2, '', {
        fontFamily: FONT,
        fontSize: '64px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setStroke('#5a2a00', 10)
      .setDepth(10)
      .setAlpha(0);

    this.buildStones();
  }

  private buildStones(): void {
    this.stones = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      this.stones.push([]);
      for (let c = 0; c < BOARD_COLS; c++) {
        this.stones[r].push(this.createStone(r, c, this.model.grid[r][c]!, cellY(r)));
      }
    }
  }

  private createStone(r: number, c: number, e: Element, y: number): Stone {
    const s = this.add.image(cellX(c), y, `stone_${e}`).setDisplaySize(STONE_SIZE, STONE_SIZE);
    this.stoneLayer.add(s);
    return s;
  }

  // ---------- ввод ----------

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      const pos = cellAt(p.x, p.y);
      this.dragStart = pos ? { pos, x: p.x, y: p.y } : null;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.busy || !this.dragStart || !p.isDown) return;
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.35) return;
      const from = this.dragStart.pos;
      const to =
        Math.abs(dx) > Math.abs(dy) ? { r: from.r, c: from.c + Math.sign(dx) } : { r: from.r + Math.sign(dy), c: from.c };
      this.dragStart = null;
      if (inBoard(to)) void this.trySwap(from, to);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.busy || !this.dragStart) return;
      this.dragStart = null;
      const pos = cellAt(p.x, p.y);
      if (!pos) return;
      if (this.selected && BoardModel.adjacent(this.selected, pos)) {
        void this.trySwap(this.selected, pos);
      } else if (this.selected && this.selected.r === pos.r && this.selected.c === pos.c) {
        this.setSelected(null);
      } else {
        this.setSelected(pos);
      }
    });
  }

  private setSelected(pos: Pos | null): void {
    this.selected = pos;
    this.selectFx.setVisible(!!pos);
    if (pos) this.selectFx.setPosition(cellX(pos.c), cellY(pos.r));
  }

  // ---------- ход ----------

  private async trySwap(a: Pos, b: Pos): Promise<void> {
    this.busy = true;
    this.setSelected(null);

    await this.animateSwap(a, b);
    this.model.swap(a, b);
    if (this.model.findMatches().length === 0) {
      this.model.swap(a, b);
      await this.animateSwap(a, b);
      this.busy = false;
      return;
    }

    const { counts, combo } = await this.resolveBoard();
    await this.playerAttack(counts, combo);
    if (this.enemyHp <= 0) return this.finish(true);

    await this.enemyTurn();
    if (this.teamHp <= 0) return this.finish(false);

    if (!this.model.hasPossibleMove()) await this.reshuffle();
    this.busy = false;
  }

  private animateSwap(a: Pos, b: Pos): Promise<unknown> {
    const sa = this.stones[a.r][a.c]!;
    const sb = this.stones[b.r][b.c]!;
    this.stones[a.r][a.c] = sb;
    this.stones[b.r][b.c] = sa;
    return Promise.all([
      this.tween({ targets: sa, x: cellX(b.c), y: cellY(b.r), duration: 160, ease: 'Quad.easeInOut' }),
      this.tween({ targets: sb, x: cellX(a.c), y: cellY(a.r), duration: 160, ease: 'Quad.easeInOut' }),
    ]);
  }

  private async resolveBoard(): Promise<{ counts: Record<Element, number>; combo: number }> {
    const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
    let combo = 0;

    for (;;) {
      const groups = this.model.findMatches();
      if (groups.length === 0) break;

      const cells: Pos[] = [];
      for (const g of groups) {
        combo++;
        counts[g.element] += g.cells.length;
        cells.push(...g.cells);
      }
      if (combo > 1) this.showCombo(combo);

      await Promise.all(
        cells.map((p) => {
          const s = this.stones[p.r][p.c]!;
          this.stones[p.r][p.c] = null;
          return this.tween({ targets: s, scale: 0, alpha: 0, angle: 90, duration: 200 }).then(() => s.destroy());
        }),
      );
      this.model.clear(cells);

      const anims: Promise<unknown>[] = [];
      for (const f of this.model.collapse()) {
        const s = this.stones[f.fromR][f.c]!;
        this.stones[f.fromR][f.c] = null;
        this.stones[f.toR][f.c] = s;
        anims.push(this.fall(s, f.toR, f.toR - f.fromR));
      }
      for (const sp of this.model.refill()) {
        const s = this.createStone(sp.r, sp.c, sp.element, cellY(sp.r - sp.offset));
        this.stones[sp.r][sp.c] = s;
        anims.push(this.fall(s, sp.r, sp.offset));
      }
      await Promise.all(anims);
    }

    return { counts, combo };
  }

  private fall(s: Stone, toR: number, distance: number): Promise<void> {
    return this.tween({ targets: s, y: cellY(toR), duration: 120 + distance * 60, ease: 'Bounce.easeOut' });
  }

  private async playerAttack(counts: Record<Element, number>, combo: number): Promise<void> {
    const comboMult = 1 + COMBO_BONUS * (combo - 1);
    for (const card of this.team) {
      const n = counts[card.def.element];
      if (n === 0) continue;
      const mult = elementMultiplier(card.def.element, this.enemy.element);
      const dmg = Math.round(card.def.atk * (n / 3) * comboMult * mult);

      await this.tween({ targets: card.container, y: CARD_Y - 24, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      this.hitEnemy();
      const label = mult > 1 ? `${dmg}!` : `${dmg}`;
      this.floatText(ENEMY_X + Phaser.Math.Between(-80, 80), ENEMY_Y + Phaser.Math.Between(-60, 40), label, ELEMENT_COLOR[card.def.element], mult > 1 ? 56 : 44);
      this.updateEnemyHp(true);
      await this.wait(160);
      if (this.enemyHp <= 0) break;
    }
  }

  private async enemyTurn(): Promise<void> {
    this.enemyCd--;
    this.updateEnemyCd();
    if (this.enemyCd > 0) {
      await this.wait(150);
      return;
    }

    await this.tween({ targets: this.enemyView, scale: this.enemyView.scale * 1.15, duration: 160, yoyo: true });
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(150, 120, 0, 0);
    this.teamHp = Math.max(0, this.teamHp - this.enemy.atk);
    this.floatText(GAME_W / 2, TEAM_HP_Y - 40, `-${this.enemy.atk}`, 0xff4040, 48);
    this.updateTeamHp(true);
    this.enemyCd = this.enemy.cooldown;
    this.updateEnemyCd();
    await this.wait(400);
  }

  private async reshuffle(): Promise<void> {
    this.floatText(GAME_W / 2, BOARD_Y + (BOARD_ROWS * CELL) / 2, 'Нет ходов — перемешиваю', 0xffffff, 32);
    await Promise.all(this.stones.flat().map((s) => this.tween({ targets: s, alpha: 0, scale: 0, duration: 250 })));
    this.stones.flat().forEach((s) => s?.destroy());
    this.model.shuffle();
    this.buildStones();
    await Promise.all(
      this.stones.flat().map((s) => {
        s!.setScale(0);
        return this.tween({ targets: s, scale: STONE_SIZE / s!.width, duration: 250 });
      }),
    );
  }

  private finish(win: boolean): void {
    this.time.delayedCall(500, () => {
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

      const btn = this.add
        .rectangle(GAME_W / 2, GAME_H / 2 + 40, 320, 96, 0x6b3fd1)
        .setStrokeStyle(4, 0xffffff)
        .setDepth(101)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GAME_W / 2, GAME_H / 2 + 40, 'Ещё раз', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(102);
      btn.on('pointerup', () => this.scene.restart());
    });
  }

  // ---------- UI-помощники ----------

  /** Портрет с обрезкой под нужный размер; если картинки нет — цветная заглушка с именем. */
  private portrait(key: string, x: number, y: number, w: number, h: number, e: Element, label: string): Portrait {
    if (this.textures.exists(key)) {
      const img = this.add.image(x, y, key);
      const scale = Math.max(w / img.width, h / img.height);
      const cw = w / scale;
      const ch = h / scale;
      img.setCrop((img.width - cw) / 2, (img.height - ch) / 2, cw, ch).setScale(scale);
      return img;
    }
    const bg = this.add.rectangle(0, 0, w, h, ELEMENT_COLOR[e], 0.55);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(w / 6)}px`, color: '#ffffff', align: 'center' })
      .setOrigin(0.5)
      .setStroke('#000000', 6);
    return this.add.container(x, y, [bg, text]);
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

  private hitEnemy(): void {
    this.tweens.add({ targets: this.enemyView, x: ENEMY_X + 10, duration: 40, yoyo: true, repeat: 2 });
    if (this.enemyView instanceof Phaser.GameObjects.Image) {
      this.enemyView.setTintFill(0xffffff);
      this.time.delayedCall(70, () => (this.enemyView as Phaser.GameObjects.Image).clearTint());
    }
  }

  private showCombo(combo: number): void {
    this.tweens.killTweensOf(this.comboText);
    this.comboText.setText(`Комбо x${combo}`).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 700, duration: 300 });
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

function inBoard(p: Pos): boolean {
  return p.r >= 0 && p.r < BOARD_ROWS && p.c >= 0 && p.c < BOARD_COLS;
}

function cellAt(x: number, y: number): Pos | null {
  const p = { r: Math.floor((y - BOARD_Y) / CELL), c: Math.floor((x - BOARD_X) / CELL) };
  return inBoard(p) ? p : null;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
