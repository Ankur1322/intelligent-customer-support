import os
import re
from typing import List, Dict, Any, Tuple
import fitz  # PyMuPDF
import pdfplumber
from docx import Document as DocxDocument

class TextProcessor:
    @staticmethod
    def clean_text(text: str) -> str:
        """
        Normalize and clean extracted text by removing weird characters,
        stripping excess whitespace, and resolving ligature issues.
        """
        if not text:
            return ""
        # Replace non-breaking spaces and tabs
        text = text.replace("\xa0", " ").replace("\t", " ")
        # Replace multiple spaces with a single space
        text = re.sub(r"[ ]+", " ", text)
        # Replace excess vertical spacing with single line break
        text = re.sub(r"\n\s*\n+", "\n\n", text)
        # Remove unprintable/garbage control characters
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]", "", text)
        return text.strip()

    @classmethod
    def extract_text_from_pdf(cls, file_path: str) -> List[Tuple[int, str]]:
        """
        Extract text page-by-page from PDF.
        Implements a triple-layer fallback chain:
        1. PyMuPDF (fastest, high-fidelity)
        2. pdfplumber (structural analyzer)
        3. pypdf (100% pure Python, bulletproof fallback, zero graphics dependencies)
        """
        import sys
        pages = []

        # Layer 1: PyMuPDF (fitz)
        try:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                page_text = page.get_text()
                cleaned = cls.clean_text(page_text)
                if cleaned:
                    pages.append((i + 1, cleaned))
            doc.close()
            if pages:
                print(f"[EXTRACT] Successfully parsed PDF via PyMuPDF. Total pages: {len(pages)}", file=sys.stderr)
                return pages
        except Exception as e:
            print(f"[EXTRACT] PyMuPDF failed/unavailable (graphics libraries missing): {str(e)}", file=sys.stderr)

        # Layer 2: pdfplumber
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    cleaned = cls.clean_text(page_text)
                    if cleaned:
                        pages.append((i + 1, cleaned))
            if pages:
                print(f"[EXTRACT] Successfully parsed PDF via pdfplumber. Total pages: {len(pages)}", file=sys.stderr)
                return pages
        except Exception as e:
            print(f"[EXTRACT] pdfplumber failed/unavailable: {str(e)}", file=sys.stderr)

        # Layer 3: pypdf (Pure-Python Fail-Safe)
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                cleaned = cls.clean_text(page_text)
                if cleaned:
                    pages.append((i + 1, cleaned))
            if pages:
                print(f"[EXTRACT] Successfully parsed PDF via pure-python pypdf. Total pages: {len(pages)}", file=sys.stderr)
                return pages
        except Exception as e:
            print(f"[EXTRACT] Pure-python pypdf fallback failed: {str(e)}", file=sys.stderr)

        # If all three layers failed to extract any readable text
        raise ValueError(
            "All PDF text extraction layers failed. The PDF is likely scanned/image-only, encrypted, or corrupted."
        )

    @classmethod
    def extract_text_from_docx(cls, file_path: str) -> List[Tuple[int, str]]:
        """
        Extract text from DOCX files. Since DOCX doesn't have strict physical pages,
        we group paragraphs to simulate pages or logical divisions (e.g. every 500 words).
        """
        try:
            doc = DocxDocument(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            full_text = "\n\n".join(paragraphs)
            cleaned = cls.clean_text(full_text)
            
            # Divide into chunks that mimic logical pages (approx 600 words per page)
            words = cleaned.split()
            simulated_pages = []
            words_per_page = 600
            
            for i in range(0, len(words), words_per_page):
                page_words = words[i:i+words_per_page]
                page_num = (i // words_per_page) + 1
                simulated_pages.append((page_num, " ".join(page_words)))
            
            return simulated_pages if simulated_pages else [(1, "")]
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX: {str(e)}")

    @classmethod
    def extract_text_from_txt(cls, file_path: str) -> List[Tuple[int, str]]:
        """
        Extract text from TXT files. Group into logical pages every 3000 characters.
        """
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            cleaned = cls.clean_text(content)
            
            simulated_pages = []
            chars_per_page = 3000
            for i in range(0, len(cleaned), chars_per_page):
                sub_text = cleaned[i:i+chars_per_page]
                page_num = (i // chars_per_page) + 1
                simulated_pages.append((page_num, sub_text))
                
            return simulated_pages if simulated_pages else [(1, "")]
        except Exception as e:
            raise ValueError(f"Failed to parse TXT: {str(e)}")

    @classmethod
    def extract_document(cls, file_path: str, file_type: str) -> List[Tuple[int, str]]:
        """
        Unified extractor for any supported file type.
        """
        if file_type == "pdf":
            return cls.extract_text_from_pdf(file_path)
        elif file_type == "docx":
            return cls.extract_text_from_docx(file_path)
        elif file_type == "txt":
            return cls.extract_text_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    @staticmethod
    def chunk_document(pages: List[Tuple[int, str]], chunk_size: int = 500, chunk_overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Split a document's pages into overlapping chunks.
        Tracks page number and index.
        """
        chunks = []
        chunk_idx = 0

        for page_num, page_text in pages:
            # Basic word-based chunking with sliding window
            words = page_text.split()
            i = 0
            while i < len(words):
                chunk_words = words[i:i+chunk_size]
                chunk_text = " ".join(chunk_words)
                
                chunks.append({
                    "text": chunk_text,
                    "chunk_index": chunk_idx,
                    "page_number": page_num
                })
                chunk_idx += 1
                
                # Advance pointer by (chunk_size - chunk_overlap)
                i += (chunk_size - chunk_overlap)
                if len(words) - i < chunk_overlap:
                    break # Avoid creating tiny residual chunks
                    
        return chunks
