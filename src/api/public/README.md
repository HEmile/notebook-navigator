# Public API Type Definitions

This folder contains TypeScript type definitions for external plugin developers who want to integrate with the Notebook
Navigator API.

## Files

### `notebook-navigator.d.ts`

Complete TypeScript type definitions for the Notebook Navigator API.

**For Plugin Developers:**

1. Download this file to your plugin project
2. Import the types in your code:
   ```typescript
   import type { NotebookNavigatorAPI } from './notebook-navigator';
   ```
3. Use with the API:
   ```typescript
   const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI | undefined;
   if (!nn) {
     return;
   }
   ```

**For Maintainers:**

- This file must be kept in sync with the actual API implementation
- Update the version number in the file header when making API changes
- This is the single source of truth for external TypeScript users

## Version

Current API Version: **2.0.0**

## Documentation

Full API documentation: [docs/api-reference.md](../../../docs/api-reference.md)
