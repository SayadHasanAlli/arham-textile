import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import api from "../services/api";
import { formatINR, formatQty } from "../utils/format";

function getTodayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default function ProductionEntryPage() {
  const [workers, setWorkers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [types, setTypes] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const [productionDate, setProductionDate] = useState(getTodayIST());
  const [workerId, setWorkerId] = useState("");
  const [productionTypeId, setProductionTypeId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [wRes, vRes, tRes, rRes] = await Promise.all([
        api.get("/api/workers", { params: { active_only: true } }),
        api.get("/api/vendors", { params: { active_only: true } }),
        api.get("/api/pricing/types", { params: { active_only: true } }),
        api.get("/api/production/recent", { params: { limit: 15 } }),
      ]);
      setWorkers(wRes.data);
      setVendors(vRes.data);
      setTypes(tRes.data);
      setRecent(rRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load form data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedType = useMemo(
    () => types.find((t) => String(t.id) === String(productionTypeId)) || null,
    [types, productionTypeId]
  );

  const activeRate = selectedType?.current_rate ?? null;
  const qtyNum = Number(quantity);
  const calculatedTotal =
    activeRate !== null && !Number.isNaN(qtyNum) && qtyNum > 0
      ? Number(activeRate) * qtyNum
      : 0;

  const canSubmit =
    !submitting &&
    productionDate &&
    workerId &&
    vendorId &&
    productionTypeId &&
    activeRate !== null &&
    !Number.isNaN(qtyNum) &&
    qtyNum > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await api.post("/api/production", {
        production_date: productionDate,
        worker_id: Number(workerId),
        vendor_id: Number(vendorId),
        production_type_id: Number(productionTypeId),
        quantity: Number(quantity),
        notes: notes.trim() || null,
      });
      setSuccess(
        `Saved: ${res.data.worker_name} • ${res.data.production_type_name} (${formatQty(
          res.data.quantity
        )} × ${formatINR(res.data.rate_per_piece)} = ${formatINR(res.data.total_price)})`
      );
      setQuantity("");
      setNotes("");
      const rRes = await api.get("/api/production/recent", { params: { limit: 15 } });
      setRecent(rRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save production record.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this production record?")) return;
    setError("");
    try {
      await api.delete(`/api/production/${id}`);
      setRecent((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete record.");
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 py-12 text-center">Loading production entry form...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Production Entry</h1>
        <p className="text-sm text-slate-500">
          Record daily worker production. Rates are fetched automatically and locked per record.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
            <input
              type="date"
              required
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* 2. Worker */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Worker Name *</label>
            <select
              required
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Select worker...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Production Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Production Type *</label>
            <select
              required
              value={productionTypeId}
              onChange={(e) => setProductionTypeId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Select production type...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.production_name} {t.current_rate !== null ? `(${formatINR(t.current_rate)})` : "(No rate)"}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Quantity (Decimal) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity (decimals allowed) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 3.5"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* 5. Vendor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Name *</label>
            <select
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Select vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Auto Rate Per Piece */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rate Per Piece (Auto)</label>
            <div className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
              {selectedType ? (
                activeRate !== null ? (
                  formatINR(activeRate)
                ) : (
                  <span className="text-amber-700 text-xs">
                    Not configured —{" "}
                    <Link to="/admin/pricing" className="underline font-semibold">
                      Set rate
                    </Link>
                  </span>
                )
              ) : (
                <span className="text-slate-400">Select production type</span>
              )}
            </div>
          </div>
        </div>

        {/* 7. Notes + Auto Total Price */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Special order, urgent production"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-300">Total Price</span>
            <span className="text-lg font-semibold">{formatINR(calculatedTotal)}</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Saving..." : "SAVE PRODUCTION RECORD"}
          </button>
        </div>
      </form>

      {/* Recent Entries Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Entries</h2>
          <span className="text-xs text-slate-500">Latest {recent.length} records</span>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No production records saved yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{r.production_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.worker_name}</td>
                    <td className="px-4 py-3">{r.production_type_name}</td>
                    <td className="px-4 py-3">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-right">{formatQty(r.quantity)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(r.rate_per_piece)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatINR(r.total_price)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
