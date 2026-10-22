"use client";

import { useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AuthForm } from "@/components/auth/auth-form";
import type { AuthModalDictionary, RaindanceHomeDictionary } from "@markless/shared/src/i18n/types";
import { trackRaindance } from "./lib/track";

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: RaindanceHomeDictionary["gates"];
  authDictionary: AuthModalDictionary;
  /** 登录完成后回到的站内路径，包含照片令牌。 */
  resumePath: string;
}

/**
 * 登录底部弹层。登录回跳地址写入 `oauth-callback-target`（AuthForm 会读取），
 * 其中带着照片令牌，所以 OAuth 重定向或另一个浏览器里的邮件链接都能恢复选择。
 */
export function AuthSheet({ open, onOpenChange, dictionary, authDictionary, resumePath }: AuthSheetProps) {
  useEffect(() => {
    if (!open) return;
    trackRaindance("raindance_auth_view");
    try {
      localStorage.setItem(
        "oauth-callback-target",
        JSON.stringify({ url: new URL(resumePath, window.location.origin).toString(), timestamp: Date.now() }),
      );
    } catch {
      // 存储不可用时 AuthForm 会退回当前地址，此时草稿仍由 localStorage 之外的 URL 参数无法保证，属可接受降级
    }
  }, [open, resumePath]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[10021] max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2"
      >
        <SheetHeader className="px-0 pr-8">
          <SheetTitle className="text-lg">{dictionary.auth.title}</SheetTitle>
          <SheetDescription>{dictionary.auth.description}</SheetDescription>
        </SheetHeader>
        <AuthForm dictionary={authDictionary} isModal inAppNotice={dictionary.inApp} className="pt-2" />
      </SheetContent>
    </Sheet>
  );
}
