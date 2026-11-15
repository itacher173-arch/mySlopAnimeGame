import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { CARDS } from '../data/cards';
import { ELEMENT_COLOR } from '../data/elements';
import { ENEMIES } from '../data/enemies';
import { Save } from '../core/SaveManager';
import { EXTRA_SPEAKERS, SCRIPTS, STAGES, type DialogueLine } from '../data/story';
import { coverImage } from '../ui/images';
import { button, hex, menuBackground } from '../ui/widgets';

/** Реплики этапа (до/после боя) или отдельный сценарий из SCRIPTS (пролог). */
export interface DialogueData {
  stageId?: string;
  phase?: 'pre' | 'post';
  script?: string;
}

const BOX_Y = 900;
const BOX_H = 340;
const PORTRAIT = 150;
const CHAR_MS = 28;

export class DialogueScene extends Phaser.Scene {
  private title = '';
  private background = '';
  private next: { scene: string; data?: object } = { scene: 'MainMenu' };
  private lines: DialogueLine[] = [];
  private index = 0;

  private portrait!: Phaser.GameObjects.Container;
  private figure: Phaser.GameObjects.Image | null = null;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private done = false;

  constructor() {
    super('Dialogue');
  }

  init(data: DialogueData): void {
    const script = data.script ? SCRIPTS[data.script] : undefined;
    let lines: DialogueLine[];
    if (script) {
      this.title = script.title;
      this.background = script.background;
      this.next = { scene: script.next };
      lines = script.lines;
    } else {
      const stage = STAGES[data.stageId ?? '1-1'] ?? STAGES['1-1'];
      const pre = (data.phase ?? 'pre') === 'pre';
      this.title = `${stage.id}  ${stage.title}`;
      this.background = stage.background;
      this.next = pre ? { scene: 'Battle', data: { stageId: stage.id } } : { scene: 'StoryMap', data: { chapterId: stage.chapter } };
      lines = pre ? stage.pre : stage.post;
    }
    // «starter» — выбранный игроком герой (в старых сохранениях — лидер команды).
    const save = Save.get();
    const starter = save.starter ?? save.team.find((id) => !CARDS[id]?.kind) ?? 'naruto';
    this.lines = lines
      .filter((l) => !l.requires || save.cards[l.requires])
      .map((l) => (l.speaker === 'starter' ? { ...l, speaker: starter } : l));
    this.index = 0;
    this.figure = null;
    this.typing = null;
    this.done = false;
  }

  create(): void {
    const bgKey = `bg_${this.background}`;
    if (this.textures.exists(bgKey)) coverImage(this, bgKey, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);
    else menuBackground(this);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.45).setOrigin(0);

    this.add
      .text(GAME_W / 2, 70, this.title, { fontFamily: FONT, fontSize: '34px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#000000', 8);

    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x0d0b1a, 0.92).fillRoundedRect(16, BOX_Y, GAME_W - 32, BOX_H, 18);
    g.lineStyle(4, 0xffffff, 0.8).strokeRoundedRect(16, BOX_Y, GAME_W - 32, BOX_H, 18);

