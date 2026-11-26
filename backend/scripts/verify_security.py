"""
Run this script while FastAPI is running on http://localhost:8000 to verify RBAC & security:
    python scripts/verify_security.py
"""
import json
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def req(method: str, path: str, token: str | None = None, body: dict | None = None) -> tuple[int, dict | str]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="ignore")
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, raw


def main():
    checks = []

    def assert_status(name: str, actual: int, expected: int):
        ok = actual == expected
        checks.append((ok, name, actual, expected))
        tag = "PASS" if ok else "FAIL"
        print(f"[{tag}] {name} (got {actual}, expected {expected})")

    # 1. Health check
    code, _ = req("GET", "/api/health")
    assert_status("Health endpoint accessible", code, 200)

    # 2. Unauthenticated blocked
    code, _ = req("GET", "/api/dashboard/admin")
    assert_status("Unauthenticated blocked on /api/dashboard/admin", code, 403)

    # 3. Admin login
    code, admin_data = req("POST", "/api/auth/login", body={"username": "admin", "password": "Admin@123"})
    assert_status("Admin login", code, 200)
    admin_token = admin_data.get("access_token") if isinstance(admin_data, dict) else None

    # 4. Worker login
    code, worker_data = req("POST", "/api/auth/login", body={"username": "hasan", "password": "Hasan@123"})
    assert_status("Worker login (hasan)", code, 200)
    worker_token = worker_data.get("access_token") if isinstance(worker_data, dict) else None

    if worker_token:
        # 5. Worker allowed own profile & own export
        code, _ = req("GET", "/api/workers/me/profile", token=worker_token)
        assert_status("Worker can access own profile", code, 200)

        code, _ = req("GET", "/api/exports/me?period=30d&format=csv", token=worker_token)
        assert_status("Worker can export own records", code, 200)

        # 6. Worker strictly blocked from admin endpoints & other workers
        for path in [
            "/api/dashboard/admin",
            "/api/workers",
            "/api/vendors",
            "/api/pricing/types",
            "/api/production",
            "/api/exports/all?period=30d&format=csv",
            "/api/workers/999999/profile",
            "/api/exports/worker/999999?period=30d&format=csv",
        ]:
            code, _ = req("GET", path, token=worker_token)
            assert_status(f"Worker blocked from {path}", code, 403)

    if admin_token:
        code, _ = req("GET", "/api/dashboard/admin", token=admin_token)
        assert_status("Admin can access dashboard", code, 200)

    failed = [c for c in checks if not c[0]]
    print(f"\nSummary: {len(checks) - len(failed)}/{len(checks)} checks passed.")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
