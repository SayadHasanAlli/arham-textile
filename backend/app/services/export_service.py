import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import ProductionRecord

IST = ZoneInfo("Asia/Kolkata")

PERIOD_CONFIG = {
    "1w": ("Last 1 Week", 7),
    "2w": ("Last 2 Weeks", 14),
    "30d": ("Last 30 Days", 30),
    "3m": ("Last 3 Months", 90),
}


def resolve_period(period: str) -> tuple[str, date, date]:
    if period not in PERIOD_CONFIG:
        raise ValueError("Invalid period. Choose from: 1w, 2w, 30d, 3m.")
    label, days = PERIOD_CONFIG[period]
    end_date = datetime.now(IST).date()
    start_date = end_date - timedelta(days=days - 1)
    return label, start_date, end_date


def _fmt_num(val: Decimal | float | int) -> str:
    return f"{Decimal(str(val)):,.2f}"


def _compute_summaries(records: list[ProductionRecord]) -> dict:
    total_qty = Decimal("0.00")
    total_earnings = Decimal("0.00")
    by_worker: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"qty": Decimal("0.00"), "earnings": Decimal("0.00"), "records": Decimal("0")}
    )
    by_type: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"qty": Decimal("0.00"), "earnings": Decimal("0.00"), "records": Decimal("0")}
    )
    by_vendor: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"qty": Decimal("0.00"), "earnings": Decimal("0.00"), "records": Decimal("0")}
    )

    for r in records:
        qty = Decimal(str(r.quantity))
        price = Decimal(str(r.total_price))
        total_qty += qty
        total_earnings += price

        w_name = r.worker.full_name
        t_name = r.production_type.production_name
        v_name = r.vendor.vendor_name

        by_worker[w_name]["qty"] += qty
        by_worker[w_name]["earnings"] += price
        by_worker[w_name]["records"] += 1

        by_type[t_name]["qty"] += qty
        by_type[t_name]["earnings"] += price
        by_type[t_name]["records"] += 1

        by_vendor[v_name]["qty"] += qty
        by_vendor[v_name]["earnings"] += price
        by_vendor[v_name]["records"] += 1

    return {
        "total_records": len(records),
        "total_qty": total_qty,
        "total_earnings": total_earnings,
        "by_worker": sorted(by_worker.items(), key=lambda x: x[1]["earnings"], reverse=True),
        "by_type": sorted(by_type.items(), key=lambda x: x[1]["qty"], reverse=True),
        "by_vendor": sorted(by_vendor.items(), key=lambda x: x[1]["earnings"], reverse=True),
    }


# ==================== CSV BUILDER ====================
def build_csv(
    records: list[ProductionRecord],
    title: str,
    period_label: str,
    start_date: date,
    end_date: date,
    worker_name: str | None = None,
) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["ARHAM TEXTILE - PRODUCTION REPORT"])
    writer.writerow(["Report", title])
    if worker_name:
        writer.writerow(["Worker", worker_name])
    writer.writerow(["Period", f"{period_label} ({start_date} to {end_date})"])
    writer.writerow(["Generated (IST)", datetime.now(IST).strftime("%Y-%m-%d %H:%M")])
    writer.writerow([])

    writer.writerow([
        "Production Date",
        "Worker Name",
        "Production Type",
        "Vendor Name",
        "Quantity",
        "Rate Per Piece (INR)",
        "Total Price (INR)",
        "Notes",
    ])
    for r in records:
        writer.writerow([
            r.production_date.isoformat(),
            r.worker.full_name,
            r.production_type.production_name,
            r.vendor.vendor_name,
            f"{Decimal(str(r.quantity)):.2f}",
            f"{Decimal(str(r.rate_per_piece)):.2f}",
            f"{Decimal(str(r.total_price)):.2f}",
            r.notes or "",
        ])

    # UTF-8 with BOM so Excel on Windows displays cleanly
    return buf.getvalue().encode("utf-8-sig")


