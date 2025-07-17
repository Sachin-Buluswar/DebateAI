# UI/UX System Design Document

## Purpose
This living document captures the core design decisions, structure, and guidelines for the DebateAI user interface and experience. It focuses on the foundational UI pillars (Information Architecture, Key User Flows, Design System & Component Library, Visual Language & Branding) and will be updated iteratively as the product evolves.

## Version History
- **v0.2** (2024-06-XX): Implemented foundational UI elements (Pillars 2, 4, 5) - Layout, Navigation, Core Styles & Tokens.
- **v0.1** (2024-06-XX): Initial draft covering Pillars 2–5 (UI-focused).  

## UI/UX Tasks Status
- ✅ Pillar 2: Information Architecture & Navigation (Basic Layout & Navbar implemented)
- ⏱️ Pillar 3: Key User Flows (Foundation laid, detailed flows pending)
- ✅ Pillar 4: Design System & Component Library (Core tokens & base component styles implemented)
- ✅ Pillar 5: Visual Language & Branding (Colors, Typography, Icons setup)

---

### 1. Information Architecture & Navigation (Pillar 2)
1.1 Top‑Level Sections
- Home (Landing)  
- Dashboard (Overview of activity & metrics)  
- Debate Simulator (Real-time debate interface)  
- Speech Feedback (Upload/record and analysis)  
- Wiki Search (Semantic document lookup)  
- History (Past debates & feedback)  
- Preferences (Profile & settings)  
- Help (Docs and support)

1.2 Global Header
- Persistent header across all screens  
- Left: Logo & App name (links to Home)  
- Center: Primary navigation links with active‑state highlight  
- Right: Theme toggle, notifications badge, user avatar & dropdown

1.3 Collapsible Sidebar (Desktop)
- Secondary navigation and context switches  
- E.g. debate modes (Public Forum, Crossfire), speech‐type filters  
- Auto‑collapse on narrow viewports or per‑page override

1.4 Mobile Navigation
- Hamburger menu to toggle full nav panel  
- Bottom tab bar as optional alternative for main sections  
- Slide‑in sidebar for deeper context menus

1.5 Breadcrumbs & Page Context
- Show breadcrumb trail on deep pages (e.g. Debate > Turn 3)  
- Allow quick navigation back to parent views  
- Consistent placement just below header

---

### 2. Key User Flows (Pillar 3)
2.1 Onboarding & First Run
- Clean signup flow (email, SSO) with URL‑based redirects  
- Interactive walkthrough overlay pointing out: Dashboard, Start Debate, Upload for Feedback, Wiki Search  
- Sample debate or speech feedback session as demo mode

2.2 Create & Join a Debate
- Multi‑step wizard:  
  • Step 1: Format selection (timed, crossfire)  
  • Step 2: Topic input (text or AI‑suggested)  
  • Step 3: Participant invites (email or link)  
  • Step 4: Timing & rules configuration  
- Real‑time lobby view with avatars, ready toggles, chat
- One‑click start that transitions into live debate UI

2.3 Live Debate Interface
- Full‑screen focused view  
- Left pane: Live transcript with speaker labels  
- Right pane: Speaker video/mic animation  
- Floating toolbar: Next‑turn timer, hand‑raise button, mute/skip  
- Slide‑out panel: Chat, private notes, AI suggestions
- Context hints: "Potential rebuttal point" or "Fact check available" popovers

2.4 Speech Feedback Workflow
- Upload or record audio widget with clear status indicators  
- Live waveform + transcription streaming  
- Sidebar rubric showing metrics (pace, fillers, clarity) updating in real time  
- After‑action report page: Charts (radar, line graphs), expandable sections, share/export controls
- Tagging and saving to history with user‑defined labels

2.5 Search & Reference (Wiki Search)
- Two‑pane layout: Query & filters on left, preview on right  
- Typeahead autocomplete, query history  
- Filter chips (source, date range, topic)  
- "Pin to Debate" button on results to add context in simulator

2.6 History & Progress
- Dashboard tiles for each past session with date/topic  
- Timeline slider on detail pages for replay of transcripts/audio  
- Progress badges (e.g. filler reduction, average pace)

---

### 3. Design System & Component Library (Pillar 4)
3.1 Design Tokens
- Colors: Primary, secondary, accent, neutrals, semantic (success, warning, error)  
- Typography: Font families, sizes, weights, line heights  
- Spacing: 4‑point baseline scale (4px, 8px, 16px…)  
- Shadows: Elevation levels for cards, modals, tooltips  
- Breakpoints: xs, sm, md, lg, xl per Tailwind default + custom overrides

3.2 Component Inventory
- Buttons (primary, secondary, ghost, icon)  
- Form controls (inputs, selects, toggles, radios, checkboxes)  
- Cards & Panels (info, interactive, dashboards)  
- Modals & Drawers (standard, full‑screen, confirm)  
- Tooltips & Popovers  
- Tables, Lists, Tabs
  
- Charts & Data Viz primitives (bar, line, radar)

3.3 Theming & Variants
- Light & Dark modes via CSS variables  
- Component variants for size and state (hover, active, disabled)  
- RTL support for future localization

3.4 Storybook Integration
- Organize stories by category: Layout, Navigation, Forms, Data Display, Feedback  
- Add knobs/controls for dynamic props  
- Include accessibility panel to validate ARIA roles

3.5 Accessibility Guidelines
- Use semantic HTML and ARIA roles  
- Keyboard focus styles for all interactive elements  
- Color contrast checks (WCAG 2.1 AA)  
- Screen reader announcements for live regions (e.g. streaming transcript)

---

### 4. Visual Language & Branding (Pillar 5)
4.1 Color Palette
- Primary: Deep Indigo (#4F46E5)  
- Accent: Teal (#14B8A6)  
- Neutrals: Gray 50–900  
- Semantic: Error (Red 600), Warning (Amber 500), Success (Green 500)

4.2 Typography Scale
- Headings: Inter 700 (32px, 24px, 20px)  
- Body: Inter 400 (16px, 14px)  
- Code/Monospace: Source Code Pro 400 (14px)

4.3 Iconography
- Heroicons 2.0 set  
- Standard sizes: 16px (buttons), 24px (navigation), 32px (panels)  
- Guidelines for custom icons: stroke width, fill vs outline, clear grid alignment

4.4 Imagery & Illustration
- Use minimal, flat‑style illustrations for empty states  
- Consistent avatar/user placeholders  
- Specify aspect ratios and safe areas for images

4.5 Motion & Interaction
- Easing curves: ease-in-out, ease-out-quint  
- Timing: micro (50ms), short (150ms), medium (300ms), long (500ms)  
- Use Framer Motion for key transitions (page load, sidebar slide, modals)

4.6 Branding Assets
- Logo variants (full, mark-only) in SVG and PNG  
- Clear space and minimum size rules  
- Usage guidelines for dark vs light backgrounds

---

### 5. Next Steps & Iteration
- Collect user feedback on IA and flows via usability tests  
- Refine component library based on dev integration challenges  
- Expand to include Performance & Loading (Pillar 6) and Accessibility (Pillar 7)  
- Track changes in version history as designs evolve  
- Sync with implementation backlog and update `tasklist.md` accordingly  