    this.portrait = this.add.container(36 + PORTRAIT / 2, BOX_Y + 30 + PORTRAIT / 2).setDepth(6);
    this.nameText = this.add
      .text(36, BOX_Y - 18, '', { fontFamily: FONT, fontSize: '30px', color: '#ffe066' })
      .setOrigin(0, 1)
      .setStroke('#000000', 7)
      .setDepth(6);
    this.bodyText = this.add
      .text(36 + PORTRAIT + 22, BOX_Y + 28, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        wordWrap: { width: GAME_W - 32 - PORTRAIT - 62, useAdvancedWrap: true },
        lineSpacing: 6,
      })
      .setDepth(6);
    this.hint = this.add
      .text(GAME_W - 40, BOX_Y + BOX_H - 22, '▼', { fontFamily: FONT, fontSize: '26px', color: '#ffe066' })
      .setOrigin(1, 1)
      .setDepth(6);
    this.tweens.add({ targets: this.hint, y: this.hint.y + 8, duration: 450, yoyo: true, repeat: -1 });

    const skip = button(this, GAME_W - 120, 150, 200, 64, 'Пропустить', () => this.finish(), 0x3a3157).setDepth(10);
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.includes(skip)) return;
      this.advance();
    });

    if (this.lines.length === 0) this.finish();
    else this.showLine();
  }

  private advance(): void {
    if (this.done) return;
    if (this.typing) {
      this.typing.remove();
      this.typing = null;
      this.bodyText.setText(this.fullText);
      this.hint.setVisible(true);
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) this.finish();
    else this.showLine();
  }

  private showLine(): void {
    const line = this.lines[this.index];
    const prev = this.lines[this.index - 1];
    const info = speakerInfo(line.speaker);

    this.nameText.setText(info.name).setColor(info.color);
    if (!prev || prev.speaker !== line.speaker) {
      this.drawPortrait(line.speaker, info);
      this.drawFigure(line.speaker, info);
    }

    this.fullText = line.text;
    this.bodyText.setText('').setColor(line.speaker === 'narrator' ? '#d8d0ff' : '#ffffff');
    this.hint.setVisible(false);
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: CHAR_MS,
      repeat: this.fullText.length - 1,
      callback: () => {
        shown++;
        this.bodyText.setText(this.fullText.slice(0, shown));
        if (shown >= this.fullText.length) {
          this.typing = null;
          this.hint.setVisible(true);
        }
      },
    });
  }

  private drawPortrait(id: string, info: SpeakerInfo): void {
    this.portrait.removeAll(true);
    const key = portraitKey(this, id);
    if (key) {
      // Портреты карт — по центру, полноростовые спрайты — верхняя часть (лицо).
      const img = coverImage(this, key, 0, 0, PORTRAIT, PORTRAIT, key.startsWith('unit_') ? 0.05 : 0.3);
      this.portrait.add(img);
    } else {
      this.portrait.add([
        this.add.rectangle(0, 0, PORTRAIT, PORTRAIT, info.frame, 0.5),
        this.add
          .text(0, 0, id === 'narrator' ? '…' : info.name[0], { fontFamily: FONT, fontSize: '72px', color: '#ffffff' })
          .setOrigin(0.5)
          .setStroke('#000000', 8),
      ]);
    }
    this.portrait.add(this.add.rectangle(0, 0, PORTRAIT, PORTRAIT).setStrokeStyle(5, info.frame));
  }

  /** Крупная фигура говорящего над окном: герои слева, враги справа. */
  private drawFigure(id: string, info: SpeakerInfo): void {
    const old = this.figure;
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 150, onComplete: () => old.destroy() });
    this.figure = null;
    const key = `unit_${id}`;
    if (!this.textures.exists(key)) return;

    const left = !info.enemy;
    const x = left ? 210 : GAME_W - 210;
    const img = this.add.image(x + (left ? -40 : 40), BOX_Y + 30, key).setOrigin(0.5, 1).setAlpha(0).setDepth(2);
    img.setScale(Math.min(460 / img.height, 380 / img.width));
    const card = CARDS[id];
    const enemy = ENEMIES[id];
    // Герои смотрят вправо (к центру), враги — влево.
    img.setFlipX(card ? !!card.spriteFacesLeft : !!enemy?.spriteFacesRight);
    this.tweens.add({ targets: img, x, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
    this.figure = img;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.typing?.remove();
    this.scene.start(this.next.scene, this.next.data);
  }
}

interface SpeakerInfo {
  name: string;
  color: string;
  frame: number;
  enemy: boolean;
}

function speakerInfo(id: string): SpeakerInfo {
  const card = CARDS[id];
  if (card) return { name: card.name, color: '#ffe066', frame: ELEMENT_COLOR[card.element], enemy: false };
  const enemy = ENEMIES[id];
  if (enemy) return { name: enemy.name, color: '#ff8080', frame: ELEMENT_COLOR[enemy.element], enemy: true };
  return { name: EXTRA_SPEAKERS[id] ?? id, color: hex(0xb8a8ff), frame: 0x8a7bd8, enemy: false };
}

function portraitKey(scene: Phaser.Scene, id: string): string | null {
  for (const key of [`card_${id}`, `enemy_${id}`, `unit_${id}`]) if (scene.textures.exists(key)) return key;
  return null;
}
