#!/bin/bash
# Interior Studio — lokaler Start (garantiert, auch wenn der Browser file:// einschränkt).
# Doppelklick auf diese Datei (macOS). Startet einen kleinen lokalen Server und öffnet die App.
cd "$(dirname "$0")"
PORT=8765
echo "▶ Interior Studio startet auf http://localhost:$PORT …"
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer $PORT >/dev/null 2>&1 &
else
  echo "Kein Python gefunden — öffne stattdessen index.html direkt."; open "index.html"; exit 0
fi
SRV=$!
sleep 1
open "http://localhost:$PORT/index.html"
echo "✓ Läuft. Dieses Fenster bitte offen lassen. Schließen/Strg+C beendet die App."
trap "kill $SRV 2>/dev/null" EXIT
wait $SRV
