#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/backend"
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || npm install
npm start
