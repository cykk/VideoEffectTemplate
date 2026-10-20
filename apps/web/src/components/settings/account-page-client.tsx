"use client";

import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { resolveIntlLocale } from "@markless/shared/src/i18n/locale-config";
import type { Locale } from "@markless/shared/src/i18n/types";

type BootstrapUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  createdAt?: string | Date | null;
  emailVerified?: boolean;
};

interface AccountPageClientProps {
  locale: Locale;
}

export function AccountPageClient({ locale }: AccountPageClientProps) {
  const { dictionary } = useLocale();
  const { data: bootstrap, loading } = useUserBootstrap();
  const user = bootstrap?.user as BootstrapUser | null;
  const profile = dictionary.pages.profile;
  const intlLocale = resolveIntlLocale(locale);

  if (loading || !bootstrap?.authenticated || !user) {
    return <div className="min-h-[320px]" />;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{profile.subtitle}</h1>
        <p className="mt-2 text-slate-500">{profile.description}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {profile.basicInfo.title}
            </CardTitle>
            <CardDescription>{profile.basicInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || user.email || profile.title}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-white">
                    {(user.name || user.email || "U")
                      .split(" ")
                      .map((item) => item[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{user.name || profile.noNameSet}</p>
                <p className="text-sm text-slate-400">{user.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-500">{profile.basicInfo.emailLabel}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{user.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">{profile.basicInfo.registrationDate}</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString(intlLocale)
                : profile.basicInfo.unknown}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {profile.accountStatus.title}
            </CardTitle>
            <CardDescription>{profile.accountStatus.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{profile.accountStatus.emailVerification}</span>
              <Badge variant={user.emailVerified ? "default" : "secondary"}>
                {user.emailVerified ? profile.accountStatus.verified : profile.accountStatus.unverified}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{profile.accountStatus.accountStatus}</span>
              <Badge variant="default">{profile.accountStatus.normal}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{profile.accountStatus.loginMethod}</span>
              <Badge variant="outline">
                {user.image ? profile.accountStatus.oauth : profile.accountStatus.emailLogin}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex gap-4">
        <button className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          {profile.actions.editProfile}
        </button>
        <button className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
          {profile.actions.changePassword}
        </button>
      </div>
    </div>
  );
}

