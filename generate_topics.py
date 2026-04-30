from __future__ import annotations

import re
import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "data" / "tools.db"
MAX_TOPICS_PER_TOOL = 6


LANGUAGE_TOPICS = {
    "python": "python",
    "javascript": "javascript",
    "typescript": "typescript",
    "java": "java",
    "go": "golang",
    "rust": "rust",
    "html": "html",
    "css": "css",
    "php": "php",
    "ruby": "ruby",
    "swift": "swift",
    "kotlin": "kotlin",
    "c": "c",
    "c++": "cpp",
    "c#": "csharp",
    "shell": "shell",
    "markdown": "documentation",
}


KEYWORD_RULES = [
    ("machine-learning", [r"machine learning", r"\bml\b"]),
    ("deep-learning", [r"deep learning"]),
    ("llm", [r"\bllm\b", r"large language model"]),
    ("ai", [r"\bartificial intelligence\b", r"\bai\b"]),
    ("rag", [r"\brag\b", r"retrieval-augmented generation"]),
    ("api", [r"\bapi\b", r"\bapis\b"]),
    ("backend", [r"\bbackend\b", r"server-side"]),
    ("frontend", [r"\bfrontend\b", r"front-end"]),
    ("web", [r"\bweb\b", r"website", r"browser"]),
    ("mobile", [r"\bmobile\b"]),
    ("android", [r"\bandroid\b"]),
    ("ios", [r"\bios\b", r"iphone", r"ipad"]),
    ("react", [r"\breact\b"]),
    ("vue", [r"\bvue\b"]),
    ("angular", [r"\bangular\b"]),
    ("nodejs", [r"\bnode\.?js\b"]),
    ("docker", [r"\bdocker\b", r"container"]),
    ("kubernetes", [r"\bkubernetes\b", r"\bk8s\b"]),
    ("database", [r"\bdatabase\b", r"\bsql\b", r"\bpostgres\b", r"\bmysql\b", r"\bsqlite\b"]),
    ("search", [r"\bsearch\b", r"search engine"]),
    ("cli", [r"command[- ]line", r"\bcli\b", r"\bterminal\b", r"\bshell\b"]),
    ("devops", [r"\bdevops\b", r"ci/cd", r"continuous integration", r"deployment"]),
    ("security", [r"\bsecurity\b", r"authentication", r"authorization", r"\bauth\b", r"\bencryption\b"]),
    ("testing", [r"\btesting\b", r"\btest\b", r"\bqa\b"]),
    ("automation", [r"\bautomation\b", r"\bautomate\b"]),
    ("data-science", [r"data science", r"data analysis", r"data visualization"]),
    ("game-dev", [r"\bgame\b", r"gamedev", r"game engine"]),
    ("tutorial", [r"tutorial", r"step-by-step", r"from scratch", r"build your own", r"learn"]),
    ("awesome-list", [r"\bawesome\b", r"curated list", r"collection of"]),
    ("open-source", [r"open source", r"open-source"]),
    ("education", [r"\beducation\b", r"curriculum", r"books", r"learning"]),
]


def normalize_text(*parts: str | None) -> str:
    return " ".join(part for part in parts if part).lower()


def generate_topics(row: sqlite3.Row) -> list[str]:
    topics: list[str] = []

    def add(topic: str) -> None:
        if topic and topic not in topics:
            topics.append(topic)

    language = (row["language"] or "").strip().lower()
    if language in LANGUAGE_TOPICS:
        add(LANGUAGE_TOPICS[language])

    haystack = normalize_text(
        row["name"],
        row["full_name"],
        row["description"],
        row["homepage"],
    )

    for topic, patterns in KEYWORD_RULES:
        if any(re.search(pattern, haystack, re.IGNORECASE) for pattern in patterns):
            add(topic)

    if row["homepage"]:
        add("homepage")

    if row["stars"] and row["stars"] >= 100000:
        add("popular")

    return topics[:MAX_TOPICS_PER_TOOL]


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tool_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER,
            topic TEXT
        )
        """
    )
    cursor.execute("DELETE FROM tool_topics")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'tool_topics'")

    rows = cursor.execute(
        """
        SELECT
            id,
            name,
            full_name,
            description,
            homepage,
            language,
            stars
        FROM tools
        ORDER BY id
        """
    ).fetchall()

    insert_rows: list[tuple[int, str]] = []
    for row in rows:
        for topic in generate_topics(row):
            insert_rows.append((row["id"], topic))

    cursor.executemany(
        "INSERT INTO tool_topics (tool_id, topic) VALUES (?, ?)",
        insert_rows,
    )
    connection.commit()

    tool_count = len(rows)
    topic_count = len(insert_rows)
    covered_tools = cursor.execute(
        "SELECT COUNT(DISTINCT tool_id) FROM tool_topics"
    ).fetchone()[0]
    connection.close()

    print(f"Generated {topic_count} topics across {covered_tools}/{tool_count} tools.")


if __name__ == "__main__":
    main()
