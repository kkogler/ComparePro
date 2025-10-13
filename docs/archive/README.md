# Documentation Archive

This folder contains historical documentation that has been archived for reference.

---

## Contents

### `fixes/` - Bug Fix Summaries (21 files)
Documentation created during bug fix sessions. These capture the problem, root cause, and solution for significant bugs that were fixed.

**Why archived:**
- Fixes are now tracked in git commit messages
- These docs were created for immediate reference
- Git history provides better tracking

**When to reference:**
- Understanding why a particular change was made
- Investigating similar bugs
- Learning from past fixes

---

### `progress/` - Progress Tracking (8 files)
Temporary progress documents created during development sessions.

**Why archived:**
- Temporary documents no longer needed
- Progress tracked in git history
- Cleanup completed

**When to reference:**
- Historical context of development process
- Understanding evolution of codebase

---

### `migrations/` - Migration Documentation (4 files)
Documentation for major migrations and refactoring efforts.

**Why archived:**
- Migrations completed
- Information preserved in migration files
- Git history provides context

**When to reference:**
- Understanding past architectural decisions
- Planning similar migrations
- Learning from migration process

---

## Archive Date

All documents archived: October 13, 2025

## Retrieval

These files are preserved in git history and can be retrieved if needed:

```bash
# List archived files
ls -R docs/archive/

# View a specific archived file
cat docs/archive/fixes/LIPSEY_FIX_SUMMARY.md

# Search all archived files
grep -r "search term" docs/archive/
```

---

## Best Practices Going Forward

Instead of creating fix summaries:
1. Write detailed commit messages
2. Reference issue numbers
3. Use git log for tracking
4. Only document major features

**Example commit message format:**
```
fix: Brief description of fix

ISSUE: What was broken
ROOT CAUSE: Why it was broken  
FIX: How it was fixed
RESULT: What works now
```

