"use client";

import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/header/header-logo";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionGuestSidebarProps = {
  locale: string;
  sidebarDict: TranscriptionsPageDictionary["sidebar"];
  brandIdentity: {
    primary_name: string;
    support_label: string;
    home_aria_label: string;
  };
  onSignupAction: () => void;
};

export function TranscriptionGuestSidebar({
  locale,
  sidebarDict,
  brandIdentity,
  onSignupAction,
}: TranscriptionGuestSidebarProps) {
  return (
    <aside className="hidden w-[260px] flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center px-6">
        <HeaderLogo
          locale={locale}
          variant="dark"
          textSize="md"
          hideTextOnMobile={false}
          brandName={brandIdentity.primary_name}
          supportLabel={brandIdentity.support_label}
          homeAriaLabel={brandIdentity.home_aria_label}
        />
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="space-y-2">
          <Button
            type="button"
            className="w-full justify-center gap-2 bg-primary text-white hover:bg-primary/90 font-medium"
            onClick={onSignupAction}
          >
            <BookmarkPlus className="size-4" aria-hidden="true" />
            {sidebarDict.actions.saveTranscript}
          </Button>
        </div>
      </div>
    </aside>
  );
}
