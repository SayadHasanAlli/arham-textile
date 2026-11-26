import { useEffect, useState } from "react";
import { Plus, History } from "lucide-react";
import api from "../services/api";
import { formatINR } from "../utils/format";

export default function PricingPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [rateInputs, setRateInputs] = useState({});
  const [historyModal, setHistoryModal] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/pricing/types");
      setTypes(res.data);
      const initial = {};
      res.data.forEach((t) => {
        initial[t.id] = t.current_rate !== null ? String(t.current_rate) : "";
      });
      setRateInputs(initial);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load production pricing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const handleAddType = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.post("/api/pricing/types", {
        production_name: newName,
        initial_rate: newRate !== "" ? Number(newRate) : null,
      });
      setNewName("");
      setNewRate("");
      setSuccess("Production type added.");
      loadTypes();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add production type.");
    }
  };

  const handleUpdateRate = async (typeId, name) => {
    setError("");
    setSuccess("");
    const val = rateInputs[typeId];
    if (val === "" || Number(val) < 0) {
      setError("Please enter a valid non-negative rate.");
      return;
    }
    try {
      await api.post(`/api/pricing/types/${typeId}/rate`, { rate_per_piece: Number(val) });
      setSuccess(`Updated rate for ${name} to ${formatINR(val)}. Previous production records remain unchanged.`);
      loadTypes();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update rate.");
    }
  };

  const openHistory = async (pt) => {
    try {
      const res = await api.get(`/api/pricing/types/${pt.id}/history`);
      setHistoryModal({ name: pt.production_name, items: res.data });
    } catch {
      setError("Failed to load rate history.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Production Pricing</h1>
        <p className="text-sm text-slate-500">
          Configure garment rates per piece. Updating a rate only applies to new entries—historical records never change.
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={handleAddType} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New production type (e.g., Sherwani)"
          className="flex-1 px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={newRate}
          onChange={(e) => setNewRate(e.target.value)}
          placeholder="Initial Rate (₹, optional)"
          className="sm:w-52 px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          Add Type
        </button>
      </form>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          Loading production types...
        </div>
      ) : (
        <>
          {/* Mobile View: Stacked Cards */}
          <div className="space-y-3 md:hidden">
            {types.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{t.production_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Current:{" "}
                      {t.current_rate !== null ? (
                        <span className="font-semibold text-slate-900">{formatINR(t.current_rate)}</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Not set</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => openHistory(t)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateInputs[t.id] ?? ""}
                    onChange={(e) => setRateInputs({ ...rateInputs, [t.id]: e.target.value })}
                    placeholder="Enter ₹"
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => handleUpdateRate(t.id, t.production_name)}
                    className="shrink-0 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                  >
                    Save Rate
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Scrollable Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Production Type</th>
                    <th className="px-5 py-3">Current Rate</th>
                    <th className="px-5 py-3">Update Rate (₹)</th>
                    <th className="px-5 py-3 text-right">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {types.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">{t.production_name}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {t.current_rate !== null ? (
                          <span className="font-semibold text-slate-900">{formatINR(t.current_rate)}</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">Not set</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={rateInputs[t.id] ?? ""}
                            onChange={(e) => setRateInputs({ ...rateInputs, [t.id]: e.target.value })}
                            placeholder="Enter ₹"
                            className="w-32 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => handleUpdateRate(t.id, t.production_name)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
                          >
                            Save Rate
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openHistory(t)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {historyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Rate History — {historyModal.name}
            </h3>
            {historyModal.items.length === 0 ? (
              <p className="text-sm text-slate-500">No rates configured yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-sm">
                {historyModal.items.map((item) => (
                  <li key={item.id} className="py-2 flex justify-between">
                    <span className="font-medium text-slate-900">{formatINR(item.rate_per_piece)}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.effective_from).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setHistoryModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}