# LifeOS Design System

This document outlines the design system for LifeOS, derived directly from the existing codebase implementations, primarily `frontend-react/css/styles.css` and the usage of Tailwind CSS classes in React components.

## 1. Brand & Identity
**Product Name:** LifeOS (A Health Portal / Dashboard)
**Aesthetic:** "UI 2.1 Aesthetic" (Blue/Cyan Gradient, Glassmorphism, Modern Data-Heavy UI)
**Vibe:** Secure, Medical, Modern, Data-Driven

## 2. Typography
The system uses **Inter** as the primary font for both headings and body text, ensuring a clean, modern, and highly legible appearance.
- **Font Family:** `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Headings:** Bold (700) to Extra Bold (800)
- **Body:** Regular (400) to Medium (500)
- **Base Size:** 16px (1rem), derived from standard browser defaults.

## 3. Design Tokens (CSS Variables)

The styling architecture uses CSS Custom Properties (`--var`) mapped onto a global `:root` scope, with overrides for `[data-theme="dark"]`. Tailwind is also utilized alongside these variables.

### Color Palette

**Primary (Blues)**
- `--primary`: `#2563eb`
- `--primary-light`: `#3b82f6`
- `--primary-dark`: `#1d4ed8`
- *Dark Mode Shift:* `--primary` becomes `#60A5FA`

**Secondary (Cyans)**
- `--secondary`: `#06b6d4`
- `--secondary-light`: `#22d3ee`
- `--secondary-dark`: `#0891b2`

**Status Colors**
- **Success:** `--success` `#22c55e`
- **Warning:** `--warning` `#f59e0b`
- **Danger:** `--danger` `#ef4444`
- **Info:** `--info` `#3b82f6`

**Backgrounds (Light Mode)**
- `--bg-color` (App background): `#f0f4ff`
- `--panel-bg`: `#ffffff`
- `--bg-secondary`: `#f1f5f9`

**Backgrounds (Dark Mode)**
- `--bg-color`: `#0F172A` (Deep Slate)
- `--panel-bg`: `#1B2435`
- `--bg-tertiary` / `--bg-card`: `#1E293B`

**Text Colors**
- `--text-main`: `#0f172a` (Light Mode) / `#F8FAFC` (Dark Mode)
- `--text-muted`: `#94a3b8`

### Spacing & Sizing
- **XS:** `4px`
- **SM:** `8px`
- **MD:** `16px`
- **LG:** `24px`
- **XL:** `32px`
- **2XL:** `48px`
- **3XL:** `64px`

### Border Radius
- **SM:** `12px`
- **MD:** `16px`
- **LG:** `20px` (via `--border-radius`)
- **XL:** `24px`
- **Full:** `50px`

## 4. Theming (Light / Dark Mode)
The application supports an isolated dark mode system. 
- **Mechanism:** Dark mode is triggered by adding a `data-theme="dark"` attribute to a wrapper element (or relying on Tailwind's `class="dark"` for utility classes).
- **Isolation:** The architecture separates theming into Landing Page, App Dashboard (User), and Admin Panel. These three contexts maintain isolated state keys (`landing_theme`, `user_theme`, `admin_theme`).

## 5. Layout Architecture

**Dashboard Layout (`.app-container`)**
The main application layout uses a 3-column CSS Grid constraint, max-width capped at 1440px:
1. **Sidebar (`--sidebar-width: 260px`)**: Navigation, logo, user profile.
2. **Main Content (`1fr`)**: Primary interactive area (`.main-content`).
3. **Right Panel (`--right-panel-width: 320px`)**: Contextual actions, secondary information.

**Responsive Behavior**
- *Assumption:* The desktop 3-column grid collapses on mobile devices to a single-column view using media queries (often handled by `.mobile-header` becoming visible and hiding standard sidebars).

## 6. Components & Patterns

- **Gradients:** Extensive use of linear gradients, e.g., `--primary-gradient: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)` for active states and brand accents.
- **Glassmorphism:** Used for overlays and sticky headers.
  - `--glass-blur: blur(16px)`
  - `--bg-glass: rgba(255, 255, 255, 0.85)`
- **Shadows:** Soft, layered shadows (`--shadow-md`, `--shadow-lg`) providing depth without harsh borders.
- **Navigation Items (`.sidebar-nav-item`)**: Pill-shaped, subtle hover backgrounds (`rgba(37, 99, 235, 0.06)`), and a solid gradient fill for the active state.

## 7. Guidelines for Future Development

1. **Prioritize CSS Variables:** When writing custom CSS, always reference `var(--bg-...)` and `var(--text-...)` rather than hardcoding colors. This ensures dual-theme compatibility.
2. **Tailwind Coexistence:** Tailwind utility classes are heavily utilized in the JSX components. When using Tailwind for colors, prefer standard slate/blue classes that map closely to the brand, and utilize the `dark:` variant correctly nested inside the respective theme wrapper.
3. **Accessibility:** Text colors have been structured for contrast (e.g., `#0f172a` on `#f0f4ff`). Ensure future components maintain WCAG AA contrast by pairing `--text-main` with `--bg-color` or `--bg-card`.
