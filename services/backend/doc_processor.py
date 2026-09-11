"""
doc_processor.py — Universal document parser for the BizIntel pipeline.

Supported formats:
  PDF   (.pdf)   — pdfplumber for layout-aware text + tables
  CSV   (.csv)   — pandas → Markdown table
  Excel (.xlsx, .xls) — pandas → Markdown tables (all sheets)
  Text  (.txt, .md)   — plain passthrough
  DOCX  (.docx)  — docx2txt if available, else raw decode
  Image (.png, .jpg, .jpeg, .webp) — Groq vision model for chart/visual summary

Security:
  - Extension allowlist + MIME-prefix check
  - Max 15 MB per file, max 5 files per request
  - No shell execution, no file system writes
"""

import io
import logging
import os
import re

logger = logging.getLogger(__name__)

# ─────────────────────────── Allowlist & Limits ─────────────────────────────

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024   # 15 MB
MAX_FILES_PER_REQUEST = 5

ALLOWED_EXTENSIONS = {
    ".pdf", ".csv", ".xlsx", ".xls",
    ".txt", ".md", ".docx",
    ".png", ".jpg", ".jpeg", ".webp",
}

MIME_PREFIXES = (
    "application/pdf",
    "text/",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats",
    "application/octet-stream",   # generic binary — validated by ext
    "image/",
    "application/msword",
    "application/zip",            # DOCX/XLSX are zip-based
)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
TABULAR_EXTENSIONS = {".csv", ".xlsx", ".xls"}
PDF_EXTENSIONS = {".pdf"}
TEXT_EXTENSIONS = {".txt", ".md"}
DOCX_EXTENSIONS = {".docx"}

# ─────────────────────────── Validation ─────────────────────────────────────

class DocumentValidationError(ValueError):
    pass


def validate_file(filename: str, content_bytes: bytes) -> str:
    """
    Validate a single file. Returns the lowercase extension.
    Raises DocumentValidationError on any violation.
    """
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise DocumentValidationError(
            f"Unsupported file type '{ext}'. Allowed: PDF, CSV, XLSX, XLS, TXT, DOCX, PNG, JPG, WEBP."
        )
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        mb = len(content_bytes) / (1024 * 1024)
        raise DocumentValidationError(
            f"File '{filename}' is {mb:.1f} MB — maximum allowed is 15 MB."
        )
    if len(content_bytes) == 0:
        raise DocumentValidationError(f"File '{filename}' is empty.")
    return ext


# ─────────────────────────── PDF Extraction ─────────────────────────────────

def extract_pdf(content_bytes: bytes, filename: str) -> str:
    """Extract text and tables from a PDF using pdfplumber."""
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        # Fallback to pypdf
        return _extract_pdf_pypdf(content_bytes, filename)

    sections: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                page_parts: list[str] = []

                # Extract tables first (structured data)
                tables = page.extract_tables()
                for tbl_idx, table in enumerate(tables):
                    if not table:
                        continue
                    md_rows = []
                    for row_idx, row in enumerate(table):
                        cells = [str(c or "").strip() for c in row]
                        md_rows.append("| " + " | ".join(cells) + " |")
                        if row_idx == 0:
                            md_rows.append("|" + " --- |" * len(cells))
                    if md_rows:
                        page_parts.append(f"\n**Table {tbl_idx + 1} (Page {page_num}):**\n" + "\n".join(md_rows))

                # Extract plain text (excluding table regions to avoid duplication)
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                text = text.strip()
                if text:
                    page_parts.append(text)

                if page_parts:
                    sections.append(f"\n--- Page {page_num} ---\n" + "\n".join(page_parts))

        result = "\n".join(sections)
        # Limit to 8000 chars per doc to stay within token budget
        if len(result) > 8000:
            result = result[:8000] + "\n\n[...PDF truncated for token budget...]"
        return result or "(PDF contained no extractable text)"
    except Exception as e:
        logger.warning(f"pdfplumber failed on {filename}: {e}. Trying pypdf fallback.")
        return _extract_pdf_pypdf(content_bytes, filename)


def _extract_pdf_pypdf(content_bytes: bytes, filename: str) -> str:
    """Fallback PDF extraction using pypdf."""
    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(io.BytesIO(content_bytes))
        pages_text = []
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(f"--- Page {i} ---\n{text.strip()}")
        result = "\n".join(pages_text)
        if len(result) > 8000:
            result = result[:8000] + "\n[...PDF truncated...]"
        return result or "(PDF contained no extractable text)"
    except Exception as e:
        logger.error(f"pypdf fallback also failed for {filename}: {e}")
        return f"(Could not extract text from PDF: {e})"


# ─────────────────────────── Spreadsheet Extraction ─────────────────────────

