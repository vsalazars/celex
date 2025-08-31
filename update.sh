#!/bin/bash
# Script para subir todos los cambios a GitHub automáticamente
# Uso: ./update.sh "mi mensaje personalizado"

# Si hay argumento, úsalo como mensaje; si no, usa fecha y hora
if [ -n "$1" ]; then
  MSG="$1"
else
  MSG="Auto-update: $(date '+%Y-%m-%d %H:%M:%S')"
fi

# Ir al directorio del repo (donde está este script)
cd "$(dirname "$0")" || exit 1

# Agregar todos los cambios
git add .

# Crear commit
git commit -m "$MSG"

# Subir al remoto
git push origin main
