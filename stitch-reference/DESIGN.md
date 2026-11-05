---
name: RecallOps Industrial Intelligence
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#424754'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  telemetry-num:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets reliability engineers, plant maintenance leads, and industrial diagnostics technicians operating in high-stakes environments. The brand personality conveys mechanical precision, rigorous accountability, and unclouded operational insight. The interface eliminates cognitive noise, transforming fragmented machine telemetry and historical maintenance logs into actionable triage decisions.

The design philosophy combines **Corporate / Modern utilitarianism** with **High-Density Data Precision**:
- **Structured Precision**: Interfaces prioritize dense data matrices, rigorous grid lines, and high-readability telemetry without visual bloat.
- **Cognitive Clarity**: Sharp contrast distinctions separate automated AI hypotheses from empirically verified engineering outcomes.
- **Physical Grounding**: Tactile state indicators and crisp 1px borders mimic precision digital diagnostic hardware.

## Colors

The system uses a bifurcated dual-canvas environment: a permanent deep-navy operational anchor for navigation and telemetry status, set against an ultra-clean, high-efficiency light slate workspace.

### Core Architecture
- **Navigation Anchor (`#111827`)**: Deep Navy grounding the global side-rail, telemetry status strips, and persistent device context headers.
- **Workspace Canvas (`#F8FAFC`)**: Light slate backdrop engineered for 10-hour desk shifts, maximizing contrast while minimizing glare.
- **Surface Elevation (`#FFFFFF`)**: Pure white data containers, audit logs, and diagnostic inspection cards.
- **Primary Operational Accent (`#3B82F6`)**: Vivid industrial blue for active states, selected work orders, and interactive workflow drivers.

### Diagnostic & Status Accents
- **Verified Success (`#10B981` & `#0D9488`)**: Emerald and deep teal designate empirically validated repairs, zero-vibration confirmations, and certified component replacements.
- **Cautionary Diagnostics (`#F59E0B`)**: Industrial amber for operating warnings, scheduled preventive maintenance thresholds, and degraded sensor telemetry.
- **Critical Alerts & Failures (`#EF4444`)**: High-visibility rose/crimson dedicated exclusively to asset trips, unverified repairs, telemetry threshold violations, and urgent work orders.

### AI & Retrieval Distinctions
- **AI Hypothesis Layer (`#8B5CF6` on `#F5F3FF`)**: Violet tinting reserves cognitive real estate for generative failure mode predictions and synthetic root-cause analyses.
- **Recall Memory Layer (`#0284C7` on `#F0F9FF`)**: Sky-tinted badges and highlights denote deterministic vector retrieval matches from plant historical archives.

## Typography

Inter serves as the foundational typography system across all density thresholds. It guarantees maximum glyph disambiguation across complex industrial codenames, component serials, and tight tabular spreads.

- **Tabular Figures**: Enable OpenType tabular numbers (`tnum`) globally for all table rows, metric tiles, timestamp logs, and sensor arrays.
- **Serial & Code Display**: Asset tags (`e.g., PUMP-BRG-412A`) and ISO error codes render with `label-sm` or `body-sm` using medium/semibold weights to preserve edge crispness on non-retina industrial floor panels.
- **Hierarchy Enforcement**: Page title headlines are restrained to 24px–32px to protect vertical density and display above-the-fold telemetry widgets immediately.

## Layout & Spacing

The layout model is built upon a fluid 12-column engineering grid calibrated for complex instrumentation panels, telemetry cards, and multi-pane triage inspectors.

- **Grid Architecture**: 12-column layout with 20px (`1.25rem`) gutters on desktop screens (>1280px), transitioning to 8 columns with 16px (`1rem`) gutters on tablet breakpoints (768px–1279px), and 4 columns on mobile diagnostics screens (<768px).
- **Navigation Frame**: The `#111827` navigation sidebar occupies a fixed 64px collapsed icon width or 240px expanded width, pushing the fluid `#F8FAFC` workspace.
- **Split-Pane Diagnostics**: Complex work order pages default to a 60/40 structural split: 60% dedicated to operational logs and timeline graphs; 40% reserved for AI causal inference and verified retrieval context cards.
- **Rhythm**: Compact element gap tokens (`0.25rem` to `0.75rem`) dominate tabular interfaces to preserve vertical visual density and limit viewport scrolling during active triage.

## Elevation & Depth

This system intentionally departs from heavy blurred drop shadows, utilizing crisp 1px structural outlines and restrained ambient offsets to deliver an authoritative instrumentation feel.

