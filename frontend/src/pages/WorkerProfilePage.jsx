import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowLeft, Package, IndianRupee, Calendar, TrendingUp, Wallet } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatINR, formatQty } from "../utils/format";
import ExportReportModal from "../components/ExportReportModal";

const PIE_COLORS = ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900 mt-3">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function WorkerProfilePage() {
  const { workerId } = useParams();
  const { user } = useAuth();
  const isAdminView = user?.role === "admin" && Boolean(workerId);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("production_date");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isAdminView ? `/api/workers/${workerId}/profile` : "/api/workers/me/profile";
      const params = { sort_by: sortBy, sort_order: sortOrder };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get(endpoint, { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load worker profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [workerId, startDate, endDate, sortBy, sortOrder]);

  if (loading && !data) {
    return <div className="text-sm text-slate-500 py-12 text-center">Loading worker profile...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        {isAdminView && (
          <Link to="/admin/workers" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back to Workers
          </Link>
        )}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const { worker, summary, daily_production, monthly_production, type_distribution, history } = data;
  const exportEndpoint = isAdminView ? `/api/exports/worker/${worker.id}` : "/api/exports/me";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {isAdminView && (
            <Link
              to="/admin/workers"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Workers
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-900">{worker.full_name}</h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                worker.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {worker.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Joined {worker.joining_date}
            {worker.phone_number ? ` • ${worker.phone_number}` : ""}
            {` • ${summary.total_records} total records`}
          </p>
        </div>

        <ExportReportModal
          endpoint={exportEndpoint}
          title={`Export Report — ${worker.full_name}`}
          buttonLabel="Export Report"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Production"
          value={`${formatQty(summary.total_production)} pcs`}
          icon={Package}
        />
        <StatCard
          label="Total Earnings"
          value={formatINR(summary.total_earnings)}
          icon={IndianRupee}
        />
        <StatCard
          label="Production This Week"
          value={`${formatQty(summary.week_production)} pcs`}
          sub={formatINR(summary.week_earnings)}
          icon={Calendar}
        />
        <StatCard
          label="Production This Month"
          value={`${formatQty(summary.month_production)} pcs`}
          sub={formatINR(summary.month_earnings)}
          icon={TrendingUp}
        />
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Daily Production</h2>
          {daily_production.length === 0 ? (
            <p className="text-sm text-slate-400 py-14 text-center">No daily data in selected range.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily_production}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="quantity" stroke="#0f172a" fill="#e2e8f0" name="Quantity" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Monthly Production</h2>
          {monthly_production.length === 0 ? (
            <p className="text-sm text-slate-400 py-14 text-center">No monthly data yet.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly_production}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#0f172a" radius={[4, 4, 0, 0]} name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Production Type Distribution</h2>
          {type_distribution.length === 0 ? (
            <p className="text-sm text-slate-400 py-14 text-center">No production type data yet.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={type_distribution}
                    dataKey="quantity"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {type_distribution.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Earnings Overview (Monthly)</h2>
          {monthly_production.length === 0 ? (
            <p className="text-sm text-slate-400 py-14 text-center">No earnings data yet.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly_production}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Bar dataKey="earnings" fill="#334155" radius={[4, 4, 0, 0]} name="Earnings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Production History ({history.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              title="Start Date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              title="End Date"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="production_date">Sort: Date</option>
              <option value="quantity">Sort: Quantity</option>
              <option value="total_price">Sort: Total Price</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <StatCard label="Total Paid" value={formatINR(summary.total_paid)} icon={Wallet} />
        <StatCard
          label={Number(summary.pending_balance) >= 0 ? 'Pending Balance' : 'Advance Paid'}
          value={formatINR(Math.abs(summary.pending_balance))}
          icon={IndianRupee}
        />

        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            No production records found for this period.
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {history.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{r.production_type_name}</span>
                    <span className="font-semibold text-slate-900">{formatINR(r.total_price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {r.production_date} • {r.vendor_name}
                    </span>
                    <span>
                      {formatQty(r.quantity)} × {formatINR(r.rate_per_piece)}
                    </span>
                  </div>
                  {r.notes && <p className="text-xs text-slate-500 italic">{r.notes}</p>}
                </div>
              ))}
            </div>

            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Production Type</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Rate Per Piece</th>
                      <th className="px-4 py-3 text-right">Total Price</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">{r.production_date}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{r.production_type_name}</td>
                        <td className="px-4 py-3">{r.vendor_name}</td>
                        <td className="px-4 py-3 text-right">{formatQty(r.quantity)}</td>
                        <td className="px-4 py-3 text-right">{formatINR(r.rate_per_piece)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatINR(r.total_price)}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
