import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from typing import List, Dict, Any, Optional
import re


ATTRIBUTES = ["nose", "lips", "head", "neck", "hump", "eyelashes", "ear"]

ATTR_NAMES_AR = {
    "nose": "الأنف",
    "lips": "الشفاه",
    "head": "الرأس",
    "neck": "الرقبة",
    "hump": "السنام",
    "eyelashes": "الرموش",
    "ear": "الأذن",
}

# ترتيب الأعمدة كما طلبه المستخدم:
# رقم الناقة | النقاط | التباعد | الرقبة | الشفاه | الأنف | الرأس | الرموش | الأذن | السنام
IMPORT_COLUMNS = [
    ("رقم الناقة", "number"),
    ("النقاط",     "points"),
    ("التباعد",    "spacing"),
    ("الرقبة",     "neck"),
    ("الشفاه",     "lips"),
    ("الأنف",      "nose"),
    ("الرأس",      "head"),
    ("الرموش",     "eyelashes"),
    ("الأذن",      "ear"),
    ("السنام",     "hump"),
]

# All recognized column headers for import (extended to handle variations)
COLUMN_MAP_AR = {
    "رقم الناقة": "number", "رقم": "number",
    "الاسم": "name", "اسم": "name",
    "الجنس": "gender",
    "اللون": "color", "السلالة": "color",
    "المنقية": "stable_name", "الإسطبل": "stable_name",
    "المالك": "owner",
    "النقاط": "points", "المواصفات": "points",
    "التباعد": "spacing",
    "التناسق": "harmony",
    "الأنف": "nose", "انف": "nose", "الانف": "nose",
    "الشفاه": "lips", "الشفة": "lips", "الشفه": "lips",
    "الرأس": "head", "الراس": "head",
    "الرقبة": "neck", "الرقبه": "neck",
    "السنام": "hump", "سنام": "hump",
    "الرموش": "eyelashes", "رموش": "eyelashes",
    "الأذن": "ear", "الاذن": "ear", "الأذون": "ear",
    "الحالة": "status",
    "ملاحظات": "notes",
}

# Column special colors (header fill color hex)
COLUMN_COLORS = {
    "number":    "2C3E50",   # dark navy   - رقم الناقة
    "name":      "2C3E50",   # dark navy   - الاسم
    "points":    "1A5276",   # dark blue   - النقاط
    "spacing":   "1A5276",   # dark blue   - التباعد
    "neck":      "145A32",   # dark green  - الرقبة
    "lips":      "145A32",   # dark green  - الشفاه
    "nose":      "145A32",   # dark green  - الأنف
    "head":      "7D6608",   # gold/yellow - الرأس  ← مميز بالذهبي
    "eyelashes": "145A32",   # dark green  - الرموش
    "ear":       "145A32",   # dark green  - الأذن
    "hump":      "145A32",   # dark green  - السنام
}

NUMERIC_FIELDS = {"points", "spacing", "nose", "lips", "head", "neck", "hump", "eyelashes", "ear"}


def _make_border():
    s = Side(style='thin', color='AAAAAA')
    return Border(left=s, right=s, top=s, bottom=s)


