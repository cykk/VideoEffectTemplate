import Link from "next/link";
import { Mail } from "lucide-react";
import {
    ComponentLayoutFooterDictionary,
    FooterDictionary,
    HeaderDictionary,
} from "@markless/shared/src/i18n/types";
import { HeaderLogo } from "@/components/header/header-logo";
import { ToolsNavFooterLinks } from "@/components/header/tools-nav-menu";
import { BLOG_NAV_ENABLED } from "@/lib/blog/constants";

interface FooterProps {
    dictionary: FooterDictionary;
    brandDictionary: ComponentLayoutFooterDictionary;
    toolsMenu: HeaderDictionary["toolsMenu"];
    currentLocale: string;
    activePathname: string;
}

const footerLinkClassName =
    "group flex items-center py-1.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-600";

export function Footer({
    dictionary,
    brandDictionary,
    toolsMenu,
    currentLocale,
    activePathname,
}: FooterProps) {
    const currentYear = new Date().getFullYear();
    const brandIdentity = brandDictionary.brand.identity;
    const pricingHref = currentLocale === "en" ? "/pricing" : `/${currentLocale}/pricing`;
    const blogHref = currentLocale === "en" ? "/blog" : `/${currentLocale}/blog`;
    const loginHref = currentLocale === "en" ? "/login" : `/${currentLocale}/login`;
    const signupHref = currentLocale === "en" ? "/signup" : `/${currentLocale}/signup`;
    const privacyHref = currentLocale === "en" ? "/privacy" : `/${currentLocale}/privacy`;
    const termsHref = currentLocale === "en" ? "/terms" : `/${currentLocale}/terms`;
    const partnersHref = currentLocale === "en" ? "/partners" : `/${currentLocale}/partners`;

    return (
        <footer className="bg-gradient-to-b from-white to-primary/[0.03] border-t border-slate-200/50">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-4 sm:col-span-2 lg:col-span-1">
                        <HeaderLogo
                            locale={currentLocale}
                            textSize="sm"
                            hideTextOnMobile={false}
                            brandName={brandIdentity.primary_name}
                            supportLabel={brandIdentity.support_label}
                            homeAriaLabel={brandIdentity.home_aria_label}
                        />
                        <p className="max-w-xs text-sm leading-relaxed text-slate-600">
                            {dictionary.description}
                        </p>
                        {brandDictionary.brand.discovery.site_hint ? (
                            <p className="text-xs font-semibold tracking-[0.08em] text-slate-600">
                                {brandDictionary.brand.discovery.site_hint}
                            </p>
                        ) : null}
                        <div>
                            <a
                                href={`mailto:${dictionary.support.email}`}
                                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-brand-600"
                            >
                                <Mail className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                                <span>{dictionary.support.email}</span>
                            </a>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-slate-900 tracking-wider uppercase">
                            {dictionary.tools}
                        </h3>
                        <ul className="space-y-1">
                            <ToolsNavFooterLinks
                                locale={currentLocale}
                                labels={toolsMenu}
                                activePathname={activePathname}
                            />
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-slate-900 tracking-wider uppercase">
                            {dictionary.product}
                        </h3>
                        <ul className="space-y-1">
                            <li>
                                <Link href={pricingHref} className={footerLinkClassName}>
                                    <span>{dictionary.pricing}</span>
                                </Link>
                            </li>
                            {BLOG_NAV_ENABLED ? (
                                <li>
                                    <Link href={blogHref} className={footerLinkClassName}>
                                        <span>{dictionary.blog}</span>
                                    </Link>
                                </li>
                            ) : null}
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-slate-900 tracking-wider uppercase">
                            {dictionary.account}
                        </h3>
                        <ul className="space-y-1">
                            <li>
                                <Link href={loginHref} className={footerLinkClassName}>
                                    <span>{dictionary.login}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href={signupHref} className={footerLinkClassName}>
                                    <span>{dictionary.signup}</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-slate-900 tracking-wider uppercase">
                            {dictionary.company}
                        </h3>
                        <ul className="space-y-1">
                            <li>
                                <Link href={privacyHref} className={footerLinkClassName}>
                                    <span>{dictionary.privacyPolicy}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href={termsHref} className={footerLinkClassName}>
                                    <span>{dictionary.termsOfService}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href={partnersHref} className={footerLinkClassName}>
                                    <span>{dictionary.links}</span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 border-t border-slate-200/50 pt-8">
                    <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
                        <p className="text-sm text-slate-600">
                            {dictionary.copyright.replace("{year}", currentYear.toString())}
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
