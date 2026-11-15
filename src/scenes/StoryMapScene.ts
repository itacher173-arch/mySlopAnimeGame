import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { Save } from '../core/SaveManager';
import { isChapterComplete, isChapterOpen, isStageOpen, stageStars } from '../core/story';
import { ELEMENT_COLOR, ELEMENT_NAME } from '../data/elements';
import { CHAPTERS, STAGE_GOLD_FIRST, STAGE_GOLD_REPEAT, STAR_HP_RATIO, type ChapterDef } from '../data/story';
import { coverImage } from '../ui/images';
import { button, currencyLabel } from '../ui/widgets';

const TABS_Y = 1222;
const NODE_R = 46;

export class StoryMapScene extends Phaser.Scene {
  private chapter!: ChapterDef;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('StoryMap');
  }

  init(data: { chapterId?: number }): void {
    const wanted = CHAPTERS.find((c) => c.id === data.chapterId);
    // По умолчанию — последняя открытая глава.
    this.chapter = wanted ?? [...CHAPTERS].reverse().find(isChapterOpen) ?? CHAPTERS[0];
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.drawChapter();

    const bars = this.add.graphics();
    bars.fillStyle(0x0d0b1a, 0.85).fillRect(0, 0, GAME_W, 80).fillRect(0, TABS_Y - 50, GAME_W, GAME_H - TABS_Y + 50);
    button(this, 80, 40, 130, 56, 'Назад', () => this.scene.start('MainMenu'), 0x3a3157);
    currencyLabel(this, GAME_W - 20, 16);
    this.drawTabs();
  }

  private drawTabs(): void {
    const gap = 128;
    const startX = GAME_W / 2 - gap * 2;
    CHAPTERS.forEach((ch, i) => {
      const x = startX + i * gap;
      const open = isChapterOpen(ch);
      const selected = ch === this.chapter;
      const bg = this.add
        .circle(x, TABS_Y, 38, open ? ELEMENT_COLOR[ch.element] : 0x3a3550, selected ? 1 : 0.55)
        .setStrokeStyle(selected ? 6 : 3, selected ? 0xffe066 : 0xffffff, selected ? 1 : 0.5);
      this.add
        .text(x, TABS_Y - 2, String(ch.id), { fontFamily: FONT, fontSize: '40px', color: open ? '#ffffff' : '#8a84a0' })
        .setOrigin(0.5)
        .setStroke('#000000', 6);
      if (isChapterComplete(ch)) this.add.text(x + 28, TABS_Y - 40, '✔', { fontFamily: FONT, fontSize: '26px', color: '#7dff8a' }).setStroke('#000000', 5);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (ch !== this.chapter) this.scene.restart({ chapterId: ch.id });
      });
    });
  }

  private drawChapter(): void {
    const ch = this.chapter;
    const mapKey = `bg_${ch.map}`;
    if (this.textures.exists(mapKey)) this.layer.add(coverImage(this, mapKey, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H));
    else {
      const g = this.add.graphics();
      const tint = ELEMENT_COLOR[ch.element];
      const dark = Phaser.Display.Color.IntegerToColor(tint).darken(45).color;
      g.fillGradientStyle(0x0d0b1a, 0x0d0b1a, dark, dark, 1).fillRect(0, 0, GAME_W, GAME_H);
      this.layer.add(g);
    }

    const titleBg = this.add.rectangle(GAME_W / 2, 116, GAME_W, 72, 0x000000, 0.55);
    const title = this.add
      .text(GAME_W / 2, 102, `Глава ${ch.id}. ${ch.title}`, { fontFamily: FONT, fontSize: '34px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#000000', 7);
    const sub = this.add
      .text(GAME_W / 2, 136, `${ch.anime} · ${ELEMENT_NAME[ch.element]}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 4);
    this.layer.add([titleBg, title, sub]);

    if (!isChapterOpen(ch)) this.drawLocked(ch);
    else this.drawStages(ch);
  }

  private drawLocked(ch: ChapterDef): void {
    this.layer.add([
      this.add.rectangle(0, 152, GAME_W, GAME_H - 152, 0x000000, 0.5).setOrigin(0),
      this.add
        .text(GAME_W / 2, 600, ch.comingSoon ? 'Скоро' : 'Закрыто', { fontFamily: FONT, fontSize: '96px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#000000', 12),
      this.add
        .text(GAME_W / 2, 730, ch.teaser, {
          fontFamily: FONT,
          fontSize: '26px',
          color: '#d8d0ff',
          align: 'center',
          wordWrap: { width: 600 },
        })
        .setOrigin(0.5, 0)
        .setStroke('#000000', 6),
      this.add
        .text(GAME_W / 2, 900, `Награда: Камень Духа (${ELEMENT_NAME[ch.reward.spiritStone]})`, {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ffe066',
        })
        .setOrigin(0.5)
        .setStroke('#000000', 6),
    ]);
  }

  private drawStages(ch: ChapterDef): void {
    const path = this.add.graphics();
    const pts = ch.nodes.slice(0, ch.stages.length);
    for (let i = 1; i < pts.length; i++) {
      const cleared = stageStars(ch.stages[i - 1].id) > 0;
      dottedTrail(path, [pts[i - 1], ...(ch.trail?.[i - 1] ?? []), pts[i]], cleared ? 0xffe066 : 0xffffff, cleared ? 1 : 0.6);
    }
    this.layer.add(path);

    ch.stages.forEach((stage, i) => {
      const { x, y } = pts[i];
      const open = isStageOpen(stage);
      const stars = stageStars(stage.id);
      const boss = i === ch.stages.length - 1;
      const r = boss ? NODE_R * 1.3 : NODE_R;
      const fill = !open ? 0x4a4560 : stars > 0 ? 0x2f9a4a : ELEMENT_COLOR[ch.element];

      const node = this.add.container(x, y);
      const circle = this.add.circle(0, 0, r, fill).setStrokeStyle(5, open ? 0xffffff : 0x8a84a0);
      const label =
        open && !boss
          ? this.add
              .text(0, -2, String(i + 1), { fontFamily: FONT, fontSize: `${Math.round(r * 0.9)}px`, color: '#ffffff' })
              .setOrigin(0.5)
              .setStroke('#000000', 6)
          : this.add.image(0, -2, open ? 'icon_skull' : 'icon_lock').setDisplaySize(r * 1.15, r * 1.15);
      node.add([circle, label]);

      for (let s = 0; s < 3; s++) {
        node.add(
          this.add
            .text((s - 1) * 30, r + 16, '★', { fontFamily: FONT, fontSize: '30px', color: s < stars ? '#ffe066' : '#3a3550' })
            .setOrigin(0.5)
            .setStroke('#000000', 5),
        );
      }
      node.add(
        this.add
          .text(0, r + 50, `${stage.id} ${stage.title}`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
          .setOrigin(0.5)
          .setStroke('#000000', 6),
      );
      this.layer.add(node);

      if (open && stars === 0) {
        const ring = this.add.circle(x, y, r + 8).setStrokeStyle(5, 0xffe066);
        this.layer.add(ring);
        this.tweens.add({ targets: ring, scale: 1.18, alpha: 0, duration: 900, repeat: -1 });
      }
      if (open) {
        circle.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.scene.start('Dialogue', { stageId: stage.id, phase: 'pre' });
        });
      }
    });

    this.drawRules(ch);
  }

  private drawRules(ch: ChapterDef): void {
    const y = 1076;
    const claimed = Save.get().story.chaptersClaimed.includes(ch.id);
    const reward = claimed
      ? `Камень Духа (${ELEMENT_NAME[ch.reward.spiritStone]}) получен ✔`
      : `За главу: Камень Духа (${ELEMENT_NAME[ch.reward.spiritStone]}) + ${ch.reward.gold} золота`;
    this.layer.add([
      this.add.rectangle(GAME_W / 2, y + 35, GAME_W - 24, 100, 0x000000, 0.6).setStrokeStyle(2, 0xffffff, 0.4),
      this.add
        .text(GAME_W / 2, y, `★ победа   ★ HP > ${Math.round(STAR_HP_RATIO * 100)}%   ★ лимит ходов этапа`, {
          fontFamily: FONT,
          fontSize: '22px',
          color: '#ffe066',
        })
        .setOrigin(0.5)
        .setStroke('#000000', 5),
      this.add
        .text(GAME_W / 2, y + 36, `Первое прохождение: ${STAGE_GOLD_FIRST} золота, повтор: ${STAGE_GOLD_REPEAT}`, {
          fontFamily: FONT,
          fontSize: '20px',
          color: '#ffffff',
        })
        .setOrigin(0.5),
      this.add
        .text(GAME_W / 2, y + 70, reward, { fontFamily: FONT, fontSize: '20px', color: claimed ? '#7dff8a' : '#d8d0ff' })
        .setOrigin(0.5),
    ]);
  }
}

/** Пунктир по плавной кривой через точки тропы; точки под кружками узлов не рисуем. */
function dottedTrail(g: Phaser.GameObjects.Graphics, points: { x: number; y: number }[], color: number, alpha: number): void {
  const curve = new Phaser.Curves.Spline(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
  const a = points[0];
  const b = points[points.length - 1];
  const dots = curve.getSpacedPoints(Math.max(2, Math.round(curve.getLength() / 30)));
  for (const p of dots) {
    if (Math.hypot(p.x - a.x, p.y - a.y) < NODE_R + 6 || Math.hypot(p.x - b.x, p.y - b.y) < NODE_R * 1.3 + 6) continue;
    g.fillStyle(0x000000, 0.55 * alpha).fillCircle(p.x + 2, p.y + 3, 8);
    g.fillStyle(color, alpha).fillCircle(p.x, p.y, 7);
  }
}
