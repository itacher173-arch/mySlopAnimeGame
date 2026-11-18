# Spirit Stones Anime

Браузерная игра на [Phaser 3](https://phaser.io/), TypeScript и [Vite](https://vite.dev/).

## Что нужно

- [Node.js](https://nodejs.org/) **20.19+** или **22.12+** (так требует Vite 8)
- npm (идёт вместе с Node.js)

## Установка и запуск

```bash
npm install
npm run dev
```

Dev-сервер откроется на [http://localhost:5173](http://localhost:5173) и будет доступен в локальной сети (`--host`).

## Сборка

```bash
npm run build
npm run preview
```

`build` проверяет типы и кладёт статику в `dist/`. `preview` поднимает локальный сервер с этой сборкой.

Проверка типов без сборки: `npm run typecheck`.

## Спрайты

`npm run sprites` обрабатывает JPG из `art/units/` и пишет PNG в `public/assets/units/`. Для обычного запуска игры это не нужно.
