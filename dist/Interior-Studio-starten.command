#!/bin/zsh
# Interior Studio — Start MIT dauerhaftem Speichern (kleiner lokaler Server, kein Internet nötig fürs Tool).
cd "$(dirname "$0")"
PORT=8771
echo "▶ Interior Studio startet auf http://localhost:$PORT …"
echo "  Dieses Fenster bitte offen lassen — Schließen beendet das Tool."
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
else
  echo "Kein python3 gefunden — öffne die Datei direkt (dann ohne dauerhaftes Speichern)."
  open "Interior-Studio.html"; exit 0
fi
SRV=$!
sleep 1
open -a Safari "http://localhost:$PORT/Interior-Studio.html" 2>/dev/null || open "http://localhost:$PORT/Interior-Studio.html"
trap "kill $SRV 2>/dev/null" EXIT
wait $SRV