# ==================== EXCEL (.XLSX) BUILDER ====================
def build_xlsx(
    records: list[ProductionRecord],
    title: str,
    period_label: str,
    start_date: date,
    end_date: date,
    worker_name: str | None = None,
) -> bytes:
    wb = Workbook()
    summary = _compute_summaries(records)

    dark_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    sub_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_bold = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    section_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    reg_font = Font(name="Calibri", size=10, color="1E293B")
    thin_side = Side(border_style="thin", color="CBD5E1")
    thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    inr_fmt = '₹#,##0.00'
    qty_fmt = '#,##0.00'

    # ----- Sheet 1: Summary -----
    ws_sum = wb.active
    ws_sum.title = "Summary"
    ws_sum["A1"] = "ARHAM TEXTILE — PRODUCTION REPORT"
    ws_sum["A1"].font = title_font
    ws_sum["A2"] = f"Report: {title}"
    ws_sum["A2"].font = bold_font
    ws_sum["A3"] = f"Period: {period_label} ({start_date} to {end_date})"
    ws_sum["A3"].font = reg_font
    row_idx = 4
    if worker_name:
        ws_sum[f"A{row_idx}"] = f"Worker: {worker_name}"
        ws_sum[f"A{row_idx}"].font = bold_font
        row_idx += 1
    ws_sum[f"A{row_idx}"] = f"Generated (IST): {datetime.now(IST).strftime('%Y-%m-%d %H:%M')}"
    ws_sum[f"A{row_idx}"].font = reg_font

    row_idx += 2
    ws_sum[f"A{row_idx}"] = "OVERALL SUMMARY"
    ws_sum[f"A{row_idx}"].font = section_font
    row_idx += 1

    kpi_rows = [
        ("Total Records", summary["total_records"], "#,##0"),
        ("Total Production Quantity", float(summary["total_qty"]), qty_fmt),
        ("Total Earnings", float(summary["total_earnings"]), inr_fmt),
    ]
    for label, val, num_fmt in kpi_rows:
        c1 = ws_sum.cell(row=row_idx, column=1, value=label)
        c2 = ws_sum.cell(row=row_idx, column=2, value=val)
        c1.font = bold_font
        c1.fill = sub_fill
        c1.border = thin_border
        c2.font = bold_font
        c2.number_format = num_fmt
        c2.alignment = Alignment(horizontal="right")
        c2.border = thin_border
        row_idx += 1

    def _write_breakdown(section_title: str, col1_header: str, items: list, start_row: int) -> int:
        r = start_row + 2
        ws_sum.cell(row=r, column=1, value=section_title).font = section_font
        r += 1
        headers = [col1_header, "Records", "Total Quantity", "Total Earnings"]
        for col_i, h in enumerate(headers, start=1):
            cell = ws_sum.cell(row=r, column=col_i, value=h)
            cell.font = white_bold
            cell.fill = dark_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="right" if col_i > 1 else "left")
        r += 1
        for idx, (name, metrics) in enumerate(items):
            fill = zebra_fill if idx % 2 == 1 else None
            vals = [name, int(metrics["records"]), float(metrics["qty"]), float(metrics["earnings"])]
            fmts = [None, "#,##0", qty_fmt, inr_fmt]
            for col_i, (v, fmt) in enumerate(zip(vals, fmts), start=1):
                c = ws_sum.cell(row=r, column=col_i, value=v)
                c.font = reg_font
                c.border = thin_border
                if fill:
                    c.fill = fill
                if fmt:
                    c.number_format = fmt
                    c.alignment = Alignment(horizontal="right")
            r += 1
        return r

    if not worker_name:
        row_idx = _write_breakdown("WORKER-WISE PRODUCTION SUMMARY", "Worker Name", summary["by_worker"], row_idx)
    row_idx = _write_breakdown("PRODUCTION TYPE SUMMARY", "Production Type", summary["by_type"], row_idx)
    row_idx = _write_breakdown("VENDOR-WISE SUMMARY", "Vendor Name", summary["by_vendor"], row_idx)

    for col_i, width in enumerate([30, 14, 18, 20], start=1):
        ws_sum.column_dimensions[get_column_letter(col_i)].width = width

    # ----- Sheet 2: Production Records -----
    ws_rec = wb.create_sheet(title="Production Records")
    headers = [
        "Production Date",
        "Worker Name",
        "Production Type",
        "Vendor Name",
        "Quantity",
        "Rate Per Piece",
        "Total Price",
        "Notes",
    ]
    for col_i, h in enumerate(headers, start=1):
        c = ws_rec.cell(row=1, column=col_i, value=h)
        c.font = white_bold
        c.fill = dark_fill
        c.border = thin_border
        c.alignment = Alignment(horizontal="right" if col_i in (5, 6, 7) else "left")

    for r_idx, rec in enumerate(records, start=2):
        fill = zebra_fill if r_idx % 2 == 1 else None
        row_vals = [
            rec.production_date.isoformat(),
            rec.worker.full_name,
            rec.production_type.production_name,
            rec.vendor.vendor_name,
            float(rec.quantity),
            float(rec.rate_per_piece),
            float(rec.total_price),
            rec.notes or "",
        ]
        fmts = [None, None, None, None, qty_fmt, inr_fmt, inr_fmt, None]
        for col_i, (val, fmt) in enumerate(zip(row_vals, fmts), start=1):
            c = ws_rec.cell(row=r_idx, column=col_i, value=val)
            c.font = reg_font
            c.border = thin_border
            if fill:
                c.fill = fill
            if fmt:
                c.number_format = fmt
                c.alignment = Alignment(horizontal="right")

    ws_rec.freeze_panes = "A2"
    ws_rec.auto_filter.ref = f"A1:H{max(1, len(records) + 1)}"
    for col_i, width in enumerate([16, 20, 22, 22, 12, 16, 16, 28], start=1):
        ws_rec.column_dimensions[get_column_letter(col_i)].width = width

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ==================== PDF (REPORTLAB) BUILDER ====================
def build_pdf(
    records: list[ProductionRecord],
    title: str,
    period_label: str,
    start_date: date,
    end_date: date,
    worker_name: str | None = None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleCustom", parent=styles["Heading1"], fontSize=15, textColor=colors.HexColor("#0F172A"), spaceAfter=4)
    sub_style = ParagraphStyle("SubCustom", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=2)
    h2_style = ParagraphStyle("H2Custom", parent=styles["Heading2"], fontSize=11, textColor=colors.HexColor("#0F172A"), spaceBefore=10, spaceAfter=4)
    cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=8, leading=10)

    summary = _compute_summaries(records)
    elements = []

    elements.append(Paragraph(f"ARHAM TEXTILE — {title}", title_style))
    meta_parts = [f"<b>Period:</b> {period_label} ({start_date} to {end_date})"]
    if worker_name:
        meta_parts.insert(0, f"<b>Worker:</b> {worker_name}")
    meta_parts.append(f"<b>Generated (IST):</b> {datetime.now(IST).strftime('%Y-%m-%d %H:%M')}")
    elements.append(Paragraph(" &nbsp;|&nbsp; ".join(meta_parts), sub_style))
    elements.append(Spacer(1, 6))

    # Overall KPI Box
    kpi_data = [
        ["Total Records", "Total Production Quantity", "Total Earnings"],
        [
            str(summary["total_records"]),
            f"{_fmt_num(summary['total_qty'])} pcs",
            f"Rs. {_fmt_num(summary['total_earnings'])}",
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[80 * mm, 90 * mm, 95 * mm])
    kpi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F8FAFC")),
            ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 1), (-1, 1), 11),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    elements.append(kpi_table)

    def _add_summary_table(heading: str, col_label: str, items: list):
        if not items:
            return
        elements.append(Paragraph(heading, h2_style))
        data = [[col_label, "Records", "Total Quantity", "Total Earnings"]]
        for name, m in items:
            data.append([name, str(int(m["records"])), _fmt_num(m["qty"]), f"Rs. {_fmt_num(m['earnings'])}"])
        t = Table(data, colWidths=[115 * mm, 35 * mm, 55 * mm, 60 * mm], repeatRows=1)
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t)

    if not worker_name:
        _add_summary_table("Worker-wise Production Summary", "Worker Name", summary["by_worker"])
    _add_summary_table("Production Type Summary", "Production Type", summary["by_type"])
    _add_summary_table("Vendor-wise Summary", "Vendor Name", summary["by_vendor"])

    # Detailed Records Table
    elements.append(Paragraph(f"Detailed Production Records ({len(records)})", h2_style))
    if not records:
        elements.append(Paragraph("No production records found for this reporting period.", sub_style))
    else:
        rec_data = [["Date", "Worker", "Production Type", "Vendor", "Qty", "Rate", "Total", "Notes"]]
        for r in records:
            rec_data.append([
                r.production_date.isoformat(),
                Paragraph(r.worker.full_name, cell_style),
                Paragraph(r.production_type.production_name, cell_style),
                Paragraph(r.vendor.vendor_name, cell_style),
                _fmt_num(r.quantity),
                f"Rs. {_fmt_num(r.rate_per_piece)}",
                f"Rs. {_fmt_num(r.total_price)}",
                Paragraph(r.notes or "-", cell_style),
            ])
        rec_table = Table(
            rec_data,
            colWidths=[24 * mm, 34 * mm, 42 * mm, 38 * mm, 20 * mm, 27 * mm, 30 * mm, 50 * mm],
            repeatRows=1,
        )
        rec_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (4, 0), (6, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(rec_table)

    doc.build(elements)
    return buf.getvalue()
