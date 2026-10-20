import en from '../../i18n/locales/en.json'

export const paymentMessages = en.app.payments
export function paymentMessage(key: string) {
  const value = key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, en)
  return typeof value === 'string' ? value : paymentMessages.checkout.error.provider
}
