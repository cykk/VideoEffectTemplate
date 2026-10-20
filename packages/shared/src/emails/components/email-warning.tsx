import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { emailColors } from '../email-theme';

interface EmailWarningProps {
    children: React.ReactNode;
}

/**
 * 邮件警告组件 - Alert 风格
 */
export function EmailWarning({ children }: EmailWarningProps) {
    return (
        <Section style={styles.container}>
            <Text style={styles.text}>{children}</Text>
        </Section>
    );
}

const styles = {
    container: {
        backgroundColor: emailColors.warningBg,
        borderRadius: '12px',
        padding: '16px 20px',
        border: `1px solid ${emailColors.warningBorder}`,
        margin: '32px 0',
    },
    text: {
        fontSize: '14px',
        lineHeight: '1.5',
        color: emailColors.warning,
        margin: 0,
        fontWeight: 500,
        textAlign: 'center' as const,
    },
};
