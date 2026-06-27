#!/usr/bin/env python3
"""Bündelt Interior Studio zu EINER selbsttragenden HTML-Datei.

Ziel: per Doppelklick (file://) lauffähig, über WhatsApp/USB verschickbar.
- CSS + alle JS inline
- referenzierte Demo-/Beispielbilder als komprimierte data:-URIs (kein Tainting,
  keine fehlenden Assets) — Panoramen 2048px/JPEG q82, Showcase 1000px/q80
- </script> in JS wird entschärft, damit nichts den Bundle vorzeitig schließt

Aufruf:  python3 tools/build-single.py
Ausgabe: dist/Interior-Studio.html
"""
import base64
import io
import re
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "dist"
OUT = OUT_DIR / "Interior-Studio.html"

# JS-Ladereihenfolge wie in index.html (wird aus den <script src> übernommen,
# diese Liste dient nur als Erwartungs-Check).
PANO_MAX_W, PANO_Q = 2048, 82
SHOW_MAX_W, SHOW_Q = 1000, 80


def harden_js(js: str) -> str:
    # Verhindert, dass ein literal </script> im JS den Bundle-Script-Tag schließt.
    return re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)


def inline_css(html: str) -> str:
    def repl(m):
        href = m.group(1)
        css = (ROOT / href).read_text(encoding="utf-8")
        css = css.replace("</style", "<\\/style")
        return f"<style>\n{css}\n</style>"
    return re.sub(r'<link[^>]+href="([^"]+\.css)"[^>]*/?>', repl, html)


BUILTIN_CATALOGS = ["wohnen-basis", "wand-oberflaeche", "aquaristik-basis"]


def builtins_global() -> str:
    """JS-Zuweisung der Builtin-Kataloge — ersetzt das fetch() unter file://."""
    import json
    data = {}
    for cid in BUILTIN_CATALOGS:
        p = ROOT / "examples" / "catalogs" / f"{cid}.json"
        if p.exists():
            data[cid] = json.loads(p.read_text(encoding="utf-8"))
    return "window.__IS_BUILTIN_CATALOGS__ = " + json.dumps(data, ensure_ascii=False) + ";\n"


def inline_js(html: str) -> str:
    def repl(m):
        src = m.group(1)
        js = (ROOT / src).read_text(encoding="utf-8")
        if src.endswith("catalogs.js"):
            js = builtins_global() + js   # Builtins inline, damit der Katalog-Picker auch in der Einzeldatei gefüllt ist
        return f"<script>\n{harden_js(js)}\n</script>"

    def repl_module(m):
        # ES-Modul (Welt 3D / Spark) inline halten — Imports sind absolute CDN-URLs + Importmap-bare-specifier.
        src = m.group(1)
        js = (ROOT / src).read_text(encoding="utf-8")
        return f'<script type="module">\n{harden_js(js)}\n</script>'

    html = re.sub(r'<script\s+type="module"\s+src="([^"]+)"></script>', repl_module, html)
    return re.sub(r'<script\s+src="([^"]+)"></script>', repl, html)


def inline_json_links(doc: str) -> str:
    paths = sorted(set(re.findall(r'examples/[A-Za-z0-9_./-]+\.json', doc)))
    for rel in paths:
        p = ROOT / rel
        if not p.exists():
            continue
        raw = p.read_bytes()
        uri = "data:application/json;base64," + base64.b64encode(raw).decode("ascii")
        doc = doc.replace(rel, uri)
        print(f"  inline {rel}: {len(raw)/1024:.1f} KB (JSON-Download)")
    return doc


def data_uri(path: Path):  # -> (data_uri: str, new_size: int, orig_size: int)
    is_pano = "tour" in path.parts
    max_w = PANO_MAX_W if is_pano else SHOW_MAX_W
    q = PANO_Q if is_pano else SHOW_Q
    img = Image.open(path)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    if img.width > max_w:
        h = round(img.height * max_w / img.width)
        img = img.resize((max_w, h), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=q, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}", len(buf.getvalue()), path.stat().st_size


def inline_assets(doc: str) -> str:
    paths = sorted(set(re.findall(r'examples/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp)', doc)))
    saved_total = orig_total = 0
    for rel in paths:
        p = ROOT / rel
        if not p.exists():
            print(f"  ! fehlt: {rel} (übersprungen)")
            continue
        uri, new_sz, orig_sz = data_uri(p)
        # Ersetze den Pfad als String-Literal (in HTML-attr und JS-String)
        doc = doc.replace(rel, uri)
        orig_total += orig_sz
        saved_total += new_sz
        print(f"  inline {rel}: {orig_sz/1024:.0f} KB -> {new_sz/1024:.0f} KB")
    print(f"  Assets gesamt: {orig_total/1024/1024:.1f} MB -> {saved_total/1024/1024:.2f} MB")
    return doc


