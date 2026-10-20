import {
    Body,
    Container,
    Head,
    Html,
    Preview,
} from '@react-email/components';
import * as React from 'react';
import { emailColors } from '../email-theme';

interface EmailLayoutProps {
    preview: string;
    children: React.ReactNode;
}

/**
 * 通用邮件布局组件
 *
 * 提供统一的邮件外层结构和主题样式
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
            <Body style={styles.body}>
                <Container style={styles.container}>
                    {children}
                </Container>
            </Body>
        </Html>
    );
}

const styles = {
    body: {
        backgroundColor: emailColors.background,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        color: emailColors.foreground,
        margin: 0,
        padding: 0,
    },
    container: {
        margin: '0 auto',
        padding: '24px 20px 48px',
        maxWidth: '600px',
    },
};
