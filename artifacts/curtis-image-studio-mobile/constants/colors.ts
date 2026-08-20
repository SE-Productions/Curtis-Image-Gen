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
  // Harmonized with Curtis Image Studio brand — screenshot-refined palette
  // Background: warm beige | Cards: pure white | Accent: terracotta coral
  // Text: near-black | Labels: cool slate | Header/nav: black
  light: {
    background: '#F9F6F0',   // warm beige (matches screenshot bg)
    foreground: '#1A1A1A',   // near-black text
    card: '#FFFFFF',          // pure white (no border in screenshot)
    cardForeground: '#1A1A1A',
    primary: '#D95F3B',       // terracotta coral (screenshot accent)
    primaryForeground: '#FFFFFF',
    secondary: '#E9E5DF',    // light warm gray (upload icon bg, secondary surfaces)
    secondaryForeground: '#1A1A1A',
    muted: '#64748B',        // cool slate (labels, subtitles, placeholders)
    mutedForeground: '#64748B',
    accent: '#1E293B',       // navy (toolbar active bg, logo bg)
    accentForeground: '#FFFFFF',
    destructive: '#DC4040',
    destructiveForeground: '#FFFFFF',
    border: '#E9E5DF',      // subtle warm divider
    input: '#E9E5DF',       // input border
    tint: '#D95F3B',        // terracotta (icon tint)
    text: '#1A1A1A',        // near-black
  },
  dark: {
    background: '#0F1826',   // deep navy (keeps dark feel)
    foreground: '#F9F6F0',  // warm off-white text
    card: '#1A2535',        // slightly lighter navy
    cardForeground: '#F9F6F0',
    primary: '#D95F3B',     // terracotta (same in dark)
    primaryForeground: '#FFFFFF',
    secondary: '#29364A',
    secondaryForeground: '#F9F6F0',
    muted: '#94A3B8',       // lighter slate for dark mode
    mutedForeground: '#94A3B8',
    accent: '#1E293B',
    accentForeground: '#FFFFFF',
    destructive: '#DC4040',
    destructiveForeground: '#FFFFFF',
    border: '#29364A',
    input: '#29364A',
    tint: '#D95F3B',
    text: '#F9F6F0',
  },

  radius: 8,
};

export default colors;