LAUNCHER = "Interior-Studio-starten.command"
READMETXT = "LIESMICH-UEBERGABE.txt"


def emit_handover_package() -> None:
    """Übergabe-Paket neben der Einzeldatei: Launcher (localhost = dauerhaftes Speichern) + LIESMICH."""
    launcher = (
        "#!/bin/zsh\n"
        "# Interior Studio — Start MIT dauerhaftem Speichern (kleiner lokaler Server, kein Internet nötig fürs Tool).\n"
        'cd "$(dirname "$0")"\n'
        "PORT=8771\n"
        'echo "▶ Interior Studio startet auf http://localhost:$PORT …"\n'
        'echo "  Dieses Fenster bitte offen lassen — Schließen beendet das Tool."\n'
        "if command -v python3 >/dev/null 2>&1; then\n"
        "  python3 -m http.server $PORT >/dev/null 2>&1 &\n"
        "else\n"
        '  echo "Kein python3 gefunden — öffne die Datei direkt (dann ohne dauerhaftes Speichern)."\n'
        f'  open "{OUT.name}"; exit 0\n'
        "fi\n"
        "SRV=$!\n"
        "sleep 1\n"
        f'open -a Safari "http://localhost:$PORT/{OUT.name}" 2>/dev/null || open "http://localhost:$PORT/{OUT.name}"\n'
        'trap "kill $SRV 2>/dev/null" EXIT\n'
        "wait $SRV\n"
    )
    p = OUT_DIR / LAUNCHER
    p.write_text(launcher, encoding="utf-8")
    p.chmod(0o755)

    readme = f"""Interior Studio — so startest du das Tool
==========================================

Zwei Wege, beide funktionieren ohne Internet:

1) SCHNELL ANSCHAUEN  (ohne Speichern)
   Doppelklick auf:  {OUT.name}
   Öffnet sich im Browser, läuft sofort, die Demo-Begehung braucht
   keinen Schlüssel. ABER: so werden Projekte nur für die laufende
   Sitzung gehalten — beim Schließen sind sie weg (Browser-Grenze bei
   direkt geöffneten Dateien). Projekte über „Exportieren“ als
   .studio.json sichern.

2) RICHTIG ARBEITEN  (mit dauerhaftem Speichern)  ← empfohlen
   Doppelklick auf:  {LAUNCHER}
   Startet einen kleinen lokalen Server und öffnet das Tool in Safari.
   So bleiben Projekte dauerhaft gespeichert und der „Architekt“
   (Grundriss lesen) funktioniert zuverlässig.

   Beim ALLERERSTEN Mal warnt macOS evtl. („nicht geprüfter Entwickler“).
   Dann: Rechtsklick auf die Datei → „Öffnen“ → „Öffnen“. Nur einmal nötig.
   Das Terminal-Fenster offen lassen — Schließen beendet das Tool.

Eigene KI-Schlüssel (für eigene Bilder & Grundrisse):
   Oben rechts auf „Key“. Zwei Schlüssel, beide bleiben nur lokal:
   • Gemini  (Bilder & Panoramen)   — aistudio.google.com/apikey
   • Claude  (Architekt/Grundriss)  — console.anthropic.com
   Die Demo-Begehung läuft komplett ohne Schlüssel.

Vision & alle Unterlagen findest du im Tool selbst im Reiter „Unterlagen“.
"""
    (OUT_DIR / READMETXT).write_text(readme, encoding="utf-8")
    print(f"  ✓ Übergabe-Paket: {LAUNCHER} (ausführbar) · {READMETXT}")


def main() -> int:
    OUT_DIR.mkdir(exist_ok=True)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = inline_css(html)
    html = inline_js(html)
    html = inline_assets(html)
    html = inline_json_links(html)

    banner = (
        f"<!-- Interior Studio — Einzeldatei-Build, generiert {date.today().isoformat()} "
        f"von tools/build-single.py. Selbsttragend: per Doppelklick (file://) lauffähig, "
        f"über WhatsApp/USB verschickbar. Quelle: github-Repo. -->\n"
    )
    html = banner + html

    # Sanity: echte lokale Datei-Referenzen (keine data:/http/Anker, keine JS-Platzhalter/Enums)
    leftover = re.findall(r'(?:\bsrc|\bhref)="(?!data:|https?:|#|mailto:)([^"]+)"', html)
    leftover = [l for l in leftover if ("/" in l or "." in l) and "${" not in l and not l.startswith("data:")]

    OUT.write_text(html, encoding="utf-8")
    size = OUT.stat().st_size
    print(f"\n✓ {OUT}  ({size/1024/1024:.2f} MB)")
    if leftover:
        print(f"  ⚠ verbleibende lokale Referenzen ({len(leftover)}): {sorted(set(leftover))[:8]}")
    else:
        print("  ✓ keine lokalen Datei-Referenzen mehr — voll selbsttragend")
    emit_handover_package()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
