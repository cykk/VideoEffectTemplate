"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveIntlLocale } from "@markless/shared/src/i18n/locale-config";
import { getInvoiceDictionary } from "@markless/shared/src/i18n/pages/payment";
import { BRAND_CONFIG } from "@markless/shared/src/lib/config/brand";
import { usePublicBrand } from "@/components/providers/public-brand-provider";
import type { Locale } from "@markless/shared/src/i18n/types";

const INVOICE_BRAND_HEADING_STYLE =
  "font-size: 32px; font-weight: bold; background: linear-gradient(to right, rgb(37 99 235), rgb(124 58 237)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;";

interface InvoiceDownloadButtonProps {
  orderId: string;
  orderNumber: string;
  product: string;
  amount: string;
  date: string;
  period?: string | null;
  status: string;
  paymentMethod: string;
  locale: Locale;
}

export function InvoiceDownloadButton({
  orderId,
  orderNumber,
  product,
  amount,
  date,
  period,
  status,
  paymentMethod,
  locale,
}: InvoiceDownloadButtonProps) {
  const { supportEmail, siteDomain } = usePublicBrand();
  const [isGenerating, setIsGenerating] = useState(false);
  const copy = getInvoiceDictionary(locale);
  const intlLocale = resolveIntlLocale(locale);

  const handleDownload = async () => {
    setIsGenerating(true);

    try {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "800px";
      container.style.backgroundColor = "rgb(255 255 255)";
      container.style.padding = "40px";

      const generatedDate = new Date().toLocaleDateString(intlLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const statusLabel = status === "paid" ? copy.paid : copy.failed;
      const servicePeriod = period || copy.oneTimePurchase;

      container.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgb(15 23 42); max-width: 800px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid rgb(229 231 235);">
            <div>
              <h1 style="${INVOICE_BRAND_HEADING_STYLE}">${BRAND_CONFIG.primaryName}</h1>
              <p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;">${copy.companySubtitle}</p>
              ${supportEmail ? `<p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;">${supportEmail}</p>` : ""}
              <p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;">${siteDomain}</p>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 28px; font-weight: 600; margin-bottom: 12px;">${copy.title}</h2>
              <p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;"><strong>${copy.invoiceNumber}</strong> ${orderNumber}</p>
              <p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;"><strong>${copy.date}</strong> ${date}</p>
              <p style="color: rgb(107 114 128); font-size: 14px; margin: 4px 0;">
                <strong>${copy.status}</strong>
                <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; ${status === "paid" ? "background: rgb(209 250 229); color: rgb(6 95 70);" : "background: rgb(254 226 226); color: rgb(153 27 27);"}">
                  ${statusLabel}
                </span>
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 48px;">
            <div>
              <h3 style="font-size: 14px; font-weight: 600; color: rgb(107 114 128); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">${copy.billedTo}</h3>
              <p style="color: rgb(15 23 42); font-size: 15px; margin: 6px 0;"><strong>${copy.customerId}</strong> ${orderId.substring(0, 8)}</p>
              <p style="color: rgb(15 23 42); font-size: 15px; margin: 6px 0;"><strong>${copy.paymentMethod}</strong> ${paymentMethod}</p>
            </div>
            <div>
              <h3 style="font-size: 14px; font-weight: 600; color: rgb(107 114 128); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">${copy.servicePeriod}</h3>
              <p style="color: rgb(15 23 42); font-size: 15px;">${servicePeriod}</p>
            </div>
          </div>

          <table style="width: 100%; margin-bottom: 32px; border-collapse: collapse;">
            <thead style="background: rgb(248 250 252);">
              <tr>
                <th style="text-align: left; padding: 16px; font-size: 13px; font-weight: 600; color: rgb(107 114 128); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid rgb(229 231 235);">${copy.description}</th>
                <th style="text-align: right; padding: 16px; font-size: 13px; font-weight: 600; color: rgb(107 114 128); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid rgb(229 231 235);">${copy.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 16px; font-size: 15px; color: rgb(15 23 42); border-bottom: 2px solid rgb(229 231 235);">
                  <strong>${product}</strong>
                  ${period ? `<br><span style="color: rgb(107 114 128); font-size: 13px;">${period}</span>` : ""}
                </td>
                <td style="text-align: right; padding: 16px; font-size: 15px; color: rgb(15 23 42); border-bottom: 2px solid rgb(229 231 235);"><strong>${amount}</strong></td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 48px;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 15px;">
                <span>${copy.subtotal}</span>
                <span>${amount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 15px;">
                <span>${copy.tax}</span>
                <span>${copy.included}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 16px; margin-top: 8px; font-size: 20px; font-weight: 700; border-top: 2px solid rgb(229 231 235);">
                <span>${copy.total}</span>
                <span>${amount}</span>
              </div>
            </div>
          </div>

          <div style="text-align: center; padding-top: 32px; border-top: 2px solid rgb(229 231 235); color: rgb(107 114 128); font-size: 13px;">
            <p style="margin: 8px 0;"><strong>${copy.thankYou}</strong></p>
            <p style="margin: 8px 0;">${copy.supportText}</p>
            <p style="margin-top: 16px;">${copy.generatedOn} ${generatedDate}</p>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "rgb(255 255 255)",
      });

      document.body.removeChild(container);

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`${copy.fileNamePrefix}-${orderNumber}.pdf`);

      setIsGenerating(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(copy.generationFailed);
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={isGenerating}
      className="h-8 w-8 cursor-pointer rounded-full p-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      title={copy.downloadTitle}
    >
      <Download className={`h-4 w-4 ${isGenerating ? "animate-pulse" : ""}`} />
    </Button>
  );
}

