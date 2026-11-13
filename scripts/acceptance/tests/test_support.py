from __future__ import annotations

import json
import os
import socket
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
