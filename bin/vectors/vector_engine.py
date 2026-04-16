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

CREATE TABLE IF NOT EXISTS dir_summaries (
    id INTEGER PRIMARY KEY,
    dir_path TEXT UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    embedding BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS page_summaries (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(id),
    summary TEXT NOT NULL,
    embedding BLOB NOT NULL
);
"""

VEC_DDL_TEMPLATE = """
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
    id INTEGER PRIMARY KEY,
    embedding float[{dim}] distance_metric=cosine
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_dirs USING vec0(
    id INTEGER PRIMARY KEY,
    embedding float[{dim}] distance_metric=cosine
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_pages USING vec0(
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

def _extract_page_summary(path: Path) -> str:
    """Extract title + first 200 chars of Compiled Truth section for L1 summary."""
    text = path.read_text(encoding="utf-8", errors="replace")
    title, _ = _extract_frontmatter(text)
    if not title:
        m = re.search(r"^#\s+(.+)", text, re.MULTILINE)
        title = m.group(1).strip() if m else path.stem

    body = _strip_frontmatter(text)
    # Try to find "## Compiled Truth" section
    m = re.search(r"(?m)^## Compiled Truth\s*\n(.*?)(?=\n## |\Z)", body, re.DOTALL)
    if m:
        intro = m.group(1).strip()[:200]
    else:
        # Fallback: first 200 chars of body
        intro = body.strip()[:200]

    return f"{title}: {intro}"


def _build_layered_index(db: sqlite3.Connection, corpus: Path, model: str) -> None:
    """Build L0 (dir) and L1 (page) layered indices."""
    # --- L0: directory-level summaries ---
    # Clear old data
    db.execute("DELETE FROM dir_summaries")
    db.execute("DELETE FROM vec_dirs")

    # Collect directories that have indexed documents
    dir_docs: dict[str, list[str]] = {}  # dir_path -> [title, ...]
    rows = db.execute("SELECT id, path FROM documents").fetchall()
    for doc_id, doc_path in rows:
        p = Path(corpus / doc_path)
        rel_dir = str(Path(doc_path).parent)
        if rel_dir == ".":
            continue
        title, _ = _extract_frontmatter(
            p.read_text(encoding="utf-8", errors="replace")
        ) if p.exists() else ("", "")
        if not title:
            title = p.stem if p.exists() else Path(doc_path).stem
        dir_docs.setdefault(rel_dir, []).append(title)

    if dir_docs:
        dir_paths = sorted(dir_docs.keys())
        dir_texts = []
        for dp in dir_paths:
            label = dp.split("/")[-1] if "/" in dp else dp
            titles_str = ", ".join(dir_docs[dp][:50])  # cap at 50 titles
            dir_texts.append(f"{label}目录：{titles_str}")

        dir_embeddings = _ollama_embed(dir_texts, model)
        for dp, text, emb_arr in zip(dir_paths, dir_texts, dir_embeddings):
            emb_blob = emb_arr.tobytes()
            db.execute(
                "INSERT INTO dir_summaries (dir_path, summary, embedding) VALUES (?, ?, ?)",
                (dp, text, emb_blob),
            )
            dir_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            db.execute(
                "INSERT INTO vec_dirs (id, embedding) VALUES (?, ?)",
                (dir_id, emb_blob),
            )

        print(f"  L0: indexed {len(dir_paths)} directories")

    # --- L1: page-level summaries ---
    db.execute("DELETE FROM page_summaries")
    db.execute("DELETE FROM vec_pages")

    page_data: list[tuple[int, str]] = []  # (doc_id, summary_text)
    for doc_id, doc_path in rows:
        p = Path(corpus / doc_path)
        if not p.exists():
            continue
        summary = _extract_page_summary(p)
        page_data.append((doc_id, summary))

    if page_data:
        # Batch embed in groups to avoid huge payloads
        BATCH = 64
        total_pages = 0
        for i in range(0, len(page_data), BATCH):
            batch = page_data[i : i + BATCH]
            texts = [s for _, s in batch]
            embeddings = _ollama_embed(texts, model)
            for (doc_id, summary), emb_arr in zip(batch, embeddings):
                emb_blob = emb_arr.tobytes()
                db.execute(
                    "INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)",
                    (doc_id, summary, emb_blob),
                )
                page_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
                db.execute(
                    "INSERT INTO vec_pages (id, embedding) VALUES (?, ?)",
                    (page_id, emb_blob),
                )
                total_pages += 1

        print(f"  L1: indexed {total_pages} pages")


def cmd_sync(args: argparse.Namespace) -> None:
    corpus = Path(args.corpus).resolve()
    force = args.force
    layered = args.layered
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
    # Build layered index if requested
    if layered or force:
        print("Building layered index (L0/L1)...")
        _build_layered_index(db, corpus, model)

    db.commit()
    db.close()

    print(f"synced {synced} files ({total_chunks} chunks), skipped {skipped} unchanged")


def cmd_query(args: argparse.Namespace) -> None:
    corpus = Path(args.corpus).resolve()
    text = args.text
    top_k = args.top_k
    threshold = args.threshold
    model = args.model or MODEL_NAME
    layered = args.layered

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

    if layered:
        results = cmd_query_layered(db, emb_blob, top_k, threshold)
    else:
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


def cmd_query_layered(db: sqlite3.Connection, emb_blob: bytes, top_k: int, threshold: float) -> list[dict]:
    """L0 → L1 → L2 hierarchical retrieval."""
    # L0: find top-3 directories
    l0_rows = db.execute(
        """
        SELECT v.id, v.distance
        FROM vec_dirs v
        WHERE v.embedding MATCH ? AND k = 3
        ORDER BY v.distance
        """,
        (emb_blob,),
    ).fetchall()

    if not l0_rows:
        return []

    dir_ids = [r[0] for r in l0_rows]
    placeholders = ",".join("?" * len(dir_ids))
    dir_paths = [
        r[0]
        for r in db.execute(
            f"SELECT dir_path FROM dir_summaries WHERE id IN ({placeholders})",
            dir_ids,
        ).fetchall()
    ]

    if not dir_paths:
        return []

    # L1: find top-5 pages within those directories
    # Build path prefix filter: doc path must start with one of the dir_paths
    like_clauses = " OR ".join(["d.path LIKE ?" for _ in dir_paths])
    like_params = [dp + "/%" for dp in dir_paths]

    # Get candidate page summary IDs within matched dirs
    candidate_page_ids = [
        r[0]
        for r in db.execute(
            f"""
            SELECT ps.id FROM page_summaries ps
            JOIN documents d ON ps.doc_id = d.id
            WHERE {like_clauses}
            """,
            like_params,
        ).fetchall()
    ]

    if not candidate_page_ids:
        return []

    # Search vec_pages with a larger k, then filter to candidates
    # Use k = min(len(candidate_page_ids), 50) to get enough candidates
    search_k = min(len(candidate_page_ids), 50)
    l1_rows = db.execute(
        """
        SELECT v.id, v.distance
        FROM vec_pages v
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance
        """,
        (emb_blob, search_k),
    ).fetchall()

    candidate_set = set(candidate_page_ids)
    l1_filtered = [(r[0], r[1]) for r in l1_rows if r[0] in candidate_set][:5]

    if not l1_filtered:
        return []

    # Get doc_ids from the matched page summaries
    page_ids = [r[0] for r in l1_filtered]
    ph = ",".join("?" * len(page_ids))
    doc_ids = [
        r[0]
        for r in db.execute(
            f"SELECT DISTINCT doc_id FROM page_summaries WHERE id IN ({ph})",
            page_ids,
        ).fetchall()
    ]

    if not doc_ids:
        return []

    # L2: search vec_chunks, filter to chunks belonging to matched docs
    # Get candidate chunk IDs
    doc_ph = ",".join("?" * len(doc_ids))
    candidate_chunk_ids = [
        r[0]
        for r in db.execute(
            f"SELECT id FROM chunks WHERE doc_id IN ({doc_ph})",
            doc_ids,
        ).fetchall()
    ]

    if not candidate_chunk_ids:
        return []

    search_k2 = min(len(candidate_chunk_ids), top_k * 5)
    l2_rows = db.execute(
        """
        SELECT v.id, v.distance
        FROM vec_chunks v
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance
        """,
        (emb_blob, search_k2),
    ).fetchall()

    chunk_set = set(candidate_chunk_ids)
    l2_filtered = [(r[0], r[1]) for r in l2_rows if r[0] in chunk_set][:top_k]

    results: list[dict] = []
    for chunk_id, distance in l2_filtered:
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

    return results


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

    # Layered index stats (tables may not exist in older DBs)
    try:
        dir_count = db.execute("SELECT COUNT(*) FROM dir_summaries").fetchone()[0]
        page_count = db.execute("SELECT COUNT(*) FROM page_summaries").fetchone()[0]
    except sqlite3.OperationalError:
        dir_count = 0
        page_count = 0

    info = {
        "indexed": True,
        "total_indexable_files": total_files,
        "indexed_files": doc_count,
        "chunks": chunk_count,
        "layered": {
            "dirs": dir_count,
            "pages": page_count,
        },
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
    p_sync.add_argument("--layered", action="store_true", help="Build L0/L1 layered index")
    p_sync.add_argument("--model", default=None, help=f"Ollama model (default: {MODEL_NAME})")

    p_query = sub.add_parser("query", help="Semantic search")
    p_query.add_argument("--corpus", required=True)
    p_query.add_argument("--text", required=True)
    p_query.add_argument("--top-k", type=int, default=5)
    p_query.add_argument("--threshold", type=float, default=0.5)
    p_query.add_argument("--layered", action="store_true", help="Use L0→L1→L2 layered retrieval")
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
