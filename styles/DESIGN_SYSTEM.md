# ServiceFlow — Gushwork-aligned design system

Reference reviewed: `https://www.gushwork.ai/leads-dashboard`  
Design snapshot: 2026-09-16

This theme intentionally aligns ServiceFlow with the current Gushwork visual language without copying Gushwork logos, imagery, or marketing copy.

## Extracted visual principles

### 1. Color
- Primary action blue: `#3157F6`
- Canvas: `#F7F8FB`
- Surface: `#FFFFFF`
- Primary text: `#111827`
- Secondary text: `#344054`
- Muted text: `#667085`
- Borders: `#E6E9EF`
- Green success: `#16794C`
- Red urgency: `#C9364F`
- Amber attention: `#9A6507`

### 2. Typography
- Clean modern sans-serif.
- ServiceFlow uses an Inter/system stack rather than attempting to copy an unknown/proprietary webfont.
- Large headings: dark, compact, slightly negative tracking.
- Labels/eyebrows: small uppercase, muted, wide tracking.
- Body copy: medium gray with comfortable line-height.

### 3. Surfaces
- White cards on a very light gray canvas.
- Thin neutral borders instead of strong drop shadows.
- Shadows are subtle and mostly reserved for floating UI/modal states.
- Typical radii: 8–16px.

### 4. Navigation
- Light sidebar rather than a dark navigation rail.
- Blue square product mark.
- Active navigation uses a pale-blue fill and blue foreground.
- Inactive navigation remains muted and low contrast.

### 5. Controls
- Primary buttons are saturated blue with restrained elevation.
- Secondary buttons are white with a thin border.
- Inputs use compact 8px corners, neutral borders, and a blue focus ring.
- Statuses use low-saturation tinted pills.

### 6. Density
- Product UI is compact rather than marketing-page spacious.
- Repeated rows/cards have low visual weight.
- Information hierarchy comes from typography, borders, and spacing rather than decorative effects.

## Keeping ServiceFlow visually in sync

All Gushwork-aligned overrides live in `gushwork-theme.css`.

For future visual refreshes, update the `--gw-*` tokens at the top of that file first. Most of the application will update automatically because legacy ServiceFlow variables are mapped onto those tokens.

The application keeps its own ServiceFlow identity and workflow. Do not copy Gushwork logos, screenshots, customer assets, or proprietary graphics into the prototype.
