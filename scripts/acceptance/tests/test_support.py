from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import support


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._respond()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        self.server.last_body = self.rfile.read(length).decode("utf-8")  # type: ignore[attr-defined]
        self._respond()

    def _respond(self) -> None:
        if self.path == "/ok":
            self._send(200, {"status": "ok"})
        elif self.path == "/created":
            self._send(201, {"id": "created"})
        elif self.path == "/conflict":
            self._send(409, {"error": {"code": "conflict"}})
        elif self.path == "/unavailable":
            self._send(503, {"error": {"code": "unavailable"}})
        elif self.path == "/wrong":
            self._send(500, {"error": {"code": "boom"}})
        elif self.path == "/text":
            self._send_raw(200, b"plain text", "text/plain")
        elif self.path == "/echo":
            body = getattr(self.server, "last_body", "")
            self._send(200, {"method": self.command, "body": body})
        else:
            self._send(404, {"error": {"code": "not_found"}})

    def _send(self, status: int, payload: object) -> None:
        self._send_raw(status, json.dumps(payload).encode("utf-8"), "application/json")

    def _send_raw(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: object) -> None:
        return


class SupportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def _client(self) -> tuple[support.Client, support.Reporter]:
        reporter = support.Reporter()
        return support.Client(self.base_url, reporter), reporter

    def test_allocate_port_can_be_rebound(self) -> None:
        port = support.allocate_port()
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", port))

    def test_build_env_overrides_database_paths_without_mutating_parent(self) -> None:
        parent = {
            "ELDER_DATABASE_PATH": "real-elder.db",
            "SOS_DATABASE_PATH": "real-sos.db",
            "COMMUNITY_DATABASE_PATH": "real-community.db",
            "PATH": "keep",
        }
        databases = {
            "ELDER_DATABASE_PATH": Path("tmp/elder.db"),
            "SOS_DATABASE_PATH": Path("tmp/sos.db"),
            "COMMUNITY_DATABASE_PATH": Path("tmp/community.db"),
        }
        env = support.build_env(
            parent, Path("backend/src"), Path("shared/src"), databases
        )
        self.assertEqual(env["ELDER_DATABASE_PATH"], str(Path("tmp/elder.db")))
        self.assertEqual(env["SOS_DATABASE_PATH"], str(Path("tmp/sos.db")))
        self.assertEqual(env["COMMUNITY_DATABASE_PATH"], str(Path("tmp/community.db")))
        self.assertEqual(env["PATH"], "keep")
        self.assertEqual(parent["ELDER_DATABASE_PATH"], "real-elder.db")

    def test_build_env_places_backend_and_shared_on_pythonpath(self) -> None:
        env = support.build_env(
            {"PATH": "keep"},
            Path("backend/src"),
            Path("shared/src"),
            {"ELDER_DATABASE_PATH": Path("tmp/elder.db")},
        )
        parts = env["PYTHONPATH"].split(os.pathsep)
        self.assertEqual(parts[0], str(Path("backend/src")))
        self.assertIn(str(Path("shared/src")), parts)

    def test_build_env_drops_unrequested_database_paths(self) -> None:
        env = support.build_env(
            {"PATH": "keep", "OTHER_DATABASE_PATH": "real-other.db"},
            Path("backend/src"),
            Path("shared/src"),
            {"ELDER_DATABASE_PATH": Path("tmp/elder.db")},
        )
        self.assertNotIn("OTHER_DATABASE_PATH", env)
        self.assertEqual(env["ELDER_DATABASE_PATH"], str(Path("tmp/elder.db")))
        self.assertEqual(env["PATH"], "keep")

    def test_snapshot_repo_databases_ignores_vendor_directories(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            for relative in (
                "code1-elder/backend/data/a.db",
                "code1-elder/backend/node_modules/x.db",
                "code1-elder/backend/.git/y.db",
                "code2-guardian/backend/b.db",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"x")
            found = support.snapshot_repo_databases(root)
            self.assertEqual(
                found,
                {
                    Path("code1-elder/backend/data/a.db"),
                    Path("code2-guardian/backend/b.db"),
                },
            )

    def test_request_json_returns_body_and_counts_check(self) -> None:
        client, reporter = self._client()
        payload = client.request_json(
            "GET", "/ok", 200, step="S99", description="ok"
        )
        self.assertEqual(payload, {"status": "ok"})
        self.assertEqual(reporter.checks, 1)

    def test_request_json_sends_json_post_body(self) -> None:
        client, _ = self._client()
        payload = client.request_json(
            "POST",
            "/echo",
            200,
            step="S98",
            description="echo",
            json={"a": 1},
        )
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(json.loads(payload["body"]), {"a": 1})

    def test_request_json_accepts_409_and_503(self) -> None:
        client, reporter = self._client()
        conflict = client.request_json(
            "GET", "/conflict", 409, step="S97", description="conflict"
        )
        unavailable = client.request_json(
            "GET", "/unavailable", 503, step="S96", description="unavailable"
        )
        self.assertEqual(conflict["error"]["code"], "conflict")
        self.assertEqual(unavailable["error"]["code"], "unavailable")
        self.assertEqual(reporter.checks, 2)

    def test_request_json_reports_status_mismatch(self) -> None:
        client, reporter = self._client()
        with self.assertRaises(support.StepFailure) as raised:
            client.request_json("GET", "/wrong", 200, step="S95", description="wrong")
        message = str(raised.exception)
        self.assertIn("[S95]", message)
        self.assertIn("GET", message)
        self.assertIn("expected 200, got 500", message)
        self.assertIn("boom", message)
        self.assertEqual(reporter.checks, 0)

    def test_request_json_reports_non_json_body(self) -> None:
        client, _ = self._client()
        with self.assertRaises(support.StepFailure) as raised:
            client.request_json("GET", "/text", 200, step="S94", description="text")
        self.assertIn("response is not JSON", str(raised.exception))

    def test_request_json_wraps_validate_failure_in_step_failure(self) -> None:
        client, reporter = self._client()

        def validate(payload: object) -> None:
            raise AssertionError("status must be healthy")

        with self.assertRaises(support.StepFailure) as raised:
            client.request_json(
                "GET",
                "/ok",
                200,
                step="S93",
                description="validated",
                validate=validate,
            )
        message = str(raised.exception)
        self.assertIn("[S93]", message)
        self.assertIn("GET", message)
        self.assertIn(f"{self.base_url}/ok", message)
        self.assertIn("expected 200", message)
        self.assertIn("validation failed", message)
        self.assertIn("status must be healthy", message)
        self.assertEqual(reporter.checks, 0)

    def test_request_json_reports_connection_failure(self) -> None:
        port = support.allocate_port()
        client = support.Client(f"http://127.0.0.1:{port}", support.Reporter())
        with self.assertRaises(support.StepFailure) as raised:
            client.request_json("GET", "/health", 200, step="S92", description="conn")
        message = str(raised.exception)
        self.assertIn("[S92]", message)
        self.assertIn(f"http://127.0.0.1:{port}/health", message)
        self.assertIn("connection failed", message)

    def test_wait_for_health_detects_early_exit(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            log_path = Path(raw) / "elder-0.log"
            log_path.write_text(
                "Traceback: ModuleNotFoundError: no module named demo", encoding="utf-8"
            )
            process = subprocess.Popen([sys.executable, "-c", "raise SystemExit(1)"])
            try:
                process.wait(timeout=30)
                service = support.RunningService(
                    "elder", process, support.allocate_port(), log_path
                )
                with self.assertRaises(support.StepFailure) as raised:
                    support.wait_for_health(service, timeout=0.5)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=5)
        message = str(raised.exception)
        self.assertIn("[STARTUP]", message)
        self.assertIn("exited before health check", message)
        self.assertIn("ModuleNotFoundError: no module named demo", message)

    def test_stop_service_terminates_process_and_is_idempotent(self) -> None:
        process = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(30)"]
        )
        log_path = Path(tempfile.gettempdir()) / "silver-acceptance-stop-test.log"
        service = support.RunningService(
            "stop-test", process, support.allocate_port(), log_path
        )
        try:
            support.stop_service(service, timeout=10.0)
            self.assertIsNotNone(process.poll())
            support.stop_service(service)
            self.assertIsNotNone(process.poll())
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)

    def test_log_tail_returns_tail_and_tolerates_missing_file(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "service.log"
            path.write_text("a" * 100 + "TAIL", encoding="utf-8")
            tail = support.log_tail(path, limit=10)
            self.assertEqual(tail, "a" * 6 + "TAIL")
            self.assertLessEqual(len(tail), 10)
            self.assertEqual(support.log_tail(Path(raw) / "missing.log"), "")

    def test_create_temp_workspace_returns_prefixed_directory(self) -> None:
        workspace = support.create_temp_workspace()
        try:
            self.assertTrue(workspace.is_dir())
            self.assertTrue(workspace.name.startswith("silver-acceptance-"))
        finally:
            shutil.rmtree(workspace, ignore_errors=True)
        self.assertFalse(workspace.exists())

    def test_step_failure_message_contains_context(self) -> None:
        failure = support.StepFailure(
            "S04e",
            "POST",
            "http://127.0.0.1/courses/x/publication",
            409,
            200,
            '{"error":{"code":"illegal_course_publication"}}',
        )
        message = str(failure)
        self.assertIn("[S04e]", message)
        self.assertIn("POST", message)
        self.assertIn("http://127.0.0.1/courses/x/publication", message)
        self.assertIn("expected 409, got 200", message)
        self.assertIn("illegal_course_publication", message)


if __name__ == "__main__":
    unittest.main()