- **Base Level (Canvas)**: Background canvas (`#F8FAFC`) with no elevation.
- **Surface Level 1 (Panels & Data Tables)**: Crisp `#FFFFFF` surface enclosed by a 1px border (`#E2E8F0`). Flat elevation with a micrometric ambient foundation (`box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04)`).
- **Surface Level 2 (Interactive Cards & Flyouts)**: Lifted cards and inspection modals use a sharp border (`#CBD5E1`) paired with a tight offset (`box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`).
- **Overlay Level 3 (Command Palette & Triage Overlays)**: Crisp outline (`#94A3B8`) backed by a centered dispersion shadow (`box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.15)`).
- **Dark Navigation Surfaces**: Surfaces on `#111827` rely exclusively on 1px stroke boundaries (`#1F2937`) with zero drop shadow to preserve contrast against light panels.

## Shapes

The interface embraces a low-radius, architectural shape profile (Level 1: Soft). 

- **Containers and Data Tables**: Standard cards, table wrappers, panels, and telemetry containers utilize `4px` (`0.25rem`) corner radiuses.
- **Interactive Badges and Action Controls**: Input fields, buttons, and alert pills use `4px` corner radiuses to reinforce structural precision.
- **Pill Exceptions**: Status dot wrappers and numeric counter pips leverage full-round pill geometry (`9999px`) solely to distinguish atomic badges from rectangular card boundaries.
- **Borders**: All shape perimeters enforce uniform 1px solid vectors. No 2px or decorative thick-stroke outer outlines.

## Components

### Buttons
- **Primary Operational**: Solid `#3B82F6` background, `#FFFFFF` text, `4px` radius, medium weight. Hover: `#2563EB`. Active: `#1D4ED8`. Focus: 2px offset ring in `#93C5FD`.
- **Verified Action (Success/Execution)**: `#10B981` background, `#FFFFFF` text. Used exclusively to commit validated corrective procedures.
- **Secondary Destructive**: Pure `#FFFFFF` ground with `#EF4444` border and text. Hover: `#FEF2F2`.
- **Tertiary / Subdued**: Ghost styling, no border, `#475569` text. Hover: `#F1F5F9`.

### Chips & Badges
- **Historical Memory Retrieval**: Sky Blue theme (`#F0F9FF` background, `#0284C7` text, `#BAE6FD` 1px border). Prefixed with a Lucide `Database` or `History` 12px icon.
- **AI Hypothesis**: Violet theme (`#F5F3FF` background, `#7C3AED` text, `#DDD6FE` 1px border). Prefixed with a Lucide `Sparkles` or `BrainCircuit` 12px icon.
- **Verified Successful Repair**: Emerald theme (`#ECFDF5` background, `#047857` text, `#A7F3D0` 1px border). Prefixed with a Lucide `CheckCheck` icon.
- **Unsuccessful / Aborted Attempt**: Rose theme (`#FEF2F2` background, `#B91C1C` text, `#FECACA` 1px border). Prefixed with a Lucide `XCircle` icon.
- **Active Warning**: Amber theme (`#FFFBEB` background, `#B45309` text, `#FDE68A` 1px border). Prefixed with a Lucide `AlertTriangle` icon.

### Form Inputs & Controls
- **Input Fields**: Background `#FFFFFF`, border 1px solid `#CBD5E1`, text `#0F172A`, placeholder `#94A3B8`. Height fixed to 32px for high-density entry forms or 36px standard. Focus state changes border to `#3B82F6` with zero shadow blur.
- **Checkboxes & Radios**: 16px square/circle, border 1px solid `#94A3B8`. Selected fill `#3B82F6` with crisp internal checkmark/dot.

### Tables & Dense Lists
- **Data Rows**: 36px compact height for high-density inspection, 44px for primary work order listings. Alternating rows use `#FFFFFF` and `#F8FAFC`. Hover state: `#F1F5F9`.
- **Column Headers**: Uppercase `11px`, tracking `0.05em`, weight `600`, color `#64748B`, background `#F1F5F9`, bottom border 1px solid `#CBD5E1`.
- **Numeric Alignment**: All telemetry and currency columns right-align with monospace tabular numerals.

### Diagnostic Cards & Triage Panels
- Card structures feature a distinct 32px header section divided by a 1px border `#F1F5F9`.
- Body areas maintain tight 12px internal padding (`space-md`) to ensure critical metric cards (MTTR, Vibration RMS, Heat Index) remain visible simultaneously on single-screen monitoring consoles.