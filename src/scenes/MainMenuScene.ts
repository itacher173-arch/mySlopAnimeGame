import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { DEFAULT_TEAM_NAME, Save } from '../core/SaveManager';
import { CARDS } from '../data/cards';
import { button, cardView, currencyLabel, menuBackground } from '../ui/widgets';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const save = Save.get();
    menuBackground(this);
    currencyLabel(this, GAME_W - 20, 20);
    const reset = button(this, 100, 44, 170, 52, 'Новая игра', () => this.confirmNewGame(), 0x3a3157);
    (reset.list[1] as Phaser.GameObjects.Text).setFontSize(20);

    this.add
      .text(GAME_W / 2, 110, 'SPIRIT STONES', { fontFamily: FONT, fontSize: '64px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#5a2a00', 12);
    this.add
      .text(GAME_W / 2, 175, 'ANIME', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 8);

    const teamName = this.add
      .text(GAME_W / 2, 250, save.teamName, { fontFamily: FONT, fontSize: '48px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#000000', 8)
      .setInteractive({ useHandCursor: true });
    teamName.on('pointerup', () => this.renameTeam(teamName));
    this.add
      .text(GAME_W / 2, 300, 'Нажми, чтобы сменить название', { fontFamily: FONT, fontSize: '20px', color: '#c9b8ff' })
      .setOrigin(0.5);

    if (save.team.length > 0) {
      const w = 124;
      const gap = 12;
      const startX = GAME_W / 2 - ((save.team.length - 1) * (w + gap)) / 2;
      save.team.forEach((id, i) => {
        cardView(this, startX + i * (w + gap), 680, w, 200, CARDS[id], save.cards[id].level, save.cards[id].awakening);
      });
    }

    button(this, GAME_W / 2 - 115, 1000, 430, 110, 'Сюжет', () => this.scene.start('StoryMap'), 0xd8323c);
    button(this, GAME_W / 2 + 232, 1000, 216, 110, 'Призыв', () => this.scene.start('Summon'), 0xc28a12);
    const quick = button(this, GAME_W / 2 - 232, 1140, 216, 90, 'Быстрый бой', () => this.scene.start('Battle', {}), 0x8a2b52);
    (quick.list[1] as Phaser.GameObjects.Text).setFontSize(25);
    button(this, GAME_W / 2, 1140, 216, 90, 'Команда', () => this.scene.start('Team'));
    button(this, GAME_W / 2 + 232, 1140, 216, 90, 'Прокачка', () => this.scene.start('Upgrade')    );
  }

  /** Поле ввода поверх холста: Phaser не даёт нормальную русскую клавиатуру. */
  private renameTeam(label: Phaser.GameObjects.Text): void {
    const old = document.getElementById('team-name-input');
    old?.remove();
    const canvas = this.game.canvas.getBoundingClientRect();
    const scale = canvas.width / GAME_W;
    const input = document.createElement('input');
    input.id = 'team-name-input';
    input.value = Save.get().teamName;
    input.maxLength = 16;
    input.enterKeyHint = 'done';
    input.style.position = 'fixed';
    input.style.left = `${canvas.left + (GAME_W / 2 - 180) * scale}px`;
    input.style.top = `${canvas.top + 226 * scale}px`;
    input.style.width = `${360 * scale}px`;
    input.style.height = `${52 * scale}px`;
    input.style.font = `700 ${Math.round(32 * scale)}px Arial, sans-serif`;
    input.style.textAlign = 'center';
    input.style.color = '#ffe066';
    input.style.background = '#1a1428';
    input.style.border = '3px solid #ffe066';
    input.style.borderRadius = '12px';
    input.style.zIndex = '20';
    input.style.outline = 'none';
    input.style.userSelect = 'text';
    input.style.touchAction = 'auto';
    document.body.appendChild(input);
    input.focus();
    input.select();

    let closed = false;
    const close = (save: boolean) => {
      if (closed) return;
      closed = true;
      if (save) {
        const name = input.value.trim().slice(0, 16) || DEFAULT_TEAM_NAME;
        Save.get().teamName = name;
        Save.write();
        label.setText(name);
      }
      input.remove();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') close(true);
      if (event.key === 'Escape') close(false);
    });
    input.addEventListener('blur', () => close(true));
    this.events.once('shutdown', () => input.remove());
  }

  private confirmNewGame(): void {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const close = () => parts.forEach((p) => p.destroy());
    parts.push(
      this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.8).setDepth(100).setInteractive(),
      this.add
        .text(cx, cy - 150, 'Начать заново?', { fontFamily: FONT, fontSize: '56px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#000000', 9)
        .setDepth(101),
      this.add
        .text(cx, cy - 70, 'Герои, золото, кристаллы и сюжет будут удалены.\nЭто нельзя отменить.', {
          fontFamily: FONT,
          fontSize: '22px',
          color: '#ff9a9a',
          align: 'center',
        })
        .setOrigin(0.5)
        .setStroke('#000000', 5)
        .setDepth(101),
      button(this, cx, cy + 60, 360, 96, 'Да, начать', () => {
        Save.reset();
        this.scene.start('Dialogue', { script: 'prologue' });
      }, 0xd8323c).setDepth(101),
      button(this, cx, cy + 180, 360, 90, 'Отмена', close).setDepth(101),
    );
  }
}
