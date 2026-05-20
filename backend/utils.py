import os
import fitz
import boto3
import io
import numpy as np
import cv2
from typing import Dict, Any


def _clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def _risk_level(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 20:
        return "moderate"
    return "low"


def _confidence_level(score: float) -> str:
    if score >= 80:
        return "high"
    if score >= 55:
        return "medium"
    return "low"


def _call_textract_on_image(image_bytes: bytes, region: str = None):
    try:
        kwargs = {}
        if region:
            kwargs["region_name"] = region
        client = boto3.client("textract", **kwargs)
        resp = client.detect_document_text(Document={"Bytes": image_bytes})
        return resp
    except Exception:
        return None


def _extract_text_with_textract_or_fitz(doc: fitz.Document, region: str = None):
    texts = []
    confidences = []

    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        try:
            img_bytes = pix.tobytes("png")
        except Exception:
            img_bytes = pix.tobytes()

        resp = _call_textract_on_image(img_bytes, region=region)
        if resp and "Blocks" in resp:
            page_text = []
            for b in resp.get("Blocks", []):
                if b.get("BlockType") == "LINE":
                    text = b.get("Text")
                    if text:
                        page_text.append(text)
                if "Confidence" in b:
                    try:
                        confidences.append(float(b.get("Confidence", 0)))
                    except Exception:
                        pass
            texts.append("\n".join(page_text))
        else:
            # fallback to PyMuPDF text extraction
            texts.append(page.get_text("text"))

    full_text = "\n\n".join(texts)
    avg_conf = float(sum(confidences) / len(confidences)) if confidences else None
    return full_text, avg_conf


def _run_image_checks_on_page(pix: fitz.Pixmap) -> Dict[str, Any]:
    result = {"blur": False, "edge_density": None, "uniform_areas": False}

    try:
        try:
            img_bytes = pix.tobytes("png")
        except Exception:
            img_bytes = pix.tobytes()

        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return result

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        var_lap = cv2.Laplacian(gray, cv2.CV_64F).var()
        result["laplacian_variance"] = float(var_lap)
        if var_lap < 100:
            result["blur"] = True

        edges = cv2.Canny(gray, 100, 200)
        edge_density = float(edges.sum()) / (255.0 * edges.size)
        result["edge_density"] = edge_density
        if edge_density < 0.005:
            result["suspicious_edge_density"] = True

        # detect large uniform areas via variance in blocks
        h, w = gray.shape
        block = gray[max(0, h // 4): min(h, 3 * h // 4), max(0, w // 4): min(w, 3 * w // 4)]
        if np.var(block) < 50:
            result["uniform_areas"] = True

    except Exception:
        pass

    return result


def _score_metadata(meta: Dict[str, Any]) -> Dict[str, Any]:
    evidence = []
    penalty = 0

    if not meta.get("creationDate"):
        penalty += 4
        evidence.append("missing creation date")

    if not meta.get("author"):
        penalty += 2
        evidence.append("missing author")

    if not meta.get("title"):
        penalty += 1
        evidence.append("missing title")

    return {
        "category": "metadata",
        "penalty": int(_clamp(penalty, 0, 12)),
        "max": 12,
        "evidence": evidence,
        "explanation": (
            "Incomplete PDF metadata can be a weak integrity signal, but it is not enough on its own to flag a file."
        ),
    }


def _score_ocr(avg_confidence: float, extracted_text: str, page_count: int) -> Dict[str, Any]:
    evidence = []
    penalty = 0

    text_length = len(extracted_text.strip())

    if avg_confidence is not None:
        if avg_confidence < 60:
            penalty += 16
            evidence.append(f"very low OCR confidence ({avg_confidence:.1f}%)")
        elif avg_confidence < 75:
            penalty += 10
            evidence.append(f"low OCR confidence ({avg_confidence:.1f}%)")
        elif avg_confidence < 88:
            penalty += 5
            evidence.append(f"moderate OCR confidence ({avg_confidence:.1f}%)")
        else:
            evidence.append(f"good OCR confidence ({avg_confidence:.1f}%)")
    else:
        evidence.append("OCR confidence unavailable")
        if text_length == 0:
            penalty += 12
        elif text_length < 120 and page_count > 1:
            penalty += 4

    if text_length == 0:
        penalty += 6
        evidence.append("no readable text extracted")
    elif text_length < 120 and page_count > 1:
        penalty += 2
        evidence.append("very little text extracted for a multi-page PDF")

    return {
        "category": "ocr",
        "penalty": int(_clamp(penalty, 0, 22)),
        "max": 22,
        "evidence": evidence,
        "explanation": (
            "OCR quality is weighted heavily because weak text extraction is one of the most reliable indicators of scan quality or document issues."
        ),
    }


def _score_fonts(fonts_used: set, extracted_text: str, avg_confidence: float) -> Dict[str, Any]:
    evidence = []
    penalty = 0
    text_length = len(extracted_text.strip())

    if fonts_used:
        evidence.append(f"{len(fonts_used)} font(s) detected")
    else:
        evidence.append("no embedded fonts detected")
        if text_length == 0 and avg_confidence is None:
            penalty += 4
        elif avg_confidence is not None and avg_confidence < 75:
            penalty += 5
        else:
            penalty += 2

    return {
        "category": "fonts",
        "penalty": int(_clamp(penalty, 0, 8)),
        "max": 8,
        "evidence": evidence,
        "explanation": (
            "Missing embedded fonts is a weak signal by itself because scanned PDFs often rasterize the page, so this only contributes a small penalty unless other signals agree."
        ),
    }


def _score_tamper(tamper_signals: list) -> Dict[str, Any]:
    penalty = 0
    evidence = []
    page_counts = {}
    signal_counts = {}

    for signal in tamper_signals:
        page = signal.get("page")
        name = signal.get("signal", "unknown")
        page_counts[page] = page_counts.get(page, 0) + 1
        signal_counts[name] = signal_counts.get(name, 0) + 1

        if name == "blur":
            penalty += 4
        elif name == "low_edge_density":
            penalty += 3
        elif name == "large_uniform_area":
            penalty += 3
        else:
            penalty += 2

    for page, count in page_counts.items():
        if count >= 2:
            penalty += 2
            evidence.append(f"multiple signals on page {page}")

    if len(signal_counts) >= 2:
        penalty += 2
        evidence.append("multiple tamper signal types observed")

    if tamper_signals:
        evidence.extend([f"{name} x{count}" for name, count in signal_counts.items()])

    return {
        "category": "image_checks",
        "penalty": int(_clamp(penalty, 0, 18)),
        "max": 18,
        "evidence": evidence or ["no image anomalies detected"],
        "explanation": (
            "Image checks are only strongly weighted when the same page shows repeated or diverse anomalies, which reduces false positives from single weak heuristics."
        ),
    }


def _score_confidence(avg_confidence: float, extracted_text: str, tamper_signals: list, metadata_score: Dict[str, Any]) -> Dict[str, Any]:
    base = 60.0
    if avg_confidence is not None:
        base += (avg_confidence - 75.0) * 0.45
    else:
        base -= 10

    text_length = len(extracted_text.strip())
    if text_length > 500:
        base += 8
    elif text_length > 120:
        base += 3
    elif text_length == 0:
        base -= 18

    if tamper_signals:
        base -= min(10, len(tamper_signals) * 2)

    if metadata_score["penalty"] >= 8:
        base -= 4

    confidence_score = int(_clamp(base, 0, 100))
    return {
        "score": confidence_score,
        "level": _confidence_level(confidence_score),
    }


def process_pdf(path: str) -> Dict[str, Any]:
    flags = []
    extracted_text = ""
    avg_confidence = None

    region = os.environ.get("AWS_REGION")

    try:
        doc = fitz.open(path)
    except Exception as e:
        return {"error": f"cannot open pdf: {e}"}

    page_count = len(doc)

    meta = doc.metadata or {}
    metadata_score = _score_metadata(meta)
    fonts_used = set()
    try:
        for pno in range(page_count):
            page = doc.load_page(pno)
            try:
                fonts = page.get_fonts()
                if fonts:
                    for f in fonts:
                        fonts_used.add(f[3])
            except Exception:
                # page.get_fonts may not exist on some versions; skip
                pass
    except Exception:
        pass

    try:
        text, avg_confidence = _extract_text_with_textract_or_fitz(doc, region=region)
        extracted_text = text
    except Exception:
        # fallback: use PyMuPDF text
        try:
            extracted_text = "\n\n".join([p.get_text("text") for p in doc])
        except Exception:
            extracted_text = ""

    tamper_signals = []
    try:
        for pno in range(page_count):
            page = doc.load_page(pno)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
            checks = _run_image_checks_on_page(pix)
            if checks.get("blur"):
                tamper_signals.append({"page": pno + 1, "signal": "blur"})
            if checks.get("suspicious_edge_density"):
                tamper_signals.append({"page": pno + 1, "signal": "low_edge_density"})
            if checks.get("uniform_areas"):
                tamper_signals.append({"page": pno + 1, "signal": "large_uniform_area"})
    except Exception:
        pass

    ocr_score = _score_ocr(avg_confidence, extracted_text, page_count)
    font_score = _score_fonts(fonts_used, extracted_text, avg_confidence)
    tamper_score = _score_tamper(tamper_signals)

    score = (
        metadata_score["penalty"]
        + ocr_score["penalty"]
        + font_score["penalty"]
        + tamper_score["penalty"]
    )
    score = int(_clamp(score, 0, 100))

    confidence = _score_confidence(avg_confidence, extracted_text, tamper_signals, metadata_score)

    risk_level = _risk_level(score)
    if score >= 75:
        recommendation = "Escalate for immediate manual review"
    elif score >= 50:
        recommendation = "Manual review recommended"
    elif score >= 20:
        recommendation = "Review if other business checks are present"
    else:
        recommendation = "Low risk, suitable for normal workflow"

    if metadata_score["penalty"] > 0:
        flags.append("metadata_signal")
    if ocr_score["penalty"] > 0:
        flags.append("ocr_signal")
    if font_score["penalty"] > 0:
        flags.append("font_signal")
    if tamper_score["penalty"] > 0:
        flags.append("image_signal")

    scoring_breakdown = [metadata_score, ocr_score, font_score, tamper_score]
    explanation = "; ".join([
        f"{item['category']}: {', '.join(item['evidence']) if item['evidence'] else 'no issues detected'}"
        for item in scoring_breakdown
    ])

    result = {
        "score": score,
        "risk_level": risk_level,
        "confidence": confidence,
        "flags": sorted(set(flags)),
        "tamper_signals": tamper_signals,
        "avg_ocr_confidence": avg_confidence,
        "scoring_breakdown": scoring_breakdown,
        "recommendation": recommendation,
        "explanation": explanation,
        "text": extracted_text[:10000],
    }

    return result
