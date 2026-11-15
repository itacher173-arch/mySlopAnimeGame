import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { MAXED_DUPLICATE_GOLD } from '../core/collection';
import { MAX_AWAKENING } from '../core/progression';
import { Save } from '../core/SaveManager';
import { SUMMON_COST, canPull, pull, pullsUntilPity, rarityRates, summonPool, type Payment, type PullResult } from '../core/summon';
import { ELEMENT_COLOR } from '../data/elements';
import { button, cardView, currencyLabel, menuBackground, setButtonEnabled, title } from '../ui/widgets';

const PORTAL = { x: GAME_W / 2, y: 330 };
const RARITY_COLOR: Record<number, number> = { 3: 0x4aa8ff, 4: 0xb05cff, 5: 0xffd23a };

export class SummonScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  private revealing = false;

  constructor() {
    super('Summon');
  }

  create(): void {
    this.revealing = false;
    menuBackground(this);
    title(this, 'Призыв');
    button(this, 80, 60, 120, 64, 'Назад', () => this.scene.start('MainMenu'));
    this.drawPortal();
    this.content = this.add.container(0, 0);
    this.render();
  }

  private drawPortal(): void {
    this.add.circle(PORTAL.x, PORTAL.y, 170, 0x6b3fd1, 0.18);
    [150, 118, 86].forEach((r, i) => {
      const g = this.add.graphics({ x: PORTAL.x, y: PORTAL.y });
      g.lineStyle(5 - i, [0xffe066, 0xb05cff, 0x8fd3ff][i], 0.9);
      for (let a = 0; a < 360; a += 30) g.beginPath().arc(0, 0, r, Phaser.Math.DegToRad(a), Phaser.Math.DegToRad(a + 18)).strokePath();
      this.tweens.add({ targets: g, angle: i % 2 ? -360 : 360, duration: 9000 - i * 2000, repeat: -1 });
    });
    const core = this.add.circle(PORTAL.x, PORTAL.y, 46, 0xffffff, 0.85);
    this.tweens.add({ targets: core, scale: 1.25, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
    this.add.particles(PORTAL.x, PORTAL.y, 'spark', {
      lifespan: 1200,
      frequency: 60,
      speed: { min: 20, max: 70 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffe066, 0xb05cff, 0x8fd3ff],
      blendMode: 'ADD',
    });
  }

  private render(): void {
    this.content.removeAll(true);
    const save = Save.get();
    this.content.add(currencyLabel(this, GAME_W - 20, 110));

    const pay = (p: Payment) => () => this.summon(p);
    const byCrystals = button(this, 200, 590, 330, 96, `Призыв · ${SUMMON_COST} 💎`, pay('crystals'), 0xd8323c);
    const byTicket = button(this, 545, 590, 270, 96, `Билет 🎟 ×${save.tickets}`, pay('ticket'), 0x2f9e4f);
    setButtonEnabled(byCrystals, canPull('crystals'));
    setButtonEnabled(byTicket, canPull('ticket'));
    this.content.add([byCrystals, byTicket]);

    const pity = pullsUntilPity();
    const pityText =
      pity === null ? 'Все герои призыва уже открыты — повторы дают пробуждение' : `Новый герой гарантирован не позже чем через ${pity} призыв(а)`;
    this.content.add(this.text(GAME_W / 2, 668, pityText, 20, '#c9b8ff'));

    const pool = summonPool();
    const rates = rarityRates(pool)
      .map((r) => `★${r.rarity} — ${Math.round(r.chance * 100)}%`)
      .join('   ');
    this.content.add([
      this.text(GAME_W / 2, 730, 'Кого можно призвать', 28, '#ffe066'),
      this.text(GAME_W / 2, 772, `Шансы: ${rates}`, 22, '#ffffff'),
    ]);

    const w = 124;
    const startX = GAME_W / 2 - ((pool.length - 1) * (w + 12)) / 2;
    pool.forEach((def, i) => {
      const x = startX + i * (w + 12);
      const owned = save.cards[def.id];
      const view = cardView(this, x, 900, w, 165, def, owned?.level, owned?.awakening ?? 0);
      this.content.add(view);
      const label = !owned ? 'NEW' : owned.awakening >= MAX_AWAKENING ? 'макс.' : `+${owned.awakening}/${MAX_AWAKENING}`;
      this.content.add(this.text(x, 1000, label, 20, owned ? '#ffffff' : '#ffb0f0'));
    });

    this.content.add(
      this.text(
        GAME_W / 2,
        1110,
        `Повтор героя — пробуждение +1★ (+10% атаки и HP), до ${MAX_AWAKENING} раз.\nПотом повтор превращается в ${MAXED_DUPLICATE_GOLD} золота.\nСюжетные герои и духи из призыва не выпадают.`,
        19,
        '#a99cc8',
      ),
    );
    this.content.add(this.text(GAME_W / 2, 1210, 'Кристаллы — за этапы сюжета и 3 звезды. Билеты — за 1-1 и 1-5.', 18, '#a99cc8'));
  }

  private text(x: number, y: number, t: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
      .setOrigin(0.5)
      .setStroke('#000000', 5);
  }

  private summon(pay: Payment): void {
    if (this.revealing) return;
    const result = pull(pay);
    if (!result) return;
    this.revealing = true;
    void this.reveal(result);
  }

  /** Сфера цвета редкости вылетает из портала, пульсирует, вспышка — и карта переворачивается. */
  private async reveal(r: PullResult): Promise<void> {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 - 80;
    const color = RARITY_COLOR[r.def.rarity] ?? 0xffffff;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (layer.push(o), o);

    const shade = add(this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0).setDepth(100).setInteractive());
    await this.tween({ targets: shade, fillAlpha: 0.85, duration: 250 });

    const orb = add(this.add.circle(PORTAL.x, PORTAL.y, 40, color).setDepth(101));
    const halo = add(this.add.circle(PORTAL.x, PORTAL.y, 70, color, 0.35).setDepth(101));
    const sparks = add(
      this.add
        .particles(0, 0, 'spark', {
          follow: orb,
          lifespan: 600,
          frequency: 20,
          speed: { min: 40, max: 160 },
          scale: { start: 1, end: 0 },
          tint: [color, 0xffffff],
          blendMode: 'ADD',
        })
        .setDepth(102),
    );
    await this.tween({ targets: [orb, halo], x: cx, y: cy, duration: 500, ease: 'Quad.easeInOut' });
    for (let i = 0; i < r.def.rarity - 1; i++) {
      await this.tween({ targets: [orb, halo], scale: 1.5 + i * 0.35, duration: 220, yoyo: true, ease: 'Sine.easeInOut' });
    }
    this.cameras.main.flash(250, 255, 255, 255);
    orb.destroy();
    halo.destroy();
    (sparks as Phaser.GameObjects.Particles.ParticleEmitter).stop();
    const burst = add(
      this.add
        .particles(cx, cy, 'spark', {
          lifespan: 900,
          speed: { min: 150, max: 420 },
          scale: { start: 1.4, end: 0 },
          tint: [color, ELEMENT_COLOR[r.def.element], 0xffffff],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(102),
    );
    (burst as Phaser.GameObjects.Particles.ParticleEmitter).explode(40);

    const owned = Save.get().cards[r.def.id];
    const glow = add(this.add.circle(cx, cy, 240, ELEMENT_COLOR[r.def.element], 0.3).setDepth(101));
    this.tweens.add({ targets: glow, scale: 1.12, alpha: 0.12, duration: 900, yoyo: true, repeat: -1 });
    const card = add(cardView(this, cx, cy, 300, 400, r.def, owned.level, owned.awakening).setDepth(103));
    card.scaleX = 0;
    await this.tween({ targets: card, scaleX: 1, duration: 320, ease: 'Back.easeOut' });

    const headline =
      r.acquire.kind === 'new'
        ? { t: 'NEW!', c: '#ffb0f0' }
        : r.acquire.kind === 'awaken'
          ? { t: `Пробуждение +1★ (${r.acquire.awakening}/${MAX_AWAKENING})`, c: '#ffe066' }
          : { t: `+${r.acquire.gold} золота`, c: '#ffe066' };
    const head = add(this.text(cx, cy - 250, headline.t, r.acquire.kind === 'new' ? 72 : 38, headline.c).setDepth(103).setScale(0));
    this.tweens.add({ targets: head, scale: 1, duration: 300, ease: 'Back.easeOut' });

    const inTeam = Save.get().team.includes(r.def.id);
    const sub =
      r.acquire.kind === 'new'
        ? inTeam
          ? `${r.def.name} занимает место духа в команде!`
          : `${r.def.name} добавлен в коллекцию`
        : r.acquire.kind === 'awaken'
          ? `${r.def.name}: +10% к атаке и HP`
          : `${r.def.name}: все пробуждения уже получены`;
    add(this.text(cx, cy + 250, sub, 26, '#ffffff').setDepth(103));
    if (r.pity) add(this.text(cx, cy + 290, 'Сработала гарантия нового героя', 20, '#c9b8ff').setDepth(103));
    add(this.text(cx, cy + 350, 'Нажми, чтобы продолжить', 22, '#a99cc8').setDepth(103));

    await this.wait(300);
    shade.once('pointerup', () => {
      layer.forEach((o) => o.destroy());
      this.revealing = false;
      this.render();
    });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
