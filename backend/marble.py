"""World Labs Marble API — Anbindung (async), gegen die offizielle Doku gebaut.

Quelle: docs.worldlabs.ai/api (Stand Juni 2026). Ablauf (alles server-seitig, Key bleibt geheim):
  1) media-assets:prepare_upload   -> media_asset_id + signierte upload_url
  2) PUT der Bild-Bytes an upload_url
  3) worlds:generate (JSON, image_prompt -> media_asset)  -> operation_id
  4) operations/{id} pollen bis done -> response.assets.splats.spz_urls.full_res
  5) .spz herunterladen

Auth: Header `WLT-Api-Key` (NICHT Bearer). Output: Gaussian Splat .spz.
Endpoints/Modell per ENV überschreibbar, falls die Doku sich verschiebt.
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

import httpx

BASE_URL = os.getenv("MARBLE_BASE_URL", "https://api.worldlabs.ai")
PREPARE_PATH = os.getenv("MARBLE_PREPARE_PATH", "/marble/v1/media-assets:prepare_upload")
GENERATE_PATH = os.getenv("MARBLE_GENERATE_PATH", "/marble/v1/worlds:generate")
OP_PATH = os.getenv("MARBLE_OP_PATH", "/marble/v1/operations/{id}")
MODEL = os.getenv("MARBLE_MODEL", "marble-1.1")
POLL_SECONDS = int(os.getenv("MARBLE_POLL_SECONDS", "5"))
TIMEOUT_SECONDS = int(os.getenv("MARBLE_TIMEOUT_SECONDS", "900"))

_EXT = {"image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "image/jpg": "jpg"}


@dataclass(frozen=True)
class WorldResult:
    data: bytes
    fmt: str  # "spz"


def _headers() -> dict[str, str]:
    return {"WLT-Api-Key": os.environ["MARBLE_API_KEY"], "Content-Type": "application/json"}


def _pick_spz(world: dict) -> str:
    """response.assets.splats.spz_urls.{full_res|500k|100k} mit Fallbacks."""
    assets = world.get("assets") or {}
    splats = assets.get("splats") or {}
    urls = splats.get("spz_urls") or {}
    for k in ("full_res", "500k", "100k"):
        if urls.get(k):
            return urls[k]
    # defensive Fallbacks, falls Feldnamen abweichen
    for k in ("spz_url", "splat_url", "url"):
        if splats.get(k):
            return splats[k]
    raise RuntimeError(f"Keine .spz-URL in Marble-Welt: assets={list(assets.keys())} splats={list(splats.keys())}")


async def generate_world(image: bytes, content_type: str, on_progress=None) -> WorldResult:
    ext = _EXT.get((content_type or "").lower(), "jpg")

    def prog(p: int, m: str) -> None:
        if on_progress:
            on_progress(p, m)

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        # 1) Upload vorbereiten
        prog(6, "Upload wird vorbereitet …")
        pr = await client.post(BASE_URL + PREPARE_PATH, headers=_headers(),
                               json={"file_name": f"room.{ext}", "kind": "image", "extension": ext})
        pr.raise_for_status()
        pj = pr.json()
        asset = pj.get("media_asset") or pj
        asset_id = asset.get("id") or pj.get("media_asset_id") or pj.get("id")
        upload_url = pj.get("upload_url") or asset.get("upload_url")
        if not asset_id or not upload_url:
            raise RuntimeError(f"prepare_upload unerwartet: {list(pj.keys())}")

        # 2) Bytes an die signierte URL (kein API-Key — Signatur steckt in der URL)
        prog(12, "Bild wird hochgeladen …")
        up = await client.put(upload_url, content=image,
                              headers={"Content-Type": content_type or "image/jpeg",
                                       "x-goog-content-length-range": "0,1048576000"})
        up.raise_for_status()

        # 3) Welt-Generierung starten
        prog(18, "Welt-Generierung gestartet …")
        body = {
            "display_name": "Interior Studio Raum",
            "model": MODEL,
            "world_prompt": {
                "type": "image",
                "image_prompt": {"source": "media_asset", "media_asset_id": asset_id},
                "is_pano": "auto",
            },
        }
        gr = await client.post(BASE_URL + GENERATE_PATH, headers=_headers(), json=body)
        gr.raise_for_status()
        gj = gr.json()
        op_id = gj.get("operation_id") or gj.get("id") or (gj.get("operation") or {}).get("id")
        if not op_id:
            raise RuntimeError(f"worlds:generate unerwartet: {gj}")

        # 4) Pollen bis fertig (~5 Min typisch)
        waited = 0
        while waited < TIMEOUT_SECONDS:
            s = await client.get(BASE_URL + OP_PATH.format(id=op_id), headers=_headers())
            s.raise_for_status()
            sj = s.json()
            prog(min(94, 20 + (waited * 72) // max(1, TIMEOUT_SECONDS)), "Marble erzeugt die Welt …")
            if sj.get("done") is True:
                if sj.get("error"):
                    raise RuntimeError(f"Marble-Fehler: {sj['error']}")
                world = sj.get("response") or sj.get("result") or {}
                url = _pick_spz(world)
                prog(96, "Splat wird geladen …")
                dl = await client.get(url, timeout=httpx.Timeout(300.0))
                dl.raise_for_status()
                return WorldResult(data=dl.content, fmt="spz")
            await asyncio.sleep(POLL_SECONDS)
            waited += POLL_SECONDS

        raise TimeoutError(f"Marble-Job-Timeout nach {TIMEOUT_SECONDS}s.")
