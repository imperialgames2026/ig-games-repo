#!/usr/bin/env python3
"""Restore original Base44 frontend into an isolated workspace without overwriting Supabase app."""
from pathlib import Path
from zipfile import ZipFile
import argparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--archive", type=Path, default=ROOT / "ig-games.zip")
parser.add_argument("--destination", type=Path, default=ROOT / "legacy-frontend")
args = parser.parse_args()
archive = args.archive.resolve()
destination = args.destination.resolve()
if not archive.is_file():
    parser.error(f"Archive not found: {archive}")
if destination == ROOT or ROOT not in destination.parents:
    parser.error("Destination must be a subdirectory of this repository")
if destination.exists() and any(destination.iterdir()):
    parser.error("Destination is not empty; refusing to overwrite files")
destination.mkdir(parents=True, exist_ok=True)
with ZipFile(archive) as z:
    for info in z.infolist():
        if info.is_dir():
            continue
        target = (destination / info.filename).resolve()
        if destination not in target.parents:
            parser.error(f"Unsafe archive entry: {info.filename}")
        if info.filename.startswith("/") or "\\" in info.filename:
            parser.error(f"Unsafe archive entry: {info.filename}")
        target.parent.mkdir(parents=True, exist_ok=True)
        with z.open(info) as source, target.open("wb") as out:
            import shutil
            shutil.copyfileobj(source, out)
print(f"Restored original frontend to {destination}")
print("Dependencies remain in legacy-frontend/package.json and package-lock.json.")
print("Use 'cd legacy-frontend && npm ci' to install separately.")