def generate_import_template() -> bytes:
    """
    Generate an empty Excel template with the exact column layout requested:
    رقم الناقة | النقاط | التباعد | الرقبة | الشفاه | الأنف | الرأس | الرموش | الأذن | السنام
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "نياق"
    ws.sheet_view.rightToLeft = True

    center = Alignment(horizontal='center', vertical='center')
    border = _make_border()

    # ─── Header Row ───────────────────────────────────────────
    for col_idx, (ar_name, field) in enumerate(IMPORT_COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=ar_name)
        fill_color = COLUMN_COLORS.get(field, "2C3E50")
        cell.font = Font(name='Arial', bold=True, color='FFFFFF', size=12)
        cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
        cell.alignment = center
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = 13

    # ─── Sample guide row (row 2 grayed out as example) ───────
    sample = [1, 1854, 4, 264, 267, 265, 265, 265, 265, 263]
    for col_idx, val in enumerate(sample, start=1):
        cell = ws.cell(row=2, column=col_idx, value=val)
        cell.font = Font(name='Arial', color='888888', italic=True, size=11)
        cell.fill = PatternFill(start_color='F0F0F0', end_color='F0F0F0', fill_type='solid')
        cell.alignment = center
        cell.border = border

    # ─── Empty data rows (3-52) ────────────────────────────────
    for row_idx in range(3, 52):
        for col_idx in range(1, len(IMPORT_COLUMNS) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.alignment = center
            cell.border = border
            # Alternate row shading
            if row_idx % 2 == 0:
                cell.fill = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')

    # ─── Row heights ───────────────────────────────────────────
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 22

    # ─── Freeze top row ────────────────────────────────────────
    ws.freeze_panes = 'A2'

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_camels_to_excel(camels: List[Dict[str, Any]], format: str = "rows") -> bytes:
    """Export camels to Excel using the standard import column order."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "النياق"
    ws.sheet_view.rightToLeft = True

    center = Alignment(horizontal='center', vertical='center')
    border = _make_border()

    if format == "columns":
        # ─── Columns format: each camel is a column ───────────
        row_fields = [
            ("رقم الناقة", "number"),
            ("الاسم",      "name"),
            ("النقاط",     "points"),
            ("التباعد",    "spacing"),
            ("الرقبة",     "neck"),
            ("الشفاه",     "lips"),
            ("الأنف",      "nose"),
            ("الرأس",      "head"),
            ("الرموش",     "eyelashes"),
            ("الأذن",      "ear"),
            ("السنام",     "hump"),
        ]
        # Header row: first cell = "الصفة", then camel numbers
        ws.cell(row=1, column=1, value="الصفة").font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
        ws.cell(row=1, column=1).fill = PatternFill(start_color='2C3E50', end_color='2C3E50', fill_type='solid')
        ws.cell(row=1, column=1).alignment = center
        ws.cell(row=1, column=1).border = border
        ws.column_dimensions['A'].width = 15

        for col_idx, camel in enumerate(camels, start=2):
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = 14
            lbl = f"ناقة {camel.get('number', col_idx - 1)}"
            cell = ws.cell(row=1, column=col_idx, value=lbl)
            cell.font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
            cell.fill = PatternFill(start_color='1A5276', end_color='1A5276', fill_type='solid')
            cell.alignment = center
            cell.border = border

        for row_idx, (ar_name, field) in enumerate(row_fields, start=2):
            label_cell = ws.cell(row=row_idx, column=1, value=ar_name)
            fill_color = COLUMN_COLORS.get(field, "2C3E50")
            label_cell.font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
            label_cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
            label_cell.alignment = center
            label_cell.border = border
            ws.row_dimensions[row_idx].height = 22

            for col_idx, camel in enumerate(camels, start=2):
                val = camel.get(field)
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name='Arial', size=11)
                cell.alignment = center
                cell.border = border
                if row_idx % 2 == 0:
                    cell.fill = PatternFill(start_color='EBF5FB', end_color='EBF5FB', fill_type='solid')

        ws.row_dimensions[1].height = 28
        ws.freeze_panes = 'B2'

    else:
        # ─── Rows format: each camel is a row ─────────────────
        cols = [
            ("رقم الناقة", "number"),
            ("الاسم",      "name"),
            ("النقاط",     "points"),
            ("التباعد",    "spacing"),
            ("الرقبة",     "neck"),
            ("الشفاه",     "lips"),
            ("الأنف",      "nose"),
            ("الرأس",      "head"),
            ("الرموش",     "eyelashes"),
            ("الأذن",      "ear"),
            ("السنام",     "hump"),
        ]

        # Header row
        for col_idx, (ar_name, field) in enumerate(cols, start=1):
            cell = ws.cell(row=1, column=col_idx, value=ar_name)
            fill_color = COLUMN_COLORS.get(field, "2C3E50")
            cell.font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
            cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
            cell.alignment = center
            cell.border = border
            ws.column_dimensions[get_column_letter(col_idx)].width = 14

        # Data rows
        for row_idx, camel in enumerate(camels, start=2):
            ws.row_dimensions[row_idx].height = 22
            for col_idx, (_, field) in enumerate(cols, start=1):
                val = camel.get(field)
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name='Arial', size=11)
                cell.alignment = center
                cell.border = border
                if row_idx % 2 == 0:
                    cell.fill = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')

        ws.row_dimensions[1].height = 28
        ws.freeze_panes = 'A2'

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

