#!/bin/zsh
# Interior Studio — World-Backend starten (Marble-Proxy).
# Erstes Mal: macOS-Gatekeeper -> Rechtsklick > Öffnen.
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "▶ Erstes Setup: virtuelle Umgebung + Abhängigkeiten …"
  python3 -m venv .venv
  ./.venv/bin/pip install -q --upgrade pip
  ./.venv/bin/pip install -q -r requirements.txt
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠ backend/.env wurde angelegt — trage deinen MARBLE_API_KEY ein und starte erneut."
  open -e .env 2>/dev/null
  exit 0
fi

echo "▶ World-Backend läuft auf http://localhost:8799  (dieses Fenster offen lassen)"
exec ./.venv/bin/uvicorn main:app --port 8799
