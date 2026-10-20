import { Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { getEmailDictionary } from '@markless/shared/src/emails/dictionary';
import type { Locale } from '@markless/shared/src/i18n/types';
import { BRAND_CONFIG } from '@markless/shared/src/lib/config/brand';
import { emailColors } from '../email-theme';

interface EmailFooterProps {
    appUrl?: string;
    locale?: Locale;
}

export function EmailFooter({
    appUrl = BRAND_CONFIG.siteUrl,
    locale = 'en',
}: EmailFooterProps) {
    const currentYear = new Date().getFullYear();
    const copy = getEmailDictionary(locale).common.footer;
    const rightsReserved = copy.rightsReserved.replace('{year}', String(currentYear));

    return (
        <Section style={styles.footer}>
            <Hr style={styles.hr} />

            <Text style={styles.footerText}>{rightsReserved}</Text>

            <Text style={styles.footerText}>
                <Link href={`${appUrl}/terms`} style={styles.footerLink}>
                    {copy.termsOfService}
                </Link>
                {' | '}
                <Link href={`${appUrl}/privacy`} style={styles.footerLink}>
                    {copy.privacyPolicy}
                </Link>
            </Text>

            <Text style={styles.footerText}>
                {copy.helpPrefix}{' '}
                <Link href={`mailto:support@${BRAND_CONFIG.siteDomain}`} style={styles.footerLink}>
                    {copy.contactSupport}
                </Link>
            </Text>
        </Section>
    );
}

const styles = {
    footer: {
        marginTop: '40px',
    },
    hr: {
        borderColor: emailColors.border,
        margin: '32px 0',
    },
    footerText: {
        fontSize: '14px',
        color: emailColors.muted,
        textAlign: 'center' as const,
        margin: '8px 0',
    },
    footerLink: {
        color: emailColors.primary,
        textDecoration: 'none',
    },
};
