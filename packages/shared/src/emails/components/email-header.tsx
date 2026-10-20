import { Link, Section } from '@react-email/components';
import * as React from 'react';
import { getEmailDictionary } from '@markless/shared/src/emails/dictionary';
import type { Locale } from '@markless/shared/src/i18n/types';
import { BRAND_CONFIG } from '@markless/shared/src/lib/config/brand';
import { emailColors } from '../email-theme';

interface EmailHeaderProps {
    appUrl?: string;
    locale?: Locale;
}

export function EmailHeader({
    appUrl = BRAND_CONFIG.siteUrl,
    locale = 'en',
}: EmailHeaderProps) {
    const copy = getEmailDictionary(locale).common.header;

    return (
        <Section style={styles.header}>
            <Link href={appUrl} style={styles.logo}>
                {copy.logo}
            </Link>
            <div style={styles.subheader}>{copy.subheader}</div>
        </Section>
    );
}

const styles = {
    header: {
        textAlign: 'center' as const,
        marginBottom: '32px',
        marginTop: '16px',
    },
    logo: {
        fontSize: '32px',
        fontWeight: 800,
        color: emailColors.primary,
        textDecoration: 'none',
        letterSpacing: '-0.02em',
        display: 'block',
        marginBottom: '4px',
    },
    subheader: {
        fontSize: '14px',
        color: emailColors.muted,
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
    },
};
