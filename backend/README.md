# Interior Studio — World-Backend

Dünner FastAPI-Proxy für die **World-Labs-Marble-API**: Raumbild rein → begehbare
3D-Welt (Gaussian Splat) raus. Der Marble-Key bleibt **server-seitig** (`.env`),
nie im Browser. Das Frontend (offline-Tool) lädt den fertigen Splat in den
begehbaren Viewer.

## Start

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # MARBLE_API_KEY eintragen (worldlabs.ai, Pro-Tier für kommerzielle Nutzung)
uvicorn main:app --reload --port 8799
```

Oder per Doppelklick: `run.command` (richtet beim ersten Mal alles ein).

## Endpoints

| Methode | Pfad | Zweck |
|---------|------|-------|
| `GET`  | `/api/health` | Status + ob ein Marble-Key konfiguriert ist |
| `POST` | `/api/world` | Bild (multipart `image`) → startet Welt-Job, liefert `{jobId}` |
| `GET`  | `/api/world/{id}` | Job-Status + Fortschritt |
| `GET`  | `/api/world/{id}/splat` | fertige Gaussian-Splat-Datei |

## Marble-Spec

Die exakten Marble-Endpoints/Formate stehen in `marble.py` (mit `TODO[SPEC]`
markiert) und sind per ENV überschreibbar. Sie werden gegen die offizielle Doku
(`docs.worldlabs.ai`) bestätigt — Struktur (start → poll → download) ist stabil.

## Datenschutz (DSGVO)

Raumfotos können personenbezogen sein. Marble ist ein **US-Anbieter** →
Drittland-Transfer (SCCs/TIA nötig). Für eine EU-konforme Variante:
HunyuanWorld self-hosted auf EU-GPU statt Marble (gleiche Backend-Schnittstelle).
Siehe Unterlagen-Reiter → „World Models & begehbares 3D".
