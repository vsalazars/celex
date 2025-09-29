#!/usr/bin/env bash
set -euo pipefail
OUT="repo_report.txt"
echo "# Repo report $(date)" > "$OUT"

{
echo "## Git"
git remote -v || true
git status -sb || true
echo

echo "## Top-level"
ls -la || true
echo

echo "## Tree (2 niveles, filtrado)"
find . -maxdepth 2 -type d \
  ! -path "*/.git*" ! -path "*/node_modules*" ! -path "*/.next*" \
  ! -path "*/dist*" ! -path "*/build*" ! -path "*/.venv*" -print
echo

echo "## Archivos clave"
find . -maxdepth 2 -type f \( -name "package.json" -o -name "next.config.*" -o -name "render.yaml" -o -name "requirements*.txt" -o -name "pyproject.toml" -o -name "alembic.ini" -o -name "Dockerfile" \) -print
echo

echo "## Detección FastAPI/Next"
grep -R --line-number "FastAPI(" -n . || true
grep -R --line-number "uvicorn" -n . || true
[ -f package.json ] && grep -n "\"next\":\\|next\\s" package.json || true
echo

echo "## package.json (resumen)"
node -e 'try{const p=require("./package.json"); console.log(JSON.stringify({name:p.name, scripts:p.scripts, deps:Object.keys(p.dependencies||{}).slice(0,30)}, null, 2));}catch(e){console.log("sin package.json")}' || true
echo

echo "## Python deps"
[ -f requirements.txt ] && (echo "==> requirements.txt"; head -n 200 requirements.txt) || true
[ -f pyproject.toml ] && (echo "==> pyproject.toml"; head -n 200 pyproject.toml) || true
echo

echo "## Migraciones y Alembic"
[ -f alembic.ini ] && (echo "alembic.ini encontrado"; head -n 80 alembic.ini) || true
find . -maxdepth 3 -type d -name "migrations" -print
} >> "$OUT"

echo "Generado: $OUT"
