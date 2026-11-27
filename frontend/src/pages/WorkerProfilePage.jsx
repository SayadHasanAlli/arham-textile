import { Link, useParams } from "react-router-dom";
import { Fragment, useEffect, useState } from "react";
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
import {
  ArrowLeft,
  Package,
  IndianRupee,
  Calendar,
  TrendingUp,
  Wallet,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatINR, formatQty } from "../utils/format";
import ExportReportModal from "../components/ExportReportModal";
import WorkerPaymentHistory from "../components/WorkerPaymentHistory";

const PIE_COLORS = ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];

function formatResetDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OverallStat({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-base font-semibold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600">
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

export default function WorkerProfilePage() {
  const { workerId } = useParams();
  const { user } = useAuth();
  const isAdminView = user?.role === "admin" && Boolean(workerId);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("production_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [hideSettled, setHideSettled] = useState(false);
  const [page, setPage] = useState(1);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isAdminView ? `/api/workers/${workerId}/profile` : "/api/workers/me/profile";
      const params = {
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: 25,
        hide_settled: hideSettled,
      };
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
  }, [workerId, startDate, endDate, sortBy, sortOrder, hideSettled, page]);

  const handleResetCycle = async () => {
    if (!data?.worker) return;
    const ok = window.confirm(
      `Reset cycle for ${data.worker.full_name}?\n\nThis marks all current work as settled and starts a fresh cycle at 0 pieces. Any unpaid balance or advance will carry over automatically.`
    );
    if (!ok) return;

    setResetting(true);
    try {
      await api.post(`/api/workers/${data.worker.id}/reset-cycle`);
      setPage(1);
      await fetchProfile();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reset cycle.");
    } finally {
      setResetting(false);
    }
  };

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

  const {
    worker,
    summary,
    cycle,
    daily_production,
    monthly_production,
    type_distribution,
    history,
    history_pagination,
  } = data;

  const exportEndpoint = isAdminView ? `/api/exports/worker/${worker.id}` : "/api/exports/me";
  const netPayable = Number(cycle?.net_payable ?? summary.pending_balance ?? 0);
  const openingBalance = Number(cycle?.opening_balance ?? 0);
  const resetDateLabel = formatResetDate(cycle?.last_reset_at);

  const showDividerAt = (idx) => {
    if (!cycle?.last_reset_at || hideSettled || sortBy !== "production_date" || idx === 0) {
      return false;
    }
    return history[idx - 1].is_settled !== history[idx].is_settled;
  };

  const dividerText =
    sortOrder === "desc"
      ? `Current Cycle Above ▲  |  Cycle settled & reset on ${resetDateLabel} ▼`
      : `Cycle settled & reset on ${resetDateLabel} ▲  |  Current Cycle Below ▼`;

  return (
    <div className="space-y-6">
      {/* Header */}
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
            {resetDateLabel ? ` • Last reset ${resetDateLabel}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdminView && (
            <button
              onClick={handleResetCycle}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? "Resetting..." : "Reset Cycle"}
            </button>
          )}
          <ExportReportModal
            endpoint={exportEndpoint}
            title={`Export Report — ${worker.full_name}`}
            buttonLabel="Export Report"
          />
        </div>
      </div>

      {/* TIER 1 — Current Cycle Cards */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Current Payout Cycle {resetDateLabel ? `(Since ${resetDateLabel})` : "(All-Time)"}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Last Payout */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Last Payout</p>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            {cycle?.last_payout ? (
              <>
                <p className="text-2xl font-semibold text-slate-900 mt-3">
                  {formatINR(cycle.last_payout.amount)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {cycle.last_payout.payment_date} • {cycle.last_payout.payment_mode}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-slate-400 mt-3">No payouts yet</p>
                <p className="text-xs text-slate-400 mt-1">First payout will appear here</p>
              </>
            )}
          </div>

          {/* Card 2: Work Since Reset */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Work Since Reset</p>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <p className="text-2xl font-semibold text-slate-900">
                {formatQty(cycle?.cycle_production ?? 0)} pcs
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {formatINR(cycle?.cycle_earnings ?? 0)}
              </p>
            </div>
            {cycle?.garment_breakdown?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {cycle.garment_breakdown.map((g) => (
                  <span
                    key={g.name}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                  >
                    {g.name} - {formatQty(g.quantity)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">No work logged in current cycle</p>
            )}
          </div>

          {/* Card 3: Net Payable Now */}
          <div
            className={`border rounded-xl p-5 shadow-sm ${
              netPayable > 0
                ? "bg-emerald-50/60 border-emerald-200"
                : netPayable < 0
                ? "bg-amber-50/60 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
                {netPayable >= 0 ? "Net Payable Now" : "Advance Credit"}
              </p>
              <div className="p-2 rounded-lg bg-white/80 text-slate-700">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-3">
              {formatINR(Math.round(Math.abs(netPayable)))}
            </p>
            <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
              {openingBalance > 0 && (
                <p>Includes {formatINR(openingBalance)} Opening Pending</p>
              )}
              {openingBalance < 0 && (
                <p>After {formatINR(Math.abs(openingBalance))} Advance Carried Over</p>
              )}
              {openingBalance === 0 && <p>Clean cycle start (₹0 carry-over)</p>}
            </div>
          </div>
        </div>
      </div>

      {/* TIER 2 — Overall Totals Strip (Never Resets) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Overall Totals (Never Resets)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OverallStat
            label="This Week"
            value={`${formatQty(summary.week_production)} pcs`}
            sub={formatINR(summary.week_earnings)}
            icon={Calendar}
          />
          <OverallStat
            label="This Month"
            value={`${formatQty(summary.month_production)} pcs`}
            sub={formatINR(summary.month_earnings)}
            icon={TrendingUp}
          />
          <OverallStat
            label="All-Time Production"
            value={`${formatQty(summary.total_production)} pcs`}
            sub={formatINR(summary.total_earnings)}
            icon={Package}
          />
          <OverallStat
            label="All-Time Total Paid"
            value={formatINR(summary.total_paid)}
            sub="Total settled payouts"
            icon={Wallet}
          />
        </div>
      </div>

      {/* Charts */}
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
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Wages Overview (Monthly)</h2>
          {monthly_production.length === 0 ? (
            <p className="text-sm text-slate-400 py-14 text-center">No wages data yet.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly_production}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Bar dataKey="earnings" fill="#334155" radius={[4, 4, 0, 0]} name="Wages" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Production History Table */}
      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Production History ({history_pagination?.total_records ?? history.length})
            </h2>
            {cycle?.last_reset_at && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideSettled}
                  onChange={(e) => {
                    setHideSettled(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                Hide Settled Work
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              title="Start Date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              title="End Date"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="production_date">Sort: Date</option>
              <option value="quantity">Sort: Quantity</option>
              <option value="total_price">Sort: Total Price</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(1);
              }}
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
                  setPage(1);
                }}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            {hideSettled
              ? "No active work logged since the last cycle reset."
              : "No production records found for this period."}
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {history.map((r, idx) => (
                <div key={r.id} className="space-y-3">
                  {showDividerAt(idx) && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold text-center">
                      {dividerText}
                    </div>
                  )}
                  <div
                    className={`border rounded-xl p-4 space-y-1.5 ${
                      r.is_settled
                        ? "bg-slate-50/70 border-slate-200 opacity-75"
                        : "bg-white border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{r.production_type_name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            r.is_settled
                              ? "bg-slate-200 text-slate-600"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {r.is_settled ? "Settled" : "Current Cycle"}
                        </span>
                      </div>
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
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Production Type</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Total Price</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((r, idx) => (
                      <Fragment key={r.id}>
                        {showDividerAt(idx) && (
                          <tr key={`divider-${r.id}`} className="bg-amber-50 border-y-2 border-amber-300">
                            <td colSpan={8} className="px-4 py-2 text-center text-xs font-semibold text-amber-900">
                              {dividerText}
                            </td>
                          </tr>
                        )}
                        <tr
                          key={r.id}
                          className={
                            r.is_settled
                              ? "bg-slate-50/60 text-slate-500 hover:bg-slate-100/60"
                              : "bg-white hover:bg-emerald-50/30"
                          }
                        >
                          <td className="px-4 py-3 whitespace-nowrap">{r.production_date}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                r.is_settled
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {r.is_settled ? "Settled" : "Current Cycle"}
                            </span>
                          </td>
                          <td className={`px-4 py-3 font-medium ${r.is_settled ? "text-slate-600" : "text-slate-900"}`}>
                            {r.production_type_name}
                          </td>
                          <td className="px-4 py-3">{r.vendor_name}</td>
                          <td className="px-4 py-3 text-right">{formatQty(r.quantity)}</td>
                          <td className="px-4 py-3 text-right">{formatINR(r.rate_per_piece)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatINR(r.total_price)}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.notes || "—"}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {history_pagination && history_pagination.total_pages > 1 && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page <strong>{history_pagination.page}</strong> of{" "}
                  <strong>{history_pagination.total_pages}</strong> ({history_pagination.total_records} records)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={history_pagination.page <= 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(history_pagination.total_pages, p + 1))}
                    disabled={history_pagination.page >= history_pagination.total_pages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment History */}
      <WorkerPaymentHistory workerId={worker.id} />
    </div>
  );
}