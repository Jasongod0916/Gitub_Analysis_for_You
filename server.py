from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "3000"))


def resolve_database_path() -> Path:
    db_files = sorted(DATA_DIR.glob("*.db"))
    if not db_files:
        raise FileNotFoundError(f"No .db file found in {DATA_DIR}")
    return db_files[0]


def fetch_tools() -> list[dict]:
    connection = sqlite3.connect(resolve_database_path())
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


def fetch_rankings() -> dict:
    connection = sqlite3.connect(resolve_database_path())
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    owner_rows = cursor.execute(
        """
        SELECT
          owner,
          COUNT(*) AS repo_count,
          COALESCE(SUM(stars), 0) AS stars,
          COALESCE(SUM(forks), 0) AS forks,
          COALESCE(SUM(watchers), 0) AS watchers,
          MAX(updated_at) AS latest_update,
          GROUP_CONCAT(name, '|') AS projects
        FROM tools
        WHERE owner IS NOT NULL AND TRIM(owner) != ''
        GROUP BY owner
        ORDER BY repo_count DESC, stars DESC, owner COLLATE NOCASE ASC
        LIMIT 20
        """
    ).fetchall()

    language_rows = cursor.execute(
        """
        SELECT
          COALESCE(NULLIF(TRIM(language), ''), 'Unknown') AS language,
          COUNT(*) AS repo_count,
          COALESCE(SUM(stars), 0) AS stars
        FROM tools
        GROUP BY COALESCE(NULLIF(TRIM(language), ''), 'Unknown')
        ORDER BY repo_count DESC, stars DESC, language COLLATE NOCASE ASC
        """
    ).fetchall()

    total_tools = cursor.execute("SELECT COUNT(*) FROM tools").fetchone()[0]
    connection.close()

    authors = []
    for index, row in enumerate(owner_rows, start=1):
        authors.append(
            {
                "rank": index,
                "owner": row["owner"],
                "repo_count": row["repo_count"] or 0,
                "stars": row["stars"] or 0,
                "forks": row["forks"] or 0,
                "watchers": row["watchers"] or 0,
                "latest_update": row["latest_update"] or "",
                "projects": [name for name in (row["projects"] or "").split("|") if name][:5],
            }
        )

    languages = [
        {
            "language": row["language"],
            "repo_count": row["repo_count"] or 0,
            "stars": row["stars"] or 0,
        }
        for row in language_rows
    ]

    return {
        "authors": authors,
        "languages": languages,
        "summary": {
            "total_tools": total_tools,
            "author_count": len(authors),
            "language_count": len(languages),
        },
    }


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        if parsed_url.path == "/api/tools":
            self.handle_tools_api(parsed_url.query)
            return
        if parsed_url.path == "/api/rankings":
            self.handle_rankings_api()
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

    def handle_rankings_api(self) -> None:
        body = json.dumps(fetch_rankings(), ensure_ascii=False).encode("utf-8")
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
    display_host = "127.0.0.1" if HOST == "0.0.0.0" else HOST
    print(f"Serving Gitub Analysis for You at http://{display_host}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
