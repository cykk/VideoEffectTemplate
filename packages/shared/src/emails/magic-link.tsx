import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { getEmailDictionary } from '@markless/shared/src/emails/dictionary';
import type { Locale } from '@markless/shared/src/i18n/types';
import { BRAND_CONFIG } from '@markless/shared/src/lib/config/brand';
import { getWebBaseUrl } from '@markless/shared/src/lib/config/urls';
import { EmailButton } from './components/email-button';
import { EmailFooter } from './components/email-footer';
import { EmailHeader } from './components/email-header';
import { EmailLayout } from './components/email-layout';
import { EmailWarning } from './components/email-warning';
import { emailColors } from './email-theme';

export interface MagicLinkEmailProps {
    magicLinkUrl: string;
    userEmail: string;
    appUrl?: string;
    locale?: Locale;
}

export function MagicLinkEmail({
    magicLinkUrl,
    userEmail,
    appUrl = getWebBaseUrl(),
    locale = 'en',
}: MagicLinkEmailProps) {
    const copy = getEmailDictionary(locale).magicLink;

    return (
        <EmailLayout preview={copy.preview}>
            <EmailHeader appUrl={appUrl} locale={locale} />

            <Section style={styles.content}>
                <Heading style={styles.title}>{copy.title}</Heading>

                <Text style={styles.text}>{copy.greeting}</Text>

                <Text style={styles.text}>
                    {copy.requestPrefix}
                    <strong>{userEmail}</strong>
                    {copy.requestSuffix}
                </Text>

                <EmailButton href={magicLinkUrl}>{copy.button}</EmailButton>

                <Text style={styles.smallText}>{copy.copyLink}</Text>

                <Text style={styles.link}>{magicLinkUrl}</Text>

                <EmailWarning>
                    {copy.warningPrefix}{' '}
                    <strong>{copy.warningDuration}</strong>
                    {copy.warningSuffix}
                </EmailWarning>

                <Text style={styles.footerText}>{copy.ignoreNotice}</Text>
            </Section>

            <EmailFooter appUrl={appUrl} locale={locale} />
        </EmailLayout>
    );
}

const styles = {
    content: {
        backgroundColor: emailColors.background,
        borderRadius: '16px',
        padding: '40px',
        border: `1px solid ${emailColors.border}`,
    },
    title: {
        fontSize: '24px',
        fontWeight: 700,
        color: emailColors.foreground,
        margin: '0 0 16px 0',
        textAlign: 'center' as const,
    },
    text: {
        fontSize: '16px',
        lineHeight: '1.6',
        color: emailColors.muted,
        margin: '0 0 24px 0',
    },
    smallText: {
        fontSize: '14px',
        color: emailColors.muted,
        textAlign: 'center' as const,
        margin: '24px 0',
    },
    link: {
        fontSize: '13px',
        color: emailColors.muted,
        wordBreak: 'break-all' as const,
        textAlign: 'center' as const,
        margin: '24px 0',
        display: 'block',
    },
    footerText: {
        fontSize: '14px',
        color: emailColors.muted,
        margin: '24px 0 0 0',
    },
};

MagicLinkEmail.PreviewProps = {
    magicLinkUrl:
        `${BRAND_CONFIG.siteUrl}/api/auth/magic-link/verify?token=example_token_123456`,
    userEmail: 'user@example.com',
} as MagicLinkEmailProps;

export default MagicLinkEmail;
