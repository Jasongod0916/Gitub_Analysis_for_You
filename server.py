from __future__ import annotations

import gzip

import json
import mimetypes
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "3000"))
SITE_URL = "https://gitub-analysis-for-you.onrender.com"
UTF8_TEXT_TYPES = {
    "text/html",
    "text/plain",
    "text/css",
    "application/javascript",
    "text/javascript",
    "application/json",
    "application/xml",
    "text/xml",
    "image/svg+xml",
}
LONG_CACHE_EXTENSIONS = {
    ".css",
    ".js",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
}
HTML_ROUTE_ALIASES = {
    "/about": "/about.html",
    "/rankings": "/rankings.html",
    "/collection-map": "/collection-map.html",
    "/network-graph": "/network-graph.html",
    "/scatterplot": "/scatterplot.html",
}
LANGUAGE_PREFIXES = {"zh-Hant", "en", "ja"}


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
        if self.redirect_html_alias(parsed_url):
            return
        if parsed_url.path == "/api/tools":
            self.handle_tools_api(parsed_url.query)
            return
        if parsed_url.path == "/api/rankings":
            self.handle_rankings_api()
            return

        self.serve_static_file(parsed_url.path)

    def do_HEAD(self) -> None:
        parsed_url = urlparse(self.path)
        if self.redirect_html_alias(parsed_url):
            return
        if parsed_url.path in {"/api/tools", "/api/rankings"}:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            return

        self.serve_static_file(parsed_url.path, send_body=False)

    def redirect_html_alias(self, parsed_url) -> bool:
        normalized_path, language = self.strip_language_prefix(parsed_url.path)
        redirect_target = HTML_ROUTE_ALIASES.get(normalized_path)
        if not redirect_target:
            return False

        if language:
            redirect_target = f"/{language}{redirect_target}"

        if parsed_url.query:
            redirect_target = f"{redirect_target}?{parsed_url.query}"

        self.send_response(301)
        self.send_header("Location", redirect_target)
        self.end_headers()
        return True

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

        # body = json.dumps({"items": tools}, ensure_ascii=False).encode("utf-8")
        # self.send_response(200)
        # self.send_header("Content-Type", "application/json; charset=utf-8")
        # self.send_header("Content-Length", str(len(body)))
        # self.end_headers()
        # self.wfile.write(body)
        body = json.dumps({"items": tools}, ensure_ascii=False).encode("utf-8")
        accept_encoding = self.headers.get("Accept-Encoding", "")
        
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=300, stale-while-revalidate=86400")
        self.send_header("Vary", "Accept-Encoding")
        
        if "gzip" in accept_encoding:
            body = gzip.compress(body)
            self.send_header("Content-Encoding", "gzip")
        
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

    def strip_language_prefix(self, raw_path: str) -> tuple[str, str | None]:
        path_parts = raw_path.lstrip("/").split("/", 1)
        if not path_parts or path_parts[0] not in LANGUAGE_PREFIXES:
            return raw_path, None

        remaining_path = f"/{path_parts[1]}" if len(path_parts) > 1 and path_parts[1] else "/"
        return remaining_path, path_parts[0]

    def localized_absolute_url(self, raw_path: str, language: str | None) -> str:
        if raw_path in {"/", "", "/index.html"}:
            return f"{SITE_URL}/{language}/" if language and language != "zh-Hant" else f"{SITE_URL}/"

        prefix = f"/{language}" if language and language != "zh-Hant" else ""
        return f"{SITE_URL}{prefix}{raw_path}"

    def localize_html_head(self, body: bytes, raw_path: str, language: str | None) -> bytes:
        html = body.decode("utf-8")
        html = html.replace('<html lang="zh-Hant">', f'<html lang="{language or "zh-Hant"}">')

        if language and language != "zh-Hant":
            page_url = self.localized_absolute_url(raw_path, language)
            html = re.sub(r'<link rel="canonical" href="[^"]+" />', f'<link rel="canonical" href="{page_url}" />', html)
            html = re.sub(r'<meta property="og:url" content="[^"]+" />', f'<meta property="og:url" content="{page_url}" />', html)

        return html.encode("utf-8")

    def get_cache_control(self, target_path: Path, content_type: str) -> str:
        if content_type.startswith("text/html"):
            return "no-cache"
        if target_path.suffix.lower() in LONG_CACHE_EXTENSIONS:
            return "public, max-age=2592000"
        return "public, max-age=3600"

    def serve_static_file(self, raw_path: str, send_body: bool = True) -> None:
        raw_path, language = self.strip_language_prefix(raw_path)
        relative_path = "index.html" if raw_path in {"/", ""} else raw_path.lstrip("/")
        target_path = (ROOT_DIR / relative_path).resolve()

        if ROOT_DIR not in target_path.parents and target_path != ROOT_DIR:
            self.send_error(403, "Forbidden")
            return

        if not target_path.exists() or not target_path.is_file():
            self.send_error(404, "File not found")
            return

        content_type, _ = mimetypes.guess_type(target_path.name)
        content_type = content_type or "application/octet-stream"
        if content_type in UTF8_TEXT_TYPES:
            content_type = f"{content_type}; charset=utf-8"
        body = target_path.read_bytes()
        if language and content_type.startswith("text/html"):
            body = self.localize_html_head(body, raw_path, language)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", self.get_cache_control(target_path, content_type))
        self.end_headers()
        if send_body:
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
