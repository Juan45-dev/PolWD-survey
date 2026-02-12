from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python tools/extract_pdf.py <path-to-pdf> [out-txt]")
        return 2

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        return 2

    out_path = (
        Path(sys.argv[2]).expanduser().resolve()
        if len(sys.argv) >= 3
        else pdf_path.with_suffix(".txt")
    )

    try:
        import fitz  # PyMuPDF
    except Exception as exc:
        print("Missing dependency: pymupdf. Install with: python -m pip install pymupdf")
        print(exc)
        return 2

    doc = fitz.open(pdf_path)
    parts: list[str] = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")
        parts.append(f"\n\n===== PAGE {i} =====\n\n{text}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("".join(parts), encoding="utf-8", errors="replace")
    print(f"Wrote {out_path} (pages: {doc.page_count})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

