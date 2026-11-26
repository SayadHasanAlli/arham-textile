import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../services/api";
import { formatINR, formatQty } from "../utils/format";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/vendors");
      setVendors(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.post("/api/vendors", { vendor_name: vendorName });
      setVendorName("");
      setSuccess("Vendor added successfully.");
      loadVendors();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add vendor.");
    }
  };

  const toggleStatus = async (vendor) => {
    setError("");
    try {
      const nextStatus = vendor.status === "active" ? "inactive" : "active";
      await api.put(`/api/vendors/${vendor.id}`, { status: nextStatus });
      setSuccess(`Vendor ${vendor.vendor_name} marked ${nextStatus}.`);
      loadVendors();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update vendor.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Vendor Management</h1>
        <p className="text-sm text-slate-500">Manage textile vendors and track vendor-wise production value</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          required
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="Add new vendor name..."
          className="flex-1 px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </form>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          Loading vendors...
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {vendors.map((v) => (
              <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{v.vendor_name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-slate-500">Records</p>
                    <p className="font-medium text-slate-900">{v.total_records}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Quantity</p>
                    <p className="font-medium text-slate-900">{formatQty(v.total_quantity)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total Pay-Out</p>
                    <p className="font-semibold text-slate-900">{formatINR(v.total_value)}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleStatus(v)}
                  className="w-full py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {v.status === "active" ? "Deactivate Vendor" : "Activate Vendor"}
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Vendor Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Records</th>
                    <th className="px-5 py-3 text-right">Total Quantity</th>
                    <th className="px-5 py-3 text-right">Total Value</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{v.vendor_name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            v.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">{v.total_records}</td>
                      <td className="px-5 py-3 text-right">{formatQty(v.total_quantity)}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatINR(v.total_value)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => toggleStatus(v)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                        >
                          {v.status === "active" ? "Deactivate" : "Activate"}
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
    </div>
  );
}
