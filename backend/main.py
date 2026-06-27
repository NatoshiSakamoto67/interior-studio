"""Interior Studio — World-Backend (FastAPI).

Dünner Proxy: nimmt ein Raumbild (oder 360°-Panorama), startet via World Labs
Marble API eine begehbare 3D-Welt (Gaussian Splat), pollt den asynchronen Job
und liefert die fertige Splat-Datei ans Frontend. Der Marble-API-Key bleibt
server-seitig (ENV) — nie im Browser.

Lokal starten:
    cd backend
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env          # MARBLE_API_KEY eintragen
    uvicorn main:app --reload --port 8799
"""
from __future__ import annotations

import asyncio
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Load secrets BEFORE importing the marble client. backend/.env first, then ~/.env
# (the rest of the tool already keeps GEMINI_API_KEY there) as a fallback.
load_dotenv()
load_dotenv(Path.home() / ".env", override=False)

import marble  # noqa: E402  (must follow load_dotenv so the key is present)

app = FastAPI(title="Interior Studio — World Backend", version="0.1.0")

# Lokales Frontend (Dev-Server 8765 / Handover-Launcher 8771). In Produktion einschränken.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JobStatus = Literal["queued", "running", "done", "error"]


@dataclass
class Job:
    """Ein Generierungs-Job. In-Memory (Prototyp); für Produktion -> Redis/DB."""
    id: str
    status: JobStatus = "queued"
    progress: int = 0
    message: str = "In der Warteschlange …"
    splat: bytes | None = None
    splat_format: str = "ply"


JOBS: dict[str, Job] = {}


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "marbleConfigured": bool(os.getenv("MARBLE_API_KEY")),
        "version": app.version,
    }


@app.post("/api/world")
async def create_world(image: UploadFile = File(...)) -> dict:
    if not os.getenv("MARBLE_API_KEY"):
        raise HTTPException(503, "MARBLE_API_KEY nicht gesetzt — backend/.env konfigurieren.")
    data = await image.read()
    if not data:
        raise HTTPException(400, "Leeres Bild übermittelt.")
    job = Job(id=uuid.uuid4().hex[:12])
    JOBS[job.id] = job
    asyncio.create_task(_run(job, data, image.content_type or "image/jpeg"))
    return {"jobId": job.id}


@app.get("/api/world/{job_id}")
def world_status(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job unbekannt.")
    return {
        "jobId": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "splatReady": job.splat is not None,
        "format": job.splat_format,
    }


@app.get("/api/world/{job_id}/splat")
def world_splat(job_id: str) -> Response:
    job = JOBS.get(job_id)
    if not job or job.splat is None:
        raise HTTPException(404, "Splat noch nicht fertig.")
    return Response(
        content=job.splat,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="welt-{job_id}.{job.splat_format}"'},
    )


async def _run(job: Job, image: bytes, content_type: str) -> None:
    """Hintergrund-Task: Marble-Welt erzeugen, Fortschritt in den Job spiegeln."""
    try:
        job.status = "running"
        job.message = "Welt wird erzeugt …"

        def on_progress(pct: int, msg: str) -> None:
            job.progress = max(job.progress, min(99, pct))
            job.message = msg

        result = await marble.generate_world(image, content_type, on_progress=on_progress)
        job.splat = result.data
        job.splat_format = result.fmt
        job.progress = 100
        job.status = "done"
        job.message = "Welt fertig."
    except Exception as exc:  # noqa: BLE001 — Job-Grenze: jeden Fehler sichtbar an den Client geben
        job.status = "error"
        job.message = f"{type(exc).__name__}: {exc}"
