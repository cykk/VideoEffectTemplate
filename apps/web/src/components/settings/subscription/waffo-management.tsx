'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@markless/shared/src/lib/http/client'
import { paymentMessages, paymentMessage } from '@markless/shared/src/lib/payments/messages'
import { subscriptionPlans } from '@markless/shared/src/lib/products/config'
import { Button } from '@/components/ui/button'

export function WaffoManagement({ currentPlan, scheduled }: { currentPlan: string; scheduled: boolean }) {
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const dict = paymentMessages.subscription
  async function submit(cancel: boolean) {
    setBusy(true)
    try {
      const response = await apiFetch('/api/subscriptions/change', {
        method: cancel ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
        ...(!cancel ? { body: JSON.stringify({ new_plan_id: selected }) } : {}),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(paymentMessage(result.message || ''))
      if (result.data.checkout_url) window.location.assign(result.data.checkout_url)
      else window.location.reload()
    } catch (error) { toast.error(error instanceof Error ? error.message : dict.error.change) }
    finally { setBusy(false) }
  }
  return <div className="mt-4 space-y-3 rounded-lg border p-4">
    <p>{dict.action.confirm}</p>
    <select aria-label={dict.action.change} value={selected} onChange={event => setSelected(event.target.value)} className="rounded border p-2">
      <option value="">{dict.action.change}</option>
      {subscriptionPlans.filter(plan => plan.isActive && plan.id !== currentPlan).map(plan =>
        <option key={plan.id} value={plan.id}>{dict.plan[plan.id.replace(':', '_') as keyof typeof dict.plan]}</option>)}
    </select>
    <Button disabled={!selected || busy} onClick={() => void submit(false)}>{dict.action.change}</Button>
    {scheduled && <div className="space-y-2"><p>{dict.action.cancelWarning}</p><Button disabled={busy} onClick={() => void submit(true)}>{dict.action.cancelChange}</Button></div>}
  </div>
}
