#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
node server.js &
cd "$ROOT/frontend"
npm run dev
