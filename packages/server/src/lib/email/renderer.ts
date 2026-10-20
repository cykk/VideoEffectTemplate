import { render } from '@react-email/render';
import { MagicLinkEmail } from '@markless/shared/src/emails/magic-link';
import type { Locale } from '@markless/shared/src/i18n/types';

export async function renderMagicLinkEmail(
    email: string,
    url: string,
    locale: Locale = 'en'
): Promise<{ html: string; text: string }> {
    const component = MagicLinkEmail({
        magicLinkUrl: url,
        userEmail: email,
        locale,
    });

    const html = await render(component, {
        pretty: false,
    });

    const text = await render(component, {
        plainText: true,
    });

    return { html, text };
}
