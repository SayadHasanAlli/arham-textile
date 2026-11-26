import { useEffect, useState } from 'react';
import api from "../services/api"

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function WorkerPaymentHistory({ workerId }) {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const params = workerId ? { worker_id: workerId } : {};
    api.get('/api/payments', { params }).then((res) => setPayments(res.data));
  }, [workerId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">Payment History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3 text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{p.payment_date}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                    {p.payment_mode}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{p.reference_note || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                  {formatINR(p.amount)}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan="4" className="px-4 py-6 text-center text-slate-400">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
