@echo off
REM Interior Studio - lokaler Start (Windows). Doppelklick auf diese Datei.
cd /d "%~dp0"
start "" http://localhost:8765/index.html
python -m http.server 8765
