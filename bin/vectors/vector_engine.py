#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["sqlite-vec>=0.1", "numpy>=1.26"]
# ///
"""vector_engine.py — embed & search corpus chunks via ollama + sqlite-vec.

Sub-commands: sync, query, status.
Embedding backend: ollama (local bge-m3 by default).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OLLAMA_URL = "http://localhost:11434/api/embed"
MODEL_NAME = "bge-m3"
EMBEDDING_DIM = 1024
MAX_CHUNK_CHARS = 800
MIN_CHUNK_CHARS = 20

INCLUDE_DIRS: list[str] = [
    "知识库",
    "每日",
    "写作",
    "原料/文章",
    "原料/书籍",
    "原料/会议",
]

EXCLUDE_PREFIXES: list[str] = [
    "_工作台",
    "_archive",
    "_归档",
    "原料/录音",
    "原料/剪藏",
    "反馈",
    "系统",
    ".wiki",
]

EXCLUDE_NAMES: set[str] = {".gitkeep", ".DS_Store"}

# ---------------------------------------------------------------------------
# Ollama embedding
# ---------------------------------------------------------------------------

def _ollama_embed(texts: list[str], model: str = MODEL_NAME) -> list[np.ndarray]:
    """Call ollama /api/embed for a batch of texts."""
    payload = json.dumps({"model": model, "input": texts}).encode()
    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"ERROR: cannot connect to ollama at {OLLAMA_URL}", file=sys.stderr)
        print(f"  Make sure ollama is running: ollama serve", file=sys.stderr)
        print(f"  And bge-m3 is pulled: ollama pull bge-m3", file=sys.stderr)
        sys.exit(1)

    embeddings = data.get("embeddings", [])
    return [np.array(e, dtype=np.float32) for e in embeddings]


def _ollama_embed_single(text: str, model: str = MODEL_NAME) -> np.ndarray:
    return _ollama_embed([text], model)[0]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def _extract_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        return "", ""
    end = text.find("\n---", 3)
    if end == -1:
        return "", ""
    block = text[3:end]
    title = ""
    type_ = ""
    for line in block.splitlines():
        m = re.match(r'^title\s*:\s*["\']?(.+?)["\']?\s*$', line)
        if m:
            title = m.group(1)
        m = re.match(r'^type\s*:\s*["\']?(.+?)["\']?\s*$', line)
        if m:
            type_ = m.group(1)
    return title, type_


def _strip_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    return text[end + 4:].lstrip("\n")


def _should_index(rel: str) -> bool:
    parts = rel.split("/")
    if parts[-1] in EXCLUDE_NAMES:
        return False
    if not rel.endswith(".md"):
        return False
    for prefix in EXCLUDE_PREFIXES:
        if rel == prefix or rel.startswith(prefix + "/"):
            return False
    for inc in INCLUDE_DIRS:
        if rel == inc or rel.startswith(inc + "/"):
            return True
    return False


def _collect_files(corpus: Path) -> list[Path]:
    results: list[Path] = []
    for p in sorted(corpus.rglob("*.md")):
        rel = str(p.relative_to(corpus))
        if _should_index(rel):
            results.append(p)
    return results


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_file(path: Path, corpus_root: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    title, type_ = _extract_frontmatter(text)

    if not title:
        m = re.search(r"^#\s+(.+)", text, re.MULTILINE)
        title = m.group(1).strip() if m else path.stem

    body = _strip_frontmatter(text)
    parts = re.split(r"(?m)^(## .+)$", body)

    sections: list[tuple[str, str]] = []
    if parts[0].strip():
        sections.append(("_intro", parts[0]))
    i = 1
    while i < len(parts) - 1:
        heading = parts[i].lstrip("# ").strip()
        sec_body = parts[i + 1] if i + 1 < len(parts) else ""
        sections.append((heading, sec_body))
        i += 2

    prefix = ""
    if title:
        prefix += f"[{title}] "
    if type_:
        prefix += f"[{type_}] "

    chunks: list[dict] = []
    for heading, sec_body in sections:
        sec_body = sec_body.strip()
        if not sec_body or len(sec_body) < MIN_CHUNK_CHARS:
            continue
        if len(sec_body) > MAX_CHUNK_CHARS:
            paragraphs = sec_body.split("\n\n")
            current = ""
            for p in paragraphs:
                if len(current) + len(p) > MAX_CHUNK_CHARS and current:
                    chunks.append({
                        "section": heading,
                        "content": prefix + current.strip(),
                    })
                    current = p
                else:
                    current = (current + "\n\n" + p) if current else p
            if current.strip():
                chunks.append({
                    "section": heading,
                    "content": prefix + current.strip(),
                })
        else:
            chunks.append({
                "section": heading,
                "content": prefix + sec_body,
            })
    return chunks


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DDL = """
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    sha256 TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER NOT NULL,
    section TEXT,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

