import type { PrivacyPageDictionary } from "@markless/shared/src/i18n/types";
import { Card } from "@/components/ui/card";
import { cn } from "@markless/shared/src/lib/utils";
import {
    LegalBulletList,
    LegalPageShell,
    LegalParagraphs,
    LegalSection,
    type LegalNavItem,
    legalCardClassName,
    renderLegalContactItem,
} from "@/components/legal/legal-page-shared";

interface PrivacyPageContentProps {
    dictionary: PrivacyPageDictionary;
}

export function PrivacyPageContent({ dictionary }: PrivacyPageContentProps) {
    const sections: LegalNavItem[] = [
        ...dictionary.sections.map((section) => ({ id: section.id, title: section.title })),
        { id: "contact-information", title: dictionary.contactInformation.title },
    ];

    return (
        <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                <LegalPageShell
                    title={dictionary.title}
                    description={dictionary.description}
                    lastUpdated={dictionary.lastUpdated}
                    sections={sections}
                    summary={
                        <Card className={cn("border-slate-200/80 bg-white/80 p-6 shadow-sm", legalCardClassName)}>
                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-950">
                                        {dictionary.legalSummary.title}
                                    </h2>
                                    <div className="mt-4">
                                        <LegalBulletList
                                            items={dictionary.legalSummary.items}
                                            bulletClassName="bg-sky-500/80"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                    {dictionary.contactInformation.items.map((item, index) =>
                                        renderLegalContactItem(item, index)
                                    )}
                                </div>
                            </div>
                        </Card>
                    }
                >
                    {dictionary.sections.map((section, index) => {
                        const bulletClassNames = [
                            "bg-sky-500/80",
                            "bg-teal-500/80",
                            "bg-violet-500/80",
                            "bg-rose-500/80",
                            "bg-emerald-500/80",
                        ];
                        const bulletClassName = bulletClassNames[index % bulletClassNames.length];

                        return (
                            <LegalSection key={section.id} id={section.id} title={section.title}>
                                <Card className={cn("p-7 sm:p-8", legalCardClassName)}>
                                    {section.paragraphs?.length ? (
                                        <div className={section.items?.length ? "mb-6" : undefined}>
                                            <LegalParagraphs paragraphs={section.paragraphs} />
                                        </div>
                                    ) : null}
                                    {section.items?.length ? (
                                        <LegalBulletList
                                            items={section.items}
                                            bulletClassName={bulletClassName}
                                        />
                                    ) : null}
                                </Card>
                            </LegalSection>
                        );
                    })}

                    <LegalSection id="contact-information" title={dictionary.contactInformation.title}>
                        <Card className={cn("p-7 sm:p-8", legalCardClassName)}>
                            <div className="space-y-6">
                                <LegalParagraphs paragraphs={dictionary.contactInformation.paragraphs} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {dictionary.contactInformation.items.map((item, index) =>
                                        renderLegalContactItem(item, index)
                                    )}
                                </div>
                            </div>
                        </Card>
                    </LegalSection>
                </LegalPageShell>
            </div>
        </div>
    );
}
