import { useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, IndianRupee } from 'lucide-react';
import api from "../services/api"

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function PayoutsPage() {
  const [balances, setBalances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filterWorker, setFilterWorker] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [form, setForm] = useState({
    worker_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'UPI',
    reference_note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const params = {};
      if (filterWorker) params.worker_id = filterWorker;
      if (filterMode) params.payment_mode = filterMode;
      const [bRes, pRes] = await Promise.all([
        api.get('/api/payments/balances'),
        api.get('/api/payments', { params }),
      ]);
      setBalances(bRes.data);
      setPayments(pRes.data);
    } catch (err) {
      setError('Failed to load payout data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterWorker, filterMode]);

  const selectedWorker = balances.find(
    (b) => String(b.worker_id) === String(form.worker_id)
  );

  const totals = balances.reduce(
    (acc, b) => ({
      earned: acc.earned + b.total_earnings,
      paid: acc.paid + b.total_paid,
      pending: acc.pending + b.pending_balance,
    }),
    { earned: 0, paid: 0, pending: 0 }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/payments', {
        ...form,
        worker_id: Number(form.worker_id),
        amount: Number(form.amount),
      });
      setForm((f) => ({ ...f, amount: '', reference_note: '' }));
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment record?')) return;
    await api.delete(`/api/payments/${id}`);
    await fetchData();
  };

  const quickFillWorker = (worker) => {
    setForm((f) => ({
      ...f,
      worker_id: String(worker.worker_id),
      amount: worker.pending_balance > 0 ? String(worker.pending_balance) : '',
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-slate-700" /> Worker Payouts
        </h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Workshop Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Wages</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatINR(totals.earned)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Paid Out</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(totals.paid)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Pending Balance</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totals.pending)}</p>
        </div>
      </div>

      {/* Record Payment Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-xl border border-slate-200 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Record New Payment
          </h2>
          {selectedWorker && (
            <div className="text-sm flex items-center gap-3">
              <span className="text-slate-600">
                {selectedWorker.pending_balance >= 0 ? 'Pending: ' : 'Advance: '}
                <strong
                  className={
                    selectedWorker.pending_balance > 0 ? 'text-amber-600' : 'text-blue-600'
                  }
                >
                  {formatINR(Math.abs(selectedWorker.pending_balance))}
                </strong>
              </span>
              {selectedWorker.pending_balance > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      amount: String(selectedWorker.pending_balance),
                    }))
                  }
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-700"
                >
                  Pay Full
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            required
            value={form.worker_id}
            onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Select Worker</option>
            {balances.map((b) => (
              <option key={b.worker_id} value={b.worker_id}>
                {b.worker_name} (
                {b.pending_balance >= 0
                  ? `Due: ${formatINR(b.pending_balance)}`
                  : `Adv: ${formatINR(Math.abs(b.pending_balance))}`}
                )
              </option>
            ))}
          </select>

          <input
            type="number"
            required
            min="1"
            step="0.01"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />

          <input
            type="date"
            required
            value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />

          <select
            value={form.payment_mode}
            onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>

          <input
            type="text"
            placeholder="Note / UPI Ref (optional)"
            value={form.reference_note}
            onChange={(e) => setForm({ ...form, reference_note: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Payment'}
        </button>
      </form>

      {/* Worker Balances Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Worker Balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3 text-right">Total Earnings</th>
                <th className="px-4 py-3 text-right">Total Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((b) => (
                <tr key={b.worker_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.worker_name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatINR(b.total_earnings)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                    {formatINR(b.total_paid)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {b.pending_balance > 0 ? (
                      <span className="text-amber-600">{formatINR(b.pending_balance)} Due</span>
                    ) : b.pending_balance < 0 ? (
                      <span className="text-blue-600">
                        {formatINR(Math.abs(b.pending_balance))} Adv
                      </span>
                    ) : (
                      <span className="text-slate-400">Settled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => quickFillWorker(b)}
                      className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      Pay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Payment History</h2>
          <div className="flex gap-2">
            <select
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Workers</option>
              {balances.map((b) => (
                <option key={b.worker_id} value={b.worker_id}>
                  {b.worker_name}
                </option>
              ))}
            </select>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Modes</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{p.payment_date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.worker_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                      {p.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.reference_note || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {formatINR(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-slate-400 hover:text-red-600"
                      title="Delete payment"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
