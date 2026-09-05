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
4. Call `await nn.whenReady()` before storage-backed reads or tag/property navigation that depends on the storage mirror.

## Public Surface

`notebook-navigator.d.ts` mirrors the runtime API exposed at
`app.plugins.plugins['notebook-navigator']?.api`.

- Core methods: `getVersion()`, `isStorageReady()`, `whenReady()`, `on(...)`, `once(...)`, `off(...)`
- Namespaces: `metadata`, `navigation`, `selection`, `menus`, `tagCollections`, `propertyNodes`
- Exported types: metadata records and updates, navigation and selection state, pin contexts, tag collections, property
  nodes, menu extension contexts, event names, and event payloads

**For Maintainers:**

- This file must be kept in sync with the actual API implementation
- Keep the version in the file header, this README, and `src/api/version.ts` aligned when making API changes
- The declaration file is the TypeScript compatibility contract for external users
- Full behavior notes live in `docs/api-reference.md`

## Version

Current API Version: **2.0.0**

## Documentation

Full API documentation: [docs/api-reference.md](../../../docs/api-reference.md)
