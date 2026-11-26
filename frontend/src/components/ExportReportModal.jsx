import { useState } from "react";
import { Download, X, FileSpreadsheet, FileText, File } from "lucide-react";
import api from "../services/api";

const PERIODS = [
  { id: "1w", label: "Last 1 Week" },
  { id: "2w", label: "Last 2 Weeks" },
  { id: "30d", label: "Last 30 Days" },
  { id: "3m", label: "Last 3 Months" },
];

const FORMATS = [
  { id: "xlsx", label: "Excel (.xlsx)", desc: "Summary + Records sheets", icon: FileSpreadsheet },
  { id: "csv", label: "CSV (.csv)", desc: "Plain spreadsheet data", icon: FileText },
  { id: "pdf", label: "PDF (.pdf)", desc: "Print-ready business report", icon: File },
];

export default function ExportReportModal({ endpoint, title = "Export Production Report", buttonLabel = "Export Report" }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [format, setFormat] = useState("xlsx");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const response = await api.get(endpoint, {
        params: { period, format },
        responseType: "blob",
      });

      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `arham_report_${period}.${format}`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError("Failed to export report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
      >
        <Download className="w-4 h-4" />
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                Reporting Period
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      period === p.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                File Format
              </label>
              <div className="space-y-2">
                {FORMATS.map(({ id, label, desc, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormat(id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                      format === id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-slate-700 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading ? "Generating..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
