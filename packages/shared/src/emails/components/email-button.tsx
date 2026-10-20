import { Button } from '@react-email/components';
import * as React from 'react';
import { emailColors } from '../email-theme';

interface EmailButtonProps {
    href: string;
    children: React.ReactNode;
}

/**
 * 邮件按钮组件
 *
 * 使用品牌渐变按钮样式
 */
export function EmailButton({ href, children }: EmailButtonProps) {
    return (
        <Button href={href} style={styles.button}>
            <span style={{ verticalAlign: 'middle' }}>{children}</span>
            <span style={{ marginLeft: '6px', fontSize: '18px', verticalAlign: 'middle' }}>→</span>
        </Button>
    );
}

const styles = {
    button: {
        boxSizing: 'border-box' as const,
        display: 'block',
        width: '100%',
        maxWidth: '320px',
        margin: '32px auto',
        padding: '18px 32px',
        background: emailColors.buttonGradient,
        color: emailColors.buttonText,
        textDecoration: 'none',
        textAlign: 'center' as const,
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        border: emailColors.buttonBorder,
        boxShadow: emailColors.buttonShadow,
    },
};
