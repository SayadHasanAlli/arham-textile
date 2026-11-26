import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, KeyRound, UserCheck, UserX, ArrowUpRight } from "lucide-react";
import api from "../services/api";
import { formatINR, formatQty } from "../utils/format";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    joining_date: new Date().toISOString().split("T")[0],
    username: "",
    password: "",
  });

  const [credWorker, setCredWorker] = useState(null);
  const [credForm, setCredForm] = useState({ username: "", password: "" });

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/workers");
      setWorkers(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load workers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = {
        full_name: form.full_name,
        phone_number: form.phone_number || null,
        joining_date: form.joining_date || null,
        username: form.username || null,
        password: form.password || null,
      };
      await api.post("/api/workers", payload);
      setSuccess("Worker added successfully.");
      setShowAdd(false);
      setForm({
        full_name: "",
        phone_number: "",
        joining_date: new Date().toISOString().split("T")[0],
        username: "",
        password: "",
      });
      loadWorkers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add worker.");
    }
  };

  const toggleStatus = async (worker) => {
    setError("");
    try {
      const nextStatus = worker.status === "active" ? "inactive" : "active";
      await api.put(`/api/workers/${worker.id}`, { status: nextStatus });
      setSuccess(`Worker ${worker.full_name} marked ${nextStatus}.`);
      loadWorkers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status.");
    }
  };

  const handleCredSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.put(`/api/workers/${credWorker.id}/credentials`, credForm);
      setSuccess(`Login credentials updated for ${credWorker.full_name}.`);
      setCredWorker(null);
      setCredForm({ username: "", password: "" });
      loadWorkers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update credentials.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Worker Management</h1>
          <p className="text-sm text-slate-500">Click any worker to view their full profile, analytics, and history</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          Add Worker
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">New Worker</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g., Hasan"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Joining Date</label>
              <input
                type="date"
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Login Username (optional)</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Min 3 chars"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Login Password (optional)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 chars"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">
              Save Worker
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading workers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => (
            <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/admin/workers/${w.id}`} className="group">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:underline inline-flex items-center gap-1">
                      {w.full_name}
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                    </h3>
                    <p className="text-xs text-slate-500">
                      Login: {w.username || "Not configured"} • Joined {w.joining_date}
                    </p>
                  </Link>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      w.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {w.status}
                  </span>
                </div>

                <Link
                  to={`/admin/workers/${w.id}`}
                  className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-sm"
                >
                  <div>
                    <p className="text-xs text-slate-500">Total Qty</p>
                    <p className="font-semibold text-slate-900">{formatQty(w.total_quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Earnings</p>
                    <p className="font-semibold text-slate-900">{formatINR(w.total_earnings)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Records</p>
                    <p className="font-medium text-slate-700">{w.total_records}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Latest Date</p>
                    <p className="font-medium text-slate-700">{w.latest_production_date || "—"}</p>
                  </div>
                </Link>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setCredWorker(w);
                    setCredForm({ username: w.username || "", password: "" });
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Credentials
                </button>
                <button
                  onClick={() => toggleStatus(w)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {w.status === "active" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {w.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {credWorker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCredSubmit} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Set Login Credentials — {credWorker.full_name}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
              <input
                required
                minLength={3}
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={credForm.password}
                onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCredWorker(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">
                Save Credentials
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
