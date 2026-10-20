import { getDictionary } from "@markless/shared/src/i18n";
import type {
  Locale,
  PaymentFailedPageDictionary,
  PaymentInvoiceDictionary,
  PaymentSuccessPageDictionary,
} from "@markless/shared/src/i18n/types";

export type PaymentSuccessDictionary = PaymentSuccessPageDictionary;
export type PaymentFailedDictionary = PaymentFailedPageDictionary;
export type InvoiceDictionary = PaymentInvoiceDictionary;

export function getPaymentSuccessDictionary(
  locale: Locale
): PaymentSuccessDictionary {
  return getDictionary(locale).pages.payment.success;
}

export function getPaymentFailedDictionary(
  locale: Locale
): PaymentFailedDictionary {
  return getDictionary(locale).pages.payment.failed;
}

export function getInvoiceDictionary(locale: Locale): InvoiceDictionary {
  return getDictionary(locale).pages.payment.invoice;
}
