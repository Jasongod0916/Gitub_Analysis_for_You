from __future__ import annotations

import json
import mimetypes
import shutil
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "data" / "tools.db"
SYNC_CONFIG_PATH = ROOT_DIR / "db-sync.json"
HOST = "127.0.0.1"
PORT = 3000


def load_sync_source() -> Path | None:
    if not SYNC_CONFIG_PATH.exists():
        return None

    try:
        config = json.loads(SYNC_CONFIG_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    source_path = (config.get("source_db_path") or "").strip()
    if not source_path:
        return None

    return Path(source_path)


def sync_database_if_needed() -> None:
    source_path = load_sync_source()
    if source_path is None or not source_path.exists():
        return

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not DB_PATH.exists():
        shutil.copy2(source_path, DB_PATH)
        return

    source_stat = source_path.stat()
    target_stat = DB_PATH.stat()
    is_newer = source_stat.st_mtime > target_stat.st_mtime
    size_changed = source_stat.st_size != target_stat.st_size

    if is_newer or size_changed:
        shutil.copy2(source_path, DB_PATH)


def fetch_tools() -> list[dict]:
    sync_database_if_needed()
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()
    rows = cursor.execute(
        """
        SELECT
          t.id,
          t.github_id,
          t.name,
          t.full_name,
          t.owner,
          t.description,
          t.html_url,
          t.homepage,
          t.stars,
          t.forks,
          t.watchers,
          t.open_issues,
          t.language,
          t.license,
          t.archived,
          t.disabled,
          t.visibility,
          t.created_at,
          t.updated_at,
          t.pushed_at,
          t.default_branch,
          COALESCE(GROUP_CONCAT(tt.topic, '|'), '') AS topics
        FROM tools t
        LEFT JOIN tool_topics tt ON tt.tool_id = t.id
        GROUP BY t.id
        ORDER BY t.stars DESC, t.id DESC
        """
    ).fetchall()
    connection.close()

    tools = []
    for row in rows:
      tools.append(
          {
              "id": row["id"],
              "github_id": row["github_id"],
              "name": row["name"],
              "full_name": row["full_name"],
              "owner": row["owner"],
              "description": row["description"] or "",
              "html_url": row["html_url"] or "",
              "homepage": row["homepage"] or "",
              "stars": row["stars"] or 0,
              "forks": row["forks"] or 0,
              "watchers": row["watchers"] or 0,
              "open_issues": row["open_issues"] or 0,
              "language": row["language"] or "Unknown",
              "license": row["license"] or "No license",
              "archived": bool(row["archived"]),
              "disabled": bool(row["disabled"]),
              "visibility": row["visibility"] or "unknown",
              "created_at": row["created_at"] or "",
              "updated_at": row["updated_at"] or "",
              "pushed_at": row["pushed_at"] or "",
              "default_branch": row["default_branch"] or "",
              "topics": [topic for topic in (row["topics"] or "").split("|") if topic],
          }
      )
    return tools


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        if parsed_url.path == "/api/tools":
            self.handle_tools_api(parsed_url.query)
            return

        self.serve_static_file(parsed_url.path)

    def handle_tools_api(self, query_string: str) -> None:
        query = parse_qs(query_string).get("q", [""])[0].strip().lower()
        tools = fetch_tools()
        if query:
            tools = [
                tool
                for tool in tools
                if query in " ".join(
                    [
                        tool["name"],
                        tool["full_name"],
                        tool["owner"],
                        tool["description"],
                        tool["language"],
                        " ".join(tool["topics"]),
                    ]
                ).lower()
            ]

        body = json.dumps({"items": tools}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static_file(self, raw_path: str) -> None:
        relative_path = "index.html" if raw_path in {"/", ""} else raw_path.lstrip("/")
        target_path = (ROOT_DIR / relative_path).resolve()

        if ROOT_DIR not in target_path.parents and target_path != ROOT_DIR:
            self.send_error(403, "Forbidden")
            return

        if not target_path.exists() or not target_path.is_file():
            self.send_error(404, "File not found")
            return

        content_type, _ = mimetypes.guess_type(target_path.name)
        body = target_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Serving Gitub Analysis for You at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
