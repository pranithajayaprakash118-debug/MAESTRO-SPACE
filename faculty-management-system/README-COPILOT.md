# Faculty Management System — Cleaned Structure

This project has been standardized around one shared Maestro Space layout.

## Shared layout
- `components/sidebar.html` — single source of truth for the sidebar.
- `components/topbar.html` — single source of truth for the topbar.
- `js/layout.js` — loads the shared layout, selects the active page automatically, and loads faculty identity/profile picture.
- `css/style.css` — shared shell styling.

## Important rule for future changes
Do not duplicate the sidebar or topbar into individual pages.

If the sidebar/topbar design needs to change, edit the shared component files and shared CSS.

## Existing functionality
Page-specific HTML and JavaScript were preserved as much as possible. Do not rewrite working page functionality when making layout changes.

## Running
Use VS Code Live Server (or another local HTTP server) because the shared components are loaded with `fetch()`. Opening HTML files directly with `file://` will not load the shared components correctly.

## Copilot instruction
Before modifying a page, inspect the existing shared layout and preserve it. Make only the requested page-specific change unless explicitly asked to change the shared layout.