def import_camels_from_excel(file_bytes: bytes, stable_id: Optional[int] = None) -> Dict[str, Any]:
    """Import camels from Excel file. Supports both row and column formats."""
    try:
        wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
        ws = wb.active
    except Exception as e:
        return {"error": str(e), "camels": [], "errors": []}

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"camels": [], "errors": ["الملف فارغ"]}

    header_row = rows[0]

    imported_camels = []
    errors = []

    # ─── Normalize Arabic helper ──────────────────────────────────────────────
    def norm(t: str) -> str:
        t = t.strip()
        t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        t = t.replace("ه", "ة")
        t = t.replace("ى", "ي")
        return t

    # ─── Field map with normalized keys (handles ALL Arabic variants) ─────────
    FIELD_MAP_NORM = {
        norm("النقاط"):     "points",
        norm("المواصفات"):  "points",
        norm("التباعد"):    "spacing",
        norm("الرقبة"):     "neck",
        norm("الشفاه"):     "lips",
        norm("الشفة"):      "lips",
        norm("الأنف"):      "nose",
        norm("الانف"):      "nose",
        norm("الرأس"):      "head",
        norm("الراس"):      "head",
        norm("الرموش"):     "eyelashes",
        norm("الأذن"):      "ear",
        norm("الاذن"):      "ear",
        norm("السنام"):     "hump",
        norm("رقم الناقة"): "number",
        norm("الاسم"):      "name",
    }

    # ─── Detect format: column or row ────────────────────────────────────────
    # Column format detected when data rows have attribute labels in column 0
    ATTR_LABELS_NORM = {norm(x) for x in [
        "النقاط", "التباعد", "الرقبة", "الشفاه", "الشفة",
        "الأنف", "الانف", "الرأس", "الراس", "الرموش",
        "الأذن", "الاذن", "السنام", "المواصفات"
    ]}

    attr_label_count = sum(
        1 for row in rows[1:]
        if row and norm(str(row[0] or "")) in ATTR_LABELS_NORM
    )
    is_column_format = (attr_label_count >= 3)

    if is_column_format:
        # ─── Column format: col0=labels, col1+=camel values ───────────────────
        camel_headers = [
            str(h).strip() for h in header_row[1:]
            if h is not None and str(h).strip() != ""
        ]
        n = len(camel_headers)
        if n == 0:
            return {"camels": [], "errors": ["لم يتم العثور على أسماء النياق في صف الترويسة"]}

        camel_data: list = [{} for _ in range(n)]

        for row in rows[1:]:
            if not row or row[0] is None:
                continue
            label_norm = norm(str(row[0]))
            field = FIELD_MAP_NORM.get(label_norm)
            if not field:
                continue
            for i, val in enumerate(row[1: n + 1]):
                try:
                    if val is None or str(val).strip() == "":
                        camel_data[i][field] = None
                    else:
                        camel_data[i][field] = int(float(str(val)))
                except (ValueError, TypeError):
                    camel_data[i][field] = str(val).strip() if field == "name" else None

        for i, hdr in enumerate(camel_headers):
            c = camel_data[i]
            if not c.get("number"):
                c["number"] = hdr.replace("ناقة ", "").strip()
            c["stable_id"] = stable_id
            # Skip placeholder rows (number=0 and all attrs=0)
            attr_vals = [c.get(f) for f in ["points", "nose", "lips", "head", "neck", "hump", "eyelashes", "ear"]]
            if all(v is None or v == 0 for v in attr_vals) and str(c.get("number", "")).strip() in ("0", ""):
                continue
            imported_camels.append(c)

    else:
        # ─── Row format: each row = one camel ─────────────────────────────────
        col_mapping: Dict[str, int] = {}
        for col_idx, header in enumerate(header_row):
            h_norm = norm(str(header or ""))
            field = FIELD_MAP_NORM.get(h_norm)
            if field:
                col_mapping[field] = col_idx

        if not col_mapping:
            errors.append("لم يتم التعرف على أعمدة الملف. تأكد من أن الترويسة تطابق النموذج.")
            return {"camels": [], "errors": errors}

        for row_idx, row in enumerate(rows[1:], start=2):
            if all(v is None or str(v).strip() == "" for v in row):
                continue
            try:
                camel: Dict[str, Any] = {}
                for field, col_idx in col_mapping.items():
                    val = row[col_idx] if col_idx < len(row) else None
                    if field in NUMERIC_FIELDS:
                        try:
                            camel[field] = int(float(str(val))) if val is not None and str(val).strip() != "" else None
                        except (ValueError, TypeError):
                            camel[field] = None
                    else:
                        camel[field] = str(val).strip() if val is not None else None

                if not camel.get("number"):
                    camel["number"] = str(row_idx - 1)

                camel["stable_id"] = stable_id

                # Validate: must have at least رقم or one attribute value
                has_data = any(camel.get(f) for f in ["number", "points", "nose", "head", "neck"])
                if has_data:
                    imported_camels.append(camel)

            except Exception as e:
                errors.append(f"صف {row_idx}: {str(e)}")

    return {
        "total_rows": len(rows) - 1,
        "camels": imported_camels,
        "errors": errors,
    }
