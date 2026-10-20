export function formatAuthCopy(
    template: string,
    credits: number,
    minutes: number = credits
): string {
    return template
        .replace(/\{credits\}/g, String(credits))
        .replace(/\{minutes\}/g, String(minutes));
}
