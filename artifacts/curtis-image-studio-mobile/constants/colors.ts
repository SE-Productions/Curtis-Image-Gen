/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#172239',
    tint: '#dc7440',
    background: '#f7f4ef',
    foreground: '#172239',
    card: '#fcfaf7',
    cardForeground: '#172239',
    primary: '#dc7440',
    primaryForeground: '#ffffff',
    secondary: '#d8dce3',
    secondaryForeground: '#172239',
    muted: '#e9e5df',
    mutedForeground: '#606a7c',
    accent: '#d8dce3',
    accentForeground: '#172239',
    destructive: '#dc4040',
    destructiveForeground: '#ffffff',
    border: '#ded8cf',
    input: '#ded8cf',
  },
  dark: {
    text: '#f7f4ef',
    tint: '#dc7440',
    background: '#0f1826',
    foreground: '#f7f4ef',
    card: '#152033',
    cardForeground: '#f7f4ef',
    primary: '#dc7440',
    primaryForeground: '#ffffff',
    secondary: '#29364a',
    secondaryForeground: '#f7f4ef',
    muted: '#223047',
    mutedForeground: '#aab3c2',
    accent: '#29364a',
    accentForeground: '#f7f4ef',
    destructive: '#dc4040',
    destructiveForeground: '#ffffff',
    border: '#29364a',
    input: '#29364a',
  },

  radius: 8,
};

export default colors;
