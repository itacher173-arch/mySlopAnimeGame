#!/bin/sh
# Баланс главы 1 для трёх стартеров: стартер + духи, с 1-2 — герой из билета, с 1-3 — Аква (если вода свободна).
# Запуск: sh scripts/balance.sh [--max=4]
cd "$(dirname "$0")/.."
run() { node scripts/playtest.mjs "$@" | sed "s/^/$NAME /"; }
NAME=naruto
run 1-1 --team=naruto,spirit_water,spirit_earth,spirit_light,spirit_dark "$@" &
run 1-2 --team=naruto,spirit_water,zoro,spirit_light,spirit_dark "$@" &
run 1-3 1-4 1-5 --team=naruto,aqua,zoro,spirit_light,spirit_dark "$@" &
NAME=rem
run 1-1 --team=rem,spirit_fire,spirit_earth,spirit_light,spirit_dark "$@" &
run 1-2 1-3 1-4 1-5 --team=rem,naruto,spirit_earth,spirit_light,spirit_dark "$@" &
NAME=zoro
run 1-1 --team=zoro,spirit_fire,spirit_water,spirit_light,spirit_dark "$@" &
run 1-2 --team=zoro,naruto,spirit_water,spirit_light,spirit_dark "$@" &
run 1-3 1-4 1-5 --team=zoro,naruto,aqua,spirit_light,spirit_dark "$@" &
wait
