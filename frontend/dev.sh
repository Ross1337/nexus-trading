#!/bin/bash
cd "$(dirname "$0")"
exec node node_modules/.bin/next dev --port "${PORT:-3000}"