VEC_DDL_TEMPLATE = """
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
    id INTEGER PRIMARY KEY,
    embedding float[{dim}] distance_metric=cosine
);
"""


def _open_db(corpus: Path, dim: int = EMBEDDING_DIM) -> sqlite3.Connection:
    import sqlite_vec

    wiki_dir = corpus / ".wiki"
    wiki_dir.mkdir(exist_ok=True)
    db_path = wiki_dir / "vector.sqlite"
    db = sqlite3.connect(str(db_path))
    db.enable_load_extension(True)
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(DDL)
    db.executescript(VEC_DDL_TEMPLATE.format(dim=dim))
    return db


# ---------------------------------------------------------------------------
# Sub-commands
# ---------------------------------------------------------------------------

def cmd_sync(args: argparse.Namespace) -> None:
    corpus = Path(args.corpus).resolve()
    force = args.force
    model = args.model or MODEL_NAME

    # Probe model dimension
    test_emb = _ollama_embed_single("test", model)
    dim = len(test_emb)

    db = _open_db(corpus, dim)

    files = _collect_files(corpus)
    synced = 0
    skipped = 0
    total_chunks = 0

    for fpath in files:
        rel = str(fpath.relative_to(corpus))
        sha = _sha256(fpath)

        if not force:
            row = db.execute(
                "SELECT sha256 FROM documents WHERE path = ?", (rel,)
            ).fetchone()
            if row and row[0] == sha:
                skipped += 1
                continue

        old = db.execute(
            "SELECT id FROM documents WHERE path = ?", (rel,)
        ).fetchone()
        if old:
            old_id = old[0]
            chunk_ids = [
                r[0]
                for r in db.execute(
                    "SELECT id FROM chunks WHERE doc_id = ?", (old_id,)
                ).fetchall()
            ]
            for cid in chunk_ids:
                db.execute("DELETE FROM vec_chunks WHERE id = ?", (cid,))
            db.execute("DELETE FROM chunks WHERE doc_id = ?", (old_id,))
            db.execute("DELETE FROM documents WHERE id = ?", (old_id,))

        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "INSERT INTO documents (path, sha256, updated_at) VALUES (?, ?, ?)",
            (rel, sha, now),
        )
        doc_id = db.execute(
            "SELECT id FROM documents WHERE path = ?", (rel,)
        ).fetchone()[0]

        chunks = chunk_file(fpath, corpus)
        if not chunks:
            synced += 1
            continue

        texts = [c["content"] for c in chunks]
        embeddings = _ollama_embed(texts, model)

        for chunk, emb_arr in zip(chunks, embeddings):
            emb_blob = emb_arr.tobytes()
            db.execute(
                "INSERT INTO chunks (doc_id, section, content, embedding) VALUES (?, ?, ?, ?)",
                (doc_id, chunk["section"], chunk["content"], emb_blob),
            )
            chunk_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            db.execute(
                "INSERT INTO vec_chunks (id, embedding) VALUES (?, ?)",
                (chunk_id, emb_blob),
            )
            total_chunks += 1

        synced += 1

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)", (now,),
    )
    db.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)", (model,),
    )
    db.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)", (str(dim),),
    )
    db.commit()
    db.close()

    print(f"synced {synced} files ({total_chunks} chunks), skipped {skipped} unchanged")


