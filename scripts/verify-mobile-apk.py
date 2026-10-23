#!/usr/bin/env python3
"""Read-only APK provenance check. Never signs, extracts files, or reads keys."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path


def verify(apk, source, read_source):
    if not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Expected a full source commit SHA")
    def require(ok, message):
        if not ok:
            raise ValueError(message)
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "Duplicate APK entries")
        def document(path):
            info = archive.getinfo(path)
            require(info.file_size <= 1024 * 1024, "Oversized metadata")
            return json.loads(archive.read(info))
        release = document("assets/public/release.json")
        mobile = document("assets/public/mobile-release.json")
        config = document("assets/capacitor.config.json")
        require(release.get("commit") == source == mobile.get("source_commit"), "APK source mismatch")
        expected_config = json.loads(read_source("capacitor.config.json"))
        require(config.get("appId") == expected_config["appId"] == mobile.get("app_id"), "App ID mismatch")
        require(not config.get("server", {}).get("url"), "Remote web wrapper is not allowed")
        require(release.get("release_mode") == "practice" == mobile.get("release_scope"), "Practice scope mismatch")
        require(release.get("legacy_operations_enabled") is False, "Legacy operations must be disabled")
        for field in ("publish_approved", "production_signing_configured", "native_email_callbacks_enabled", "native_wallet_credit_redemption_enabled"):
            require(mobile.get(field) is False, "Unapproved or missing gate: " + field)
        backend = "https://qonqemhljgxlwpghkxhn.supabase.co"
        require(release.get("backend_url") == backend == mobile.get("backend_url"), "Backend target mismatch")
        for field, path in (("package_lock_sha256", "package-lock.json"), ("backend_manifest_sha256", "supabase/backend-manifest.json"), ("game_scope_sha256", "config/game-migration-scope.json")):
            require(mobile.get(field) == hashlib.sha256(read_source(path)).hexdigest(), "Source input checksum mismatch: " + path)
        manifest = json.loads(read_source("supabase/backend-manifest.json"))
        scope = json.loads(read_source("config/game-migration-scope.json"))
        require(release.get("reviewed_migration_count") == len(manifest["migrations"]) == mobile.get("reviewed_migration_count"), "Migration count mismatch")
        require(release.get("held_game_count") == len(scope["nonMigration"]) == 10, "Excluded-game scope mismatch")
    digest = hashlib.sha256()
    with open(apk, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"apk": str(Path(apk).resolve()), "bytes": Path(apk).stat().st_size,
            "sha256": digest.hexdigest(), "source_commit": source,
            "metadata_app_id": config["appId"], "embedded_contract_verified": True,
            "signature_verified": False, "android_manifest_verified": False,
            "signing_approved": False, "publication_approved": False,
            "limits": "Metadata and recorded source inputs only; not proof of compiled-code equivalence, signature, native acceptance or release readiness."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--source", required=True)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.source):
        parser.error("--source must be a full commit SHA")
    def read_source(path):
        return subprocess.check_output(["git", "-C", str(args.repo), "show", args.source + ":" + path])
    try:
        print(json.dumps(verify(args.apk, args.source, read_source), indent=2))
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        parser.exit(1, "APK verification failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
