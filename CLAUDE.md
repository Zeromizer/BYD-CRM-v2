# Claude Code Guidelines

## Local Development Server

To run the local development server on Windows:

```bash
powershell -Command "Start-Process cmd -ArgumentList '/c cd /d c:\Coding\BYD-CRM-v2 && npm run dev' -NoNewWindow"
```

Or run in a separate terminal:
```bash
npm run dev
```

**Server URL:** http://localhost:5173/BYD-CRM-v2/

The Vite dev server provides HMR (Hot Module Replacement) for instant updates.

---

## Context7 Documentation Checks

For **major changes** (new features, dependency updates, library API usage), check Context7 for the latest documentation before writing code:

1. `resolve-library-id("library-name")` - Get the Context7 library ID
2. `query-docs(libraryId, "specific question")` - Query current documentation

**When to check:**
- Adding or upgrading dependencies
- Using library features not recently verified
- Implementing patterns that may have changed (state management, routing, etc.)

**When to skip:**
- Small bug fixes in existing code
- CSS/styling changes
- Business logic that doesn't involve library APIs
