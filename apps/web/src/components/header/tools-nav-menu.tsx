"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  resolveMarketingToolLinks,
  type MarketingToolNavLabels,
  type ResolvedMarketingToolLink,
} from "@/lib/marketing/tools-nav";
import { cn } from "@markless/shared/src/lib/utils";

const CLOSE_DELAY_MS = 150;

const navTriggerClassName =
  "inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-primary/5 hover:text-primary";

const navTriggerOpenClassName = "bg-primary/5 text-primary";

const dropdownPanelClassName =
  "rounded-lg border border-slate-200/90 bg-white p-1.5 shadow-md ring-1 ring-slate-900/[0.04]";

const dropdownItemClassName =
  "block w-full cursor-pointer rounded-md px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-primary";

interface ToolsNavMenuProps {
  locale: string;
  menuLabel: string;
  triggerAriaLabel?: string;
  labels: MarketingToolNavLabels;
  activePathname: string;
}

function useResolvedToolLinks(locale: string, labels: MarketingToolNavLabels) {
  return resolveMarketingToolLinks(locale, labels);
}

function isLinkActive(link: ResolvedMarketingToolLink, activePathname: string): boolean {
  const normalizedActive = activePathname.replace(/\/$/, "") || "/";
  const normalizedHref = link.href.replace(/\/$/, "") || "/";
  return normalizedActive === normalizedHref;
}

export function ToolsNavDesktopMenu({
  locale,
  menuLabel,
  triggerAriaLabel,
  labels,
  activePathname,
}: ToolsNavMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const links = useResolvedToolLinks(locale, labels);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const toggleMenu = useCallback(() => {
    clearCloseTimer();
    setOpen((current) => !current);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(navTriggerClassName, open && navTriggerOpenClassName)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={triggerAriaLabel}
        onClick={toggleMenu}
      >
        <span>{menuLabel}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 w-max min-w-[11.5rem] pt-1.5"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <div className={dropdownPanelClassName}>
            {links.map((link) => {
              const active = isLinkActive(link, activePathname);

              return (
                <Link
                  key={link.id}
                  href={link.href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  className={dropdownItemClassName}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ToolsNavMobileAccordionProps extends ToolsNavMenuProps {
  onNavigate?: () => void;
}

export function ToolsNavMobileAccordion({
  locale,
  menuLabel,
  labels,
  activePathname,
  onNavigate,
}: ToolsNavMobileAccordionProps) {
  const links = useResolvedToolLinks(locale, labels);
  const hasActiveChild = links.some((link) => isLinkActive(link, activePathname));

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      defaultValue={hasActiveChild ? "tools" : undefined}
    >
      <AccordionItem value="tools" className="border-0">
        <AccordionTrigger className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-primary/5 hover:text-primary hover:no-underline data-[state=open]:bg-primary/5 data-[state=open]:text-primary">
          {menuLabel}
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <div className="space-y-0.5 pb-2 pl-2">
            {links.map((link) => {
              const active = isLinkActive(link, activePathname);

              return (
                <Link
                  key={link.id}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={dropdownItemClassName}
                  onClick={onNavigate}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ToolsNavFooterLinks({
  locale,
  labels,
  activePathname,
}: Pick<ToolsNavMenuProps, "locale" | "labels" | "activePathname">) {
  const links = useResolvedToolLinks(locale, labels);

  return (
    <>
      {links.map((link) => {
        const active = isLinkActive(link, activePathname);

        return (
          <li key={link.id}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className="group flex items-center py-1.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-600"
            >
              <span>{link.label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
}
