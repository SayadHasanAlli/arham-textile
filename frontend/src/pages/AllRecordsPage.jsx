import { useEffect, useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import api from "../services/api";
import { formatINR, formatQty } from "../utils/format";
import ExportReportModal from "../components/ExportReportModal";

export default function AllRecordsPage() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total_records: 0, total_quantity: 0, total_earnings: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [workers, setWorkers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [types, setTypes] = useState([]);

  const [workerSearch, setWorkerSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("production_date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/api/workers"),
      api.get("/api/vendors"),
      api.get("/api/pricing/types"),
    ])
      .then(([wRes, vRes, tRes]) => {
        setWorkers(wRes.data);
        setVendors(vRes.data);
        setTypes(tRes.data);
      })
      .catch(() => {});
  }, []);

  const fetchRecords = async (targetPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: targetPage,
        page_size: 20,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (workerSearch.trim()) params.worker_search = workerSearch.trim();
      if (vendorSearch.trim()) params.vendor_search = vendorSearch.trim();
      if (typeId) params.production_type_id = Number(typeId);
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get("/api/production", { params });
      setRecords(res.data.items);
      setSummary(res.data.summary);
      setPage(res.data.page);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load production records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [workerSearch, vendorSearch, typeId, startDate, endDate, sortBy, sortOrder]);

  const clearFilters = () => {
    setWorkerSearch("");
    setVendorSearch("");
    setTypeId("");
    setStartDate("");
    setEndDate("");
    setSortBy("production_date");
    setSortOrder("desc");
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete record #${record.id} (${record.worker_name} - ${record.production_type_name})?`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await api.delete(`/api/production/${record.id}`);
      setSuccess(`Record #${record.id} deleted.`);
      fetchRecords(page);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete record.");
    }
  };

  const openEdit = (r) => {
    setEditing({
      id: r.id,
      production_date: r.production_date,
      worker_id: String(r.worker_id),
      vendor_id: String(r.vendor_id),
      production_type_id: String(r.production_type_id),
      original_type_id: String(r.production_type_id),
      rate_per_piece: r.rate_per_piece,
      quantity: String(r.quantity),
      notes: r.notes || "",
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/api/production/${editing.id}`, {
        production_date: editing.production_date,
        worker_id: Number(editing.worker_id),
        vendor_id: Number(editing.vendor_id),
        production_type_id: Number(editing.production_type_id),
        quantity: Number(editing.quantity),
        notes: editing.notes,
      });
      setSuccess(`Record #${editing.id} updated.`);
      setEditing(null);
      fetchRecords(page);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update record.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">All Production Records</h1>
          <p className="text-sm text-slate-500">Search, filter, sort, edit, and export all worker production entries</p>
        </div>
        <ExportReportModal
          endpoint="/api/exports/all"
          title="Export All Production Records"
          buttonLabel="Export Report"
        />
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Records</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{summary.total_records}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Quantity</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatQty(summary.total_quantity)} pcs</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Wages</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatINR(summary.total_earnings)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            placeholder="Search worker..."
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            placeholder="Search vendor..."
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Production Types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.production_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Start Date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="End Date"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="production_date">Date</option>
              <option value="quantity">Quantity</option>
              <option value="total_price">Total Price</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="desc">Newest / Highest</option>
              <option value="asc">Oldest / Lowest</option>
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Loading records...
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          No production records match your current filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {records.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{r.worker_name}</p>
                    <p className="text-xs text-slate-500">
                      #{r.id} • {r.production_date} • {r.vendor_name}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatINR(r.total_price)}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{r.production_type_name}</span>
                  <span>
                    {formatQty(r.quantity)} × {formatINR(r.rate_per_piece)}
                  </span>
                </div>
                {r.notes && <p className="text-xs text-slate-500 italic">{r.notes}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openEdit(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Production Type</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total Price</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">#{r.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.production_date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{r.worker_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.production_type_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.vendor_name}</td>
                      <td className="px-4 py-3 text-right">{formatQty(r.quantity)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(r.rate_per_piece)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatINR(r.total_price)}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{r.notes || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="p-1.5 text-slate-400 hover:text-red-600 ml-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
            <span className="text-slate-500">
              Page <span className="font-medium text-slate-900">{page}</span> of{" "}
              <span className="font-medium text-slate-900">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchRecords(page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchRecords(page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Edit Record #{editing.id}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editing.production_date}
                  onChange={(e) => setEditing({ ...editing, production_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Worker</label>
                <select
                  value={editing.worker_id}
                  onChange={(e) => setEditing({ ...editing, worker_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
                <select
                  value={editing.vendor_id}
                  onChange={(e) => setEditing({ ...editing, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Production Type</label>
                <select
                  value={editing.production_type_id}
                  onChange={(e) => setEditing({ ...editing, production_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.production_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {editing.production_type_id === editing.original_type_id
                    ? `Keeps original historical rate (${formatINR(editing.rate_per_piece)}).`
                    : "Changing production type will apply that type's current active rate."}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
