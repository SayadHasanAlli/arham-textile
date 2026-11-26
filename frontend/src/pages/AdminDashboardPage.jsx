import { useEffect, useState } from "react";
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
import { Users, Package, IndianRupee, Calendar, ClipboardList, TrendingUp } from "lucide-react";
import api from "../services/api";
import { formatINR, formatQty } from "../utils/format";

const PIE_COLORS = ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900 mt-3">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate] = useState(todayStr);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/dashboard/admin", {
        params: { start_date: startDate, end_date: endDate },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [startDate, endDate]);

  if (loading && !data) {
    return <div className="text-sm text-slate-500 py-12 text-center">Loading dashboard analytics...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>;
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Live production overview from PostgreSQL</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1"
          />
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Workers" value={s.total_workers} icon={Users} />
        <StatCard label="Today's Production" value={`${formatQty(s.today_production)} pcs`} icon={Package} />
        <StatCard label="Today's Wages" value={formatINR(s.today_earnings)} icon={IndianRupee} />
        <StatCard label="Production This Month" value={`${formatQty(s.month_production)} pcs`} icon={Calendar} />
        <StatCard label="Payout This Month" value={formatINR(s.month_earnings)} icon={TrendingUp} />
        <StatCard label="Total Production Records" value={s.total_records} icon={ClipboardList} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Daily Production Overview</h2>
          {data.daily_production.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">No production records in selected range.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_production}>
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
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Worker-Wise Production Comparison</h2>
          {data.worker_comparison.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">No worker production data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.worker_comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
          {data.type_distribution.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">No production type data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.type_distribution}
                    dataKey="quantity"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label
                  >
                    {data.type_distribution.map((_, idx) => (
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
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Vendor-Wise Production & Monthly Earnings</h2>
          {data.vendor_production.length === 0 && data.monthly_earnings.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">No vendor or monthly earnings data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_earnings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Bar dataKey="earnings" fill="#334155" radius={[4, 4, 0, 0]} name="Monthly Earnings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Recent Production Activity</h2>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No production records yet. Add rates in Production Pricing, then log entries in Phase 3.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Worker</th>
                  <th className="px-5 py-3">Production Type</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_activity.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">{r.production_date}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{r.worker_name}</td>
                    <td className="px-5 py-3">{r.production_type}</td>
                    <td className="px-5 py-3">{r.vendor_name}</td>
                    <td className="px-5 py-3 text-right">{formatQty(r.quantity)}</td>
                    <td className="px-5 py-3 text-right">{formatINR(r.rate_per_piece)}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatINR(r.total_price)}</td>
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