def cmd_query(args: argparse.Namespace) -> None:
    corpus = Path(args.corpus).resolve()
    text = args.text
    top_k = args.top_k
    threshold = args.threshold
    model = args.model or MODEL_NAME

    # Probe dim from meta or model
    db_path = corpus / ".wiki" / "vector.sqlite"
    dim = EMBEDDING_DIM
    if db_path.exists():
        import sqlite3 as _s
        _db = _s.connect(str(db_path))
        row = _db.execute("SELECT value FROM meta WHERE key = 'dim'").fetchone()
        if row:
            dim = int(row[0])
        _db.close()

    db = _open_db(corpus, dim)

    emb_arr = _ollama_embed_single(text, model)
    emb_blob = emb_arr.tobytes()

    rows = db.execute(
        """
        SELECT v.id, v.distance
        FROM vec_chunks v
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance
        """,
        (emb_blob, top_k),
    ).fetchall()

    results: list[dict] = []
    for row in rows:
        chunk_id, distance = row
        score = 1.0 - (distance * distance) / 2.0
        if score < threshold:
            continue
        chunk_row = db.execute(
            """
            SELECT c.content, c.section, d.path
            FROM chunks c JOIN documents d ON c.doc_id = d.id
            WHERE c.id = ?
            """,
            (chunk_id,),
        ).fetchone()
        if chunk_row:
            results.append({
                "file": chunk_row[2],
                "chunk": chunk_row[0],
                "score": round(score, 4),
                "section": chunk_row[1],
            })

    db.close()
    print(json.dumps(results, ensure_ascii=False, indent=2))


def cmd_status(args: argparse.Namespace) -> None:
    corpus = Path(args.corpus).resolve()
    db_path = corpus / ".wiki" / "vector.sqlite"

    if not db_path.exists():
        print(json.dumps({
            "indexed": False,
            "message": "No vector index found. Run 'wiki vector sync' first.",
        }, ensure_ascii=False, indent=2))
        return

    db = _open_db(corpus)

    doc_count = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    chunk_count = db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    last_sync = db.execute(
        "SELECT value FROM meta WHERE key = 'last_sync'"
    ).fetchone()
    model = db.execute(
        "SELECT value FROM meta WHERE key = 'model'"
    ).fetchone()
    dim = db.execute(
        "SELECT value FROM meta WHERE key = 'dim'"
    ).fetchone()

    total_files = len(_collect_files(corpus))

    info = {
        "indexed": True,
        "total_indexable_files": total_files,
        "indexed_files": doc_count,
        "chunks": chunk_count,
        "embedding_dim": int(dim[0]) if dim else EMBEDDING_DIM,
        "last_sync": last_sync[0] if last_sync else None,
        "model": model[0] if model else None,
        "backend": "ollama",
    }

    db.close()
    print(json.dumps(info, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="lorekit vector engine — embed & search via ollama + sqlite-vec"
    )
    sub = parser.add_subparsers(dest="command")

    p_sync = sub.add_parser("sync", help="Index corpus into vector DB")
    p_sync.add_argument("--corpus", required=True)
    p_sync.add_argument("--force", action="store_true", help="Full rebuild")
    p_sync.add_argument("--model", default=None, help=f"Ollama model (default: {MODEL_NAME})")

    p_query = sub.add_parser("query", help="Semantic search")
    p_query.add_argument("--corpus", required=True)
    p_query.add_argument("--text", required=True)
    p_query.add_argument("--top-k", type=int, default=5)
    p_query.add_argument("--threshold", type=float, default=0.5)
    p_query.add_argument("--model", default=None, help=f"Ollama model (default: {MODEL_NAME})")

    p_status = sub.add_parser("status", help="Show index status")
    p_status.add_argument("--corpus", required=True)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    {"sync": cmd_sync, "query": cmd_query, "status": cmd_status}[args.command](args)


if __name__ == "__main__":
    main()
