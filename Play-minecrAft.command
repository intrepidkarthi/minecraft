#!/bin/bash
# Double-click this file to play minecrAft — Adyah's Adventure (macOS).
cd "$(dirname "$0")"

echo "=============================================="
echo "   minecrAft — Adyah's Adventure"
echo "=============================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "⚠️  Node.js is required to run the game."
  echo "    Install it (LTS) from https://nodejs.org and double-click this again."
  echo
  read -p "Press Return to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing the game engine."
  echo "(This downloads Electron — it can take a few minutes the first time only.)"
  echo
  npm install || { echo; echo "❌ Install failed. Check your internet and try again."; read -p "Press Return to close..."; exit 1; }
  echo
fi

echo "🚀 Launching the game for Adyah..."
npm start
