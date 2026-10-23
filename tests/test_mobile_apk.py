import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("mobile_apk", Path(__file__).resolve().parents[1] / "scripts/verify-mobile-apk.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ApkContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.apk = Path(self.tmp.name) / "test.apk"
        self.sha = "a" * 40
        self.files = {"capacitor.config.json": b'{"appId":"example.dev"}',
                      "package-lock.json": b'{}',
                      "supabase/backend-manifest.json": b'{"migrations":[]}',
                      "config/game-migration-scope.json": json.dumps({"nonMigration": list(range(10))}).encode()}
        backend = "https://qonqemhljgxlwpghkxhn.supabase.co"
        self.release = dict(commit=self.sha, release_mode="practice", legacy_operations_enabled=False,
                            backend_url=backend, reviewed_migration_count=0, held_game_count=10)
        self.mobile = dict(source_commit=self.sha, app_id="example.dev", release_scope="practice", backend_url=backend,
                           reviewed_migration_count=0, publish_approved=False, production_signing_configured=False,
                           native_email_callbacks_enabled=False, native_wallet_credit_redemption_enabled=False)
        for field, path in (("package_lock_sha256", "package-lock.json"), ("backend_manifest_sha256", "supabase/backend-manifest.json"), ("game_scope_sha256", "config/game-migration-scope.json")):
            self.mobile[field] = hashlib.sha256(self.files[path]).hexdigest()
        self.config = {"appId": "example.dev"}

    def write(self):
        with zipfile.ZipFile(self.apk, "w") as z:
            for path, value in (("assets/public/release.json", self.release), ("assets/public/mobile-release.json", self.mobile), ("assets/capacitor.config.json", self.config)):
                z.writestr(path, json.dumps(value))

    def check(self):
        self.write()
        return module.verify(self.apk, self.sha, self.files.__getitem__)

    def test_valid_contract_retains_readiness_limits(self):
        result = self.check()
        self.assertEqual(result["sha256"], hashlib.sha256(self.apk.read_bytes()).hexdigest())
        self.assertTrue(result["embedded_contract_verified"])
        for field in ("signature_verified", "android_manifest_verified", "signing_approved", "publication_approved"):
            self.assertFalse(result[field])

    def test_old_apk_after_new_sync_is_rejected(self):
        self.mobile["source_commit"] = "b" * 40
        with self.assertRaisesRegex(ValueError, "source mismatch"): self.check()

    def test_source_input_drift_is_rejected(self):
        self.files["package-lock.json"] = b'{"changed":true}'
        with self.assertRaisesRegex(ValueError, "checksum mismatch"): self.check()

    def test_missing_or_enabled_redemption_is_rejected(self):
        for value in (None, True):
            self.mobile["native_wallet_credit_redemption_enabled"] = value
            with self.assertRaisesRegex(ValueError, "gate"): self.check()

    def test_remote_wrapper_rejected(self):
        self.config["server"] = {"url": "https://example.invalid"}
        with self.assertRaisesRegex(ValueError, "Remote web wrapper"): self.check()

    def test_wrong_app_id_rejected(self):
        self.config["appId"] = "other.app"
        with self.assertRaisesRegex(ValueError, "App ID mismatch"): self.check()

    def test_wrong_backend_rejected(self):
        self.release["backend_url"] = "https://other.invalid"
        with self.assertRaisesRegex(ValueError, "Backend target"): self.check()

    def test_counts_rejected(self):
        self.release["reviewed_migration_count"] = 1
        with self.assertRaisesRegex(ValueError, "Migration count"): self.check()
        self.release["reviewed_migration_count"] = 0
        self.release["held_game_count"] = 0
        with self.assertRaisesRegex(ValueError, "Excluded-game"): self.check()

    def test_invalid_sha_rejected(self):
        self.write()
        with self.assertRaisesRegex(ValueError, "full source"): module.verify(self.apk, "HEAD", self.files.__getitem__)

    def test_duplicate_metadata_rejected(self):
        import warnings
        self.write()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(self.apk, "a") as z:
                z.writestr("assets/public/release.json", json.dumps(self.release))
        with self.assertRaisesRegex(ValueError, "Duplicate APK"):
            module.verify(self.apk, self.sha, self.files.__getitem__)

    def test_missing_metadata_rejected(self):
        with zipfile.ZipFile(self.apk, "w") as z:
            z.writestr("assets/public/index.html", "test")
        with self.assertRaises(KeyError): module.verify(self.apk, self.sha, self.files.__getitem__)


if __name__ == "__main__":
    unittest.main()
