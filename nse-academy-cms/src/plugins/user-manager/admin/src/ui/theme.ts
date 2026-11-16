import { useTheme } from 'styled-components';

/**
 * Colours for charts and custom markup, read from the Strapi admin's own theme so they follow light and dark mode. (The
 * older pages hard-code hex values such as #fff and #eafbe7, which is why they look wrong in dark mode.)
 */
export function usePalette() {
  const c = (useTheme() as any).colors;
  return {
    text: c.neutral800 as string,
    muted: c.neutral600 as string,
    faint: c.neutral500 as string,
    border: c.neutral200 as string,
    soft: c.neutral150 as string,
    surface: c.neutral0 as string,
    surfaceAlt: c.neutral100 as string,
    primary: c.primary600 as string,
    primarySoft: c.primary100 as string,
    success: c.success600 as string,
    successSoft: c.success100 as string,
    danger: c.danger600 as string,
    dangerSoft: c.danger100 as string,
    warning: c.warning600 as string,
    warningSoft: c.warning100 as string,
    // Categorical series: distinguishable, calm, and not dependent on red/green alone.
    series: [c.primary600, c.secondary500 ?? '#66b7f1', c.alternative500 ?? '#ac73e5', c.warning500 ?? '#f29c3c', c.success500 ?? '#5cb176', c.danger500 ?? '#ee5e52'] as string[],
  };
}

export type Palette = ReturnType<typeof usePalette>;
