"""World Labs Marble API — dünne Anbindung (async).

Start -> Poll -> Download-Muster für eine asynchrone Welt-Generierung.

⚠ Die mit TODO[SPEC] markierten Konstanten/Feldnamen werden aus der offiziellen
Marble-Doku (docs.worldlabs.ai) bestätigt/korrigiert. Struktur (Job starten,
pollen, Splat herunterladen) ist stabil; nur Pfade/Feldnamen können abweichen.
Per ENV überschreibbar, damit man ohne Code-Änderung an die echte Spec anpassen kann.
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

import httpx

# TODO[SPEC]: aus offizieller Marble-Doku bestätigen (per ENV überschreibbar)
BASE_URL = os.getenv("MARBLE_BASE_URL", "https://api.worldlabs.ai")
CREATE_PATH = os.getenv("MARBLE_CREATE_PATH", "/v1/worlds")
STATUS_PATH = os.getenv("MARBLE_STATUS_PATH", "/v1/worlds/{id}")
POLL_SECONDS = int(os.getenv("MARBLE_POLL_SECONDS", "4"))
TIMEOUT_SECONDS = int(os.getenv("MARBLE_TIMEOUT_SECONDS", "900"))

_DONE = {"succeeded", "completed", "done", "ready"}
_FAILED = {"failed", "error", "canceled", "cancelled"}


@dataclass(frozen=True)
class WorldResult:
    data: bytes
    fmt: str  # "ply" | "splat" | "ksplat" | "spz" | "glb"


def _headers() -> dict[str, str]:
    key = os.environ["MARBLE_API_KEY"]
    return {"Authorization": f"Bearer {key}"}


def _fmt_from_url(url: str) -> str:
    ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
    return ext if ext in {"ply", "splat", "ksplat", "spz", "glb"} else "ply"


def _pick_splat_url(payload: dict) -> str:
    """Splat-Download-URL aus der Status-Antwort fischen (TODO[SPEC]: exaktes Feld)."""
    for key in ("splat_url", "gaussian_splat_url", "ply_url", "download_url", "output_url"):
        if payload.get(key):
            return payload[key]
    outputs = payload.get("outputs") or payload.get("assets") or {}
    if isinstance(outputs, dict):
        for key in ("spz", "ply", "splat", "ksplat", "glb"):
            if outputs.get(key):
                return outputs[key]
    if isinstance(outputs, list) and outputs:
        first = outputs[0]
        if isinstance(first, dict):
            return first.get("url") or first.get("href") or ""
        if isinstance(first, str):
            return first
    raise RuntimeError(f"Keine Splat-URL in Marble-Antwort gefunden: {list(payload.keys())}")


async def generate_world(image: bytes, content_type: str, on_progress=None) -> WorldResult:
    """Bild -> Marble-Welt -> Gaussian-Splat-Bytes. Wirft bei Fehler/Timeout."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=httpx.Timeout(60.0)) as client:
        if on_progress:
            on_progress(5, "Welt-Auftrag wird an Marble gesendet …")

        # 1) Job starten — TODO[SPEC]: multipart vs. JSON+base64 aus Doku bestätigen
        files = {"image": ("room.jpg", image, content_type)}
        resp = await client.post(CREATE_PATH, headers=_headers(), files=files)
        resp.raise_for_status()
        created = resp.json()
        world_id = created.get("id") or created.get("world_id") or created.get("job_id")
        if not world_id:
            raise RuntimeError(f"Keine World-ID in Marble-Antwort: {created}")

        # 2) Pollen bis fertig
        waited = 0
        while waited < TIMEOUT_SECONDS:
            status_resp = await client.get(STATUS_PATH.format(id=world_id), headers=_headers())
            status_resp.raise_for_status()
            payload = status_resp.json()
            state = str(payload.get("status") or payload.get("state") or "").lower()
            pct = int(payload.get("progress", 50) or 50)
            if on_progress:
                on_progress(min(95, max(10, pct)), f"Marble: {state or 'in Arbeit'} …")

            if state in _DONE:
                if on_progress:
                    on_progress(96, "Splat wird geladen …")
                url = _pick_splat_url(payload)
                dl = await client.get(url, headers=_headers(), timeout=httpx.Timeout(180.0))
                dl.raise_for_status()
                return WorldResult(data=dl.content, fmt=_fmt_from_url(url))
            if state in _FAILED:
                raise RuntimeError(f"Marble-Job fehlgeschlagen: {payload}")

            await asyncio.sleep(POLL_SECONDS)
            waited += POLL_SECONDS

        raise TimeoutError(f"Marble-Job-Timeout nach {TIMEOUT_SECONDS}s.")
