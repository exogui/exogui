/** Set theme by swapping the theme stylesheet href */
export function setTheme(themeName: string | undefined): void {
    const themeLink = document.querySelector(
        "link[data-theme=\"true\"]"
    ) as HTMLLinkElement;

    if (!themeLink) {
        console.warn("Could not find theme link element");
        return;
    }

    if (themeName) {
        themeLink.href = `./styles/themes/${themeName}`;
    }
}