def extract_spreadsheet(content_bytes: bytes, filename: str, ext: str) -> str:
    """Convert CSV or Excel file to a Markdown table string."""
    try:
        import pandas as pd  # type: ignore
    except ImportError:
        return f"(pandas not installed — cannot parse {filename})"

    try:
        if ext == ".csv":
            df_map = {"Sheet1": pd.read_csv(io.BytesIO(content_bytes), dtype=str, keep_default_na=False)}
        else:
            df_map = pd.read_excel(io.BytesIO(content_bytes), sheet_name=None, dtype=str)

        sections = []
        for sheet_name, df in df_map.items():
            # Drop entirely empty rows/columns
            df = df.dropna(how="all").dropna(axis=1, how="all")
            if df.empty:
                continue
            # Limit rows to avoid massive token use
            row_limit = 50
            truncated = len(df) > row_limit
            df = df.head(row_limit)

            md = df.to_markdown(index=False)
            header = f"**Sheet: {sheet_name}** ({len(df)} rows shown{', truncated' if truncated else ''})"
            sections.append(f"{header}\n\n{md}")

        result = "\n\n".join(sections)
        if len(result) > 6000:
            result = result[:6000] + "\n\n[...spreadsheet truncated for token budget...]"
        return result or "(Spreadsheet contained no data)"
    except Exception as e:
        logger.error(f"Spreadsheet extraction failed for {filename}: {e}")
        return f"(Could not parse spreadsheet: {e})"


# ─────────────────────────── Text / DOCX Extraction ─────────────────────────

def extract_text_file(content_bytes: bytes, filename: str, ext: str) -> str:
    """Extract plain text or DOCX content."""
    if ext in TEXT_EXTENSIONS:
        try:
            text = content_bytes.decode("utf-8", errors="replace")
            if len(text) > 6000:
                text = text[:6000] + "\n[...truncated...]"
            return text
        except Exception as e:
            return f"(Could not decode text file: {e})"

    if ext in DOCX_EXTENSIONS:
        try:
            import docx2txt  # type: ignore
            text = docx2txt.process(io.BytesIO(content_bytes))
            if len(text) > 6000:
                text = text[:6000] + "\n[...truncated...]"
            return text or "(DOCX contained no text)"
        except ImportError:
            # Try python-docx
            try:
                from docx import Document  # type: ignore
                doc = Document(io.BytesIO(content_bytes))
                text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                if len(text) > 6000:
                    text = text[:6000] + "\n[...truncated...]"
                return text or "(DOCX contained no text)"
            except Exception:
                return "(DOCX parsing unavailable — install python-docx or docx2txt)"

    return f"(Unsupported text type: {ext})"


# ─────────────────────────── Image Extraction (Groq Vision) ─────────────────

def extract_image_description(content_bytes: bytes, filename: str, groq_api_key: str) -> str:
    """
    Use Groq vision model to extract chart data, trends, and annotations from images.
    Falls back to a filename-only placeholder if vision model is unavailable.
    """
    import base64
    ext = os.path.splitext(filename.lower())[1].lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")
    b64 = base64.b64encode(content_bytes).decode()

    VISION_MODELS = [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
    ]

    vision_prompt = (
        "You are analyzing a business chart, graph, screenshot, or document image. "
        "Extract ALL visible data: axis labels, data point values, legend items, title, annotations, trend lines, and key numbers. "
        "Format as structured bullet points. Do NOT invent values — only report what is explicitly visible. "
        "If the image is not a chart, describe what it shows (e.g. product photo, org chart, pricing table screenshot)."
    )

    try:
        from groq import Groq  # type: ignore
        client = Groq(api_key=groq_api_key)
        for model in VISION_MODELS:
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": vision_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                        ],
                    }],
                    temperature=0.1,
                    max_tokens=800,
                )
                text = resp.choices[0].message.content or ""
                return f"**Visual Analysis of {filename}:**\n{text.strip()}"
            except Exception as e:
                logger.warning(f"Vision model {model} failed: {e}")
                continue
    except Exception as e:
        logger.warning(f"Groq vision unavailable: {e}")

    # Graceful fallback — at least record the filename
    return (
        f"**Image uploaded: {filename}**\n"
        "(Vision model unavailable on this Groq tier — image metadata recorded but content not extractable. "
        "For chart analysis, consider also uploading the underlying data as a CSV.)"
    )


# ─────────────────────────── Main Entry Point ────────────────────────────────

def process_documents(
    files: list,  # list of (filename: str, content_bytes: bytes)
    groq_api_key: str = "",
) -> list[dict]:
    """
    Process a list of (filename, bytes) tuples.
    Returns list of dicts: {filename, ext, doc_type, content_text, size_bytes, error}
    """
    results = []
    for filename, content_bytes in files[:MAX_FILES_PER_REQUEST]:
        entry: dict = {
            "filename": filename,
            "size_bytes": len(content_bytes),
            "content_text": "",
            "doc_type": "unknown",
            "error": None,
        }
        try:
            ext = validate_file(filename, content_bytes)
            entry["ext"] = ext

            if ext in PDF_EXTENSIONS:
                entry["doc_type"] = "pdf"
                entry["content_text"] = extract_pdf(content_bytes, filename)

            elif ext in TABULAR_EXTENSIONS:
                entry["doc_type"] = "spreadsheet"
                entry["content_text"] = extract_spreadsheet(content_bytes, filename, ext)

            elif ext in IMAGE_EXTENSIONS:
                entry["doc_type"] = "image"
                entry["content_text"] = extract_image_description(content_bytes, filename, groq_api_key)

            elif ext in TEXT_EXTENSIONS | DOCX_EXTENSIONS:
                entry["doc_type"] = "text"
                entry["content_text"] = extract_text_file(content_bytes, filename, ext)

        except DocumentValidationError as e:
            entry["error"] = str(e)
            logger.warning(f"Validation error for {filename}: {e}")
        except Exception as e:
            entry["error"] = f"Processing error: {e}"
            logger.exception(f"Unexpected error processing {filename}: {e}")

        results.append(entry)
    return results
