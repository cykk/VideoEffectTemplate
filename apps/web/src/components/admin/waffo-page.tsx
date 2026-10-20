'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@markless/shared/src/lib/http/client'
import { Button } from '@/components/ui/button'

type Dashboard = { events: Array<{ id: string; type: string; status: string; error: string; attempts: number }>;
  refunds: Array<{ id: string; orderId: string; amount: string; currency: string; status: string; creditStatus: string }>;
  reviews: Array<{ orderId: string; reviewReason: string }> }

export function WaffoAdminPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentId, setPaymentId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/admin/payments/waffo')
    const result = await response.json()
    if (!response.ok) throw new Error('Could not load Waffo operations. Check configuration and migrations.')
    setData(result.data)
  }, [])
  useEffect(() => { void refresh().catch(e => setError(String(e))) }, [refresh])
  async function act(body: Record<string, unknown>) {
    setBusy(true); setError('')
    try {
      const response = await apiFetch('/api/admin/payments/waffo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Action failed. Inspect the event or remote ticket before retrying.')
      await refresh()
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return <div className="space-y-6 p-6">
    <h1 className="text-2xl font-bold">Waffo operations</h1>
    <p>Events and refunds are isolated from Creem. Unknown remote results must be reconciled before retrying.</p>
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy} onClick={() => void act({ action: 'run' })}>Process events and reconcile</Button>
    <h2 className="text-lg font-semibold">Pending and failed events</h2>
    {data?.events.map(item => <div key={item.id} className="rounded border p-3"><p>{item.type} · {item.status} · {item.attempts}</p><p>{item.error}</p>{item.status === 'failed' && <Button disabled={busy} onClick={() => void act({ action: 'replay', id: item.id })}>Replay</Button>}</div>)}
    <h2 className="text-lg font-semibold">Orders requiring review</h2>
    {data?.reviews.map(item => <p key={item.orderId}>{item.orderId}: {item.reviewReason}</p>)}
    <h2 className="text-lg font-semibold">Refund review</h2>
    {data?.refunds.map(item => <div key={item.id} className="rounded border p-3"><p>{item.orderId} · {item.amount} {item.currency} · {item.status} · {item.creditStatus}</p>
      {item.creditStatus === 'review' && <Button disabled={busy} onClick={() => {
        const note = window.prompt('Record your decision and any audited credit adjustment reference. This action does not change balances.')
        if (note) void act({ action: 'resolve-refund', id: item.id, note })
      }}>Record resolution</Button>}</div>)}
    <form className="space-y-2" onSubmit={event => {
      event.preventDefault()
      if (window.confirm(`Request refund of ${amount} for payment ${paymentId}?`)) void act({ action: 'request-refund', paymentId, amount, reason })
    }}>
      <h2 className="text-lg font-semibold">Request refund</h2>
      <input aria-label="Waffo payment ID" placeholder="PAY_…" required value={paymentId} onChange={event => setPaymentId(event.target.value)} className="border p-2" />
      <input aria-label="Refund amount" placeholder="10.00" required pattern="[0-9]+(\.[0-9]{1,4})?" value={amount} onChange={event => setAmount(event.target.value)} className="border p-2" />
      <input aria-label="Refund reason" placeholder="Reason" required value={reason} onChange={event => setReason(event.target.value)} className="border p-2" />
      <Button type="submit" disabled={busy}>Request refund</Button>
    </form>
  </div>
}
