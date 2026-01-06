# Claude Code Guidelines

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
