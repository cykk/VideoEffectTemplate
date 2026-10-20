import { apiFetch } from '@markless/shared/src/lib/http/client'
import { paymentMessages } from '@markless/shared/src/lib/payments/messages'

export async function waitForPayment(body: Record<string, unknown>, signal: AbortSignal) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await apiFetch('/api/payment/success', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
    const data = await response.json()
    if (!response.ok || !data.success || !data.order) throw new Error(paymentMessages.status.message.failed)
    if (data.settled === true || (data.settled === undefined && data.order.status === 'paid')) return data
    if (['failed', 'cancelled', 'refunded'].includes(data.order.status)) throw new Error(paymentMessages.status.message.failed)
    if (data.requiresReview) throw new Error(paymentMessages.status.message.review)
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1500)
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true })
    })
  }
  return null
}
