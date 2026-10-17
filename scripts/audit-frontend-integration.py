#!/usr/bin/env python3
"""Audit restored original frontend against active app, without network or secrets."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "legacy-frontend" / "src"
ACTIVE = ROOT
EXTENSIONS = {".jsx", ".js", ".ts", ".tsx"}

def source_files(base):
    return {str(p.relative_to(base)): p for p in base.rglob("*") if p.is_file() and p.suffix in EXTENSIONS}

def audit():
    original = source_files(SOURCE)
    missing = sorted(p for p in original if not (ACTIVE / p).is_file())
    modified = sorted(p for p, f in original.items() if (ACTIVE / p).is_file() and f.read_bytes() != (ACTIVE / p).read_bytes())
    pages = sorted(p.stem for p in (ACTIVE / "pages").glob("*.jsx"))
    calls = []
    imports = []
    for rel, path in source_files(ACTIVE).items():
        if rel.startswith(("legacy-frontend/", "node_modules/", "dist/")):
            continue
        text = path.read_text(errors="replace")
        for match in re.finditer(r"base44\.functions\.invoke\(\s*['\x22\x60]([^'\x22\x60]+)", text):
            calls.append({"file": rel, "function": match.group(1)})
        for match in re.finditer(r"base44\.entities\.([A-Za-z_][A-Za-z_0-9]*)", text):
            imports.append({"file": rel, "entity": match.group(1)})
    return {
        "original_source_files": len(original),
        "missing_active_source_files": missing,
        "modified_original_source_files": modified,
        "active_page_count": len(pages),
        "active_pages": pages,
        "legacy_function_calls": sorted(calls, key=lambda x: (x["function"], x["file"])),
        "legacy_entity_calls": sorted(imports, key=lambda x: (x["entity"], x["file"])),
    }

if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))
