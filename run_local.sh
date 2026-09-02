#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm run dev -- --port 4999
