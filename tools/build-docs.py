#!/usr/bin/env python3
"""Bäckt die Markdown-Quellen aus docs/ (+ README.md) in docs-data.js.

Warum: Unter file:// scheitert fetch('docs/*.md'). Deshalb ist die einzige
Wahrheitsquelle zur Laufzeit ein JS-Objekt (window.DOCS), das hier aus den
.md-Dateien generiert wird. Die .md-Dateien bleiben die Quelle — docs-data.js
NIE von Hand editieren.

Aufruf:  python3 tools/build-docs.py
Ausgabe: docs-data.js  (wird von index.html geladen und vom Single-File-Build inline gebündelt)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Reihenfolge + Kuratierung des Unterlagen-Reiters. Icons müssen in icons.js existieren.
MANIFEST = [
    # (Pfad,                       id,            Titel,                         Kategorie,                  icon,          Kurztext)
    ("docs/VISION.md",             "vision",      "Vision & Idee",               "Einstieg",                 "sparkles",    "Die Idee in Kürze"),
    ("README.md",                  "readme",      "Schnellstart",                "Einstieg",                 "play",        "Starten & einrichten"),
    ("docs/BERUF-UND-ROADMAP.md",  "beruf",       "Der Beruf & die Roadmap",     "Für Designer",             "compass",     "Beruf, Phasen, Datenmodell, Roadmap"),
    ("docs/SELBST-WEITERBAUEN.md", "weiterbauen", "Selbst weiterentwickeln",     "Selbst weiterbauen",       "building-2",  "Anpassen & erweitern"),
    ("docs/PLATTFORM-SPEC.md",     "plattform",   "Plattform-Spezifikation",     "Technische Spezifikation", "package",     "Technischer Gesamt-Bauplan"),
    ("docs/STUFE-2-SPEC.md",       "stufe2",      "Umsetzungs-Spec (Stufe 2)",   "Technische Spezifikation", "square-pen",  "Phasierter Umsetzungsplan"),
    ("docs/RESEARCH-WORLD-MODELS.md", "research-worldmodels", "World Models & begehbares 3D", "Research & Zukunft", "brain", "Raum-aus-Foto, Marble, HunyuanWorld, DSGVO"),
]


def build():
    docs = []
    for rel, doc_id, title, category, icon, blurb in MANIFEST:
        path = ROOT / rel
        if not path.exists():
            print(f"  ⚠ übersprungen (fehlt): {rel}", file=sys.stderr)
            continue
        md = path.read_text(encoding="utf-8")
        docs.append({
            "id": doc_id,
            "title": title,
            "category": category,
            "icon": icon,
            "blurb": blurb,
            "file": Path(rel).name,
            "md": md,
        })
        print(f"  + {rel}  ({len(md)/1024:.1f} KB)")

    payload = json.dumps(docs, ensure_ascii=False, indent=0)
    out = (
        "/* AUTO-GENERIERT von tools/build-docs.py — NICHT von Hand editieren.\n"
        "   Quelle: docs/*.md + README.md. Neu bauen: python3 tools/build-docs.py */\n"
        "window.DOCS = " + payload + ";\n"
    )
    target = ROOT / "docs-data.js"
    target.write_text(out, encoding="utf-8")
    total = sum(len(d["md"]) for d in docs)
    print(f"\n✓ {target}  ({len(docs)} Dokumente, {total/1024:.1f} KB Inhalt)")


if __name__ == "__main__":
    build()
