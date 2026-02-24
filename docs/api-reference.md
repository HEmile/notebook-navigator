# Notebook Navigator API Reference

Updated: February 24, 2026

The Notebook Navigator plugin exposes a public API for other plugins and scripts to interact with navigator features.

**Current API Version:** 1.3.0

## Table of Contents

- [Quick Start](#quick-start)
- [API Overview](#api-overview)
- [Metadata API](#metadata-api)
  - [Folder, Tag, and Property Metadata](#folder-tag-and-property-metadata)
  - [Pinned Files](#pinned-files)
- [Navigation API](#navigation-api)
- [Selection API](#selection-api)
- [Menus API](#menus-api)
- [Events](#events)
- [Core API Methods](#core-api-methods)
- [TypeScript Support](#typescript-support)
- [Changelog](#changelog)

## Quick Start

### Accessing the API

The Notebook Navigator API is available at runtime through the Obsidian app object. Here's a practical example using
Templater:

```javascript
<%* // Templater script to pin the current file in Notebook Navigator
const nn = app.plugins.plugins['notebook-navigator']?.api;

if (nn) {
  // Pin the current file in folder, tag, and property contexts
  const file = tp.config.target_file;
  await nn.metadata.pin(file);
  new Notice('File pinned in Notebook Navigator');
}
%>
```

Or set a folder color based on the current date:

```javascript
<%* // Set folder color based on day of week
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const folder = tp.config.target_file.parent;
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  const dayColor = colors[new Date().getDay()];

  await nn.metadata.setFolderMeta(folder, { color: dayColor });
}
%>
```

## API Overview

The API provides four main namespaces:

- **`metadata`** - Folder, tag, and property node colors/icons, and pinned files
- **`navigation`** - Navigate to files in the navigator
- **`selection`** - Query current selection state
- **`menus`** - Add items to Notebook Navigator context menus

### Public surface

The supported public surface is the API described in this document and in `src/api/public/notebook-navigator.d.ts`. The
runtime `api` object may contain additional methods and properties; treat them as internal.

Core methods:

- **`getVersion()`** - Get the API version string
- **`isStorageReady()`** - Check if the storage cache is ready

## Metadata API

Customize folder, tag, and property node appearance, manage pinned files.

### Runtime Behavior

- **Icon format**: `IconString` accepts emoji literals (`emoji:📁`) and provider-prefixed values for `lucide`,
  `bootstrap-icons`, `fontawesome-solid`, `material-icons`, `phosphor`, `rpg-awesome`, and `simple-icons`.
- **Icon normalization**: Icon values are normalized before saving (for example, redundant prefixes like `lucide-`,
  `ph-`, and `ra-` are stripped, and `material-icons` identifiers are stored as snake case). Lucide is the default
  provider and may be stored and returned without a `lucide:` prefix (for example, `'folder-open'`).
- **Unsupported providers**: The runtime accepts and persists any string. Unsupported providers or malformed IDs do not
  render and fall back to a default icon.
- **Color values**: Any string is accepted and saved. Invalid CSS colors will not render correctly but won't throw
  errors.
- **Tag normalization**: The `getTagMeta()` and `setTagMeta()` methods automatically normalize tags:
  - Both `'work'` and `'#work'` are accepted as input
  - Tags are case-insensitive: `'#Work'` and `'#work'` refer to the same tag
  - Tags are stored internally without the '#' prefix as lowercase paths
- **Property node normalization**: The `getPropertyMeta()` and `setPropertyMeta()` methods normalize property node ids:
  - Both key ids (`'key:Status'`) and key/value ids (`'key:Status=Done'`) are accepted
  - Keys and values are normalized to lowercase
  - Metadata is stored under canonical node ids (`'key:status'`, `'key:status=done'`)

### Folder, Tag, and Property Metadata

| Method                        | Description                          | Returns                  |
| ----------------------------- | ------------------------------------ | ------------------------ |
| `getFolderMeta(folder)`       | Get all folder metadata              | `FolderMetadata \| null` |
| `setFolderMeta(folder, meta)` | Set folder metadata (partial update) | `Promise<void>`          |
| `getTagMeta(tag)`             | Get all tag metadata                 | `TagMetadata \| null`    |
| `setTagMeta(tag, meta)`       | Set tag metadata (partial update)    | `Promise<void>`          |
| `getPropertyMeta(nodeId)`     | Get all property node metadata       | `PropertyMetadata \| null` |
| `setPropertyMeta(nodeId, meta)` | Set property node metadata (partial update) | `Promise<void>`          |

#### Property Update Behavior

When using `setFolderMeta`, `setTagMeta`, or `setPropertyMeta`, partial updates follow this pattern:

- **`color: 'red'`** - Sets the color to red
- **`color: null`** - Clears the color (removes the property)
- **`color: undefined`** or property not present - Leaves the color unchanged

This applies to all metadata properties (color, backgroundColor, icon). Only properties explicitly included in the
update object are modified.

**TypeScript note**: The runtime uses `null` to clear a property, but the current type definitions use
`Partial<FolderMetadata>` / `Partial<TagMetadata>` / `Partial<PropertyMetadata>` for the `meta` argument (which does not include `null`).

### Pinned Files

Notes can be pinned in different contexts - they appear at the top of the file list when viewing folders, tags, or properties.

#### Pin Methods

| Method                     | Description                                         | Returns            |
| -------------------------- | --------------------------------------------------- | ------------------ |
| `pin(file, context?)`      | Pin a file (defaults to 'all' - all contexts)       | `Promise<void>`    |
| `unpin(file, context?)`    | Unpin a file (defaults to 'all' - all contexts)     | `Promise<void>`    |
| `isPinned(file, context?)` | Check if pinned (no context = any, 'all' = all)     | `boolean`          |
| `getPinned()`              | Get all pinned files with their context information | `Readonly<Pinned>` |

#### Understanding Pin Contexts

Pinned notes behave differently depending on the current view:

- **Folder Context**: When viewing folders in the navigator, only notes pinned in the 'folder' context appear at the top
- **Tag Context**: When viewing tags, only notes pinned in the 'tag' context appear at the top
- **Property Context**: When viewing properties, only notes pinned in the 'property' context appear at the top
- **Multiple Contexts**: A note can be pinned in multiple contexts and appears at the top in each matching view
- **Default Behavior**: Pin/unpin operations default to 'all' (folder, tag, and property contexts)

This supports separate pinned sets for folder, tag, and property views.

```typescript
// Set folder appearance
const folder = app.vault.getFolderByPath('Projects');
if (folder) {
  await nn.metadata.setFolderMeta(folder, {
    color: '#FF5733', // Hex, or 'red', 'rgb(255, 87, 51)', 'hsl(9, 100%, 60%)'
    backgroundColor: '#FFF3E0', // Light background color
    icon: 'lucide:folder-open'
  });

  // Update only specific properties (other properties unchanged)
  await nn.metadata.setFolderMeta(folder, { color: 'blue' });
}

// Pin a file
const file = app.workspace.getActiveFile();
if (file) {
  await nn.metadata.pin(file); // Pins in folder, tag, and property contexts by default

  // Or pin in specific context
  await nn.metadata.pin(file, 'folder');

  // Check if pinned
  if (nn.metadata.isPinned(file, 'folder')) {
    console.log('Pinned in folder context');
  }
}

// Get all pinned files with context info
const pinned = nn.metadata.getPinned();
// Returns: Map<string, { folder: boolean, tag: boolean, property: boolean }>
// Example: Map { "Notes/todo.md" => { folder: true, tag: false, property: true }, ... }

// Iterate over pinned files
for (const [path, context] of pinned) {
  if (context.folder) {
    console.log(`${path} is pinned in folder view`);
  }
}
```

## Navigation API

| Method                     | Description                            | Returns         |
| -------------------------- | -------------------------------------- | --------------- |
| `reveal(file)`             | Reveal and select file in navigator    | `Promise<void>` |
| `navigateToFolder(folder)` | Select a folder in the navigation pane | `Promise<void>` |
| `navigateToTag(tag)`       | Select a tag in the navigation pane    | `Promise<void>` |
| `navigateToProperty(nodeId)` | Select a property node in navigation | `Promise<void>` |

### Reveal Behavior

When calling `reveal(file)`:

- **Opens the Notebook Navigator view** if it is not already open
- **Switches to the file's parent folder** in the navigation pane
- **Expands parent folders** as needed to make the folder visible
- **Selects and focuses the file** in the file list
- **Switches to file list view** if in single-pane mode
- **Rejects** if the navigator view cannot be opened

```typescript
// Navigate to active file
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
  await nn.navigation.reveal(activeFile);
  // File is now selected in its parent folder
}
```

### Folder Navigation Behavior

When calling `navigateToFolder(folder)`:

- Opens the Notebook Navigator view if it is not already open
- Selects the folder in the navigation pane
- Expands parent folders to make the folder visible
- Preserves navigation focus in single-pane mode
- Rejects if the navigator view cannot be opened

### Tag Navigation Behavior

When calling `navigateToTag(tag)`:

- Accepts both `'work'` and `'#work'` formats
- Requires tag data to be available (`storage-ready`)
- Expands the tags root when "All tags" is enabled and collapsed
- Expands parent tags for hierarchical tags (e.g. `'parent/child'`)
- Preserves navigation focus in single-pane mode
- Does nothing if the tag is not present in the current tag tree
- Rejects if the navigator view cannot be opened

### Property Navigation Behavior

When calling `navigateToProperty(nodeId)`:

- Accepts property key and key/value node ids (e.g. `'key:status'`, `'key:status=done'`)
- Normalizes node ids to canonical lowercase form before selection
- Expands the properties root when "All properties" is enabled and collapsed
- Expands the parent key node for key/value selections when needed
- Preserves navigation focus in single-pane mode
- Does nothing if the target node is not present in the current property tree
- Rejects if the navigator view cannot be opened

```typescript
// Wait for storage if needed, then navigate
if (!nn.isStorageReady()) {
  await new Promise<void>(resolve => nn.once('storage-ready', resolve));
}

await nn.navigation.navigateToTag('#work');
await nn.navigation.navigateToProperty('key:status=done');
```

## Selection API

Query the current selection state in the navigator.

`getNavItem()` and `getCurrent()` return the navigator's most recently known state. Selection updates while the navigator
view is active, and navigation selection is restored from localStorage on startup.

| Method         | Description                  | Returns          |
| -------------- | ---------------------------- | ---------------- |
| `getNavItem()` | Get selected folder, tag, or property | `NavItem`        |
| `getCurrent()` | Get complete selection state | `SelectionState` |

```typescript
// Check what's selected
const navItem = nn.selection.getNavItem();
if (navItem.folder) {
  console.log('Folder selected:', navItem.folder.path);
} else if (navItem.tag) {
  console.log('Tag selected:', navItem.tag);
} else if (navItem.property) {
  console.log('Property selected:', navItem.property);
} else {
  console.log('Nothing selected in navigation pane');
}

// Get selected files
const { files, focused } = nn.selection.getCurrent();
```

## Menus API

Register callbacks that add items to Notebook Navigator's folder and file context menus.

Available in API version 1.2.0.

| Method                      | Description                              | Returns                 |
| --------------------------- | ---------------------------------------- | ----------------------- |
| `registerFileMenu(callback)` | Add items to the file context menu      | `() => void`            |
| `registerFolderMenu(callback)` | Add items to the folder context menu  | `() => void`            |

Callbacks run synchronously during menu construction. Add menu items synchronously and do async work in `onClick` handlers.

### File context menu

The file callback receives the clicked file and the effective selection for this menu:

- `context.addItem(...)` - Add a menu item
- `context.file` - The file the menu was opened on
- `context.selection.mode` - `'multiple'` when multiple files are selected and the menu was opened on a selected file
- `context.selection.files` - Snapshot of files for this menu (`'single'` uses `[file]`)

Single selection example:

```typescript
import type { NotebookNavigatorAPI } from './notebook-navigator';

const nn = app.plugins.plugins['notebook-navigator']?.api as Partial<NotebookNavigatorAPI> | undefined;

const dispose = nn?.menus?.registerFileMenu(({ addItem, file, selection }) => {
  if (selection.mode !== 'single') {
    return;
  }

  if (file.extension !== 'md') {
    return;
  }

  addItem(item => {
    item.setTitle('My action').setIcon('lucide-wand').onClick(() => {
      console.log('Clicked', file.path);
    });
  });
});

// If dispose is defined, call dispose() when your plugin unloads
```

Multiple selection example:

```typescript
const dispose = nn?.menus?.registerFileMenu(({ addItem, selection }) => {
  if (selection.mode !== 'multiple') {
    return;
  }

  addItem(item => {
    item.setTitle('My batch action').setIcon('lucide-list-check').onClick(() => {
      console.log('Selected files', selection.files.map(f => f.path));
    });
  });
});
```

### Folder context menu

The folder callback receives:

- `context.addItem(...)` - Add a menu item
- `context.folder` - The folder the menu was opened on

```typescript
const dispose = nn?.menus?.registerFolderMenu(({ addItem, folder }) => {
  addItem(item => {
    item.setTitle('My folder action').setIcon('lucide-folder').onClick(() => {
      console.log('Folder', folder.path);
    });
  });
});
```

## Events

Subscribe to navigator events to react to user actions.

Tag strings in events use canonical form (no `#` prefix, lowercase path). Property node ids use canonical lowercase node ids.

| Event                  | Payload                                         | Description                  |
| ---------------------- | ----------------------------------------------- | ---------------------------- |
| `storage-ready`        | `void`                                          | Storage system is ready      |
| `nav-item-changed`     | `{ item: NavItem }`                             | Navigation selection changed |
| `selection-changed`    | `{ state: SelectionState }`                     | Selection changed            |
| `pinned-files-changed` | `{ files: Readonly<Pinned> }`                   | Pinned files changed         |
| `folder-changed`       | `{ folder: TFolder, metadata: FolderMetadata }` | Folder metadata changed      |
| `tag-changed`          | `{ tag: string, metadata: TagMetadata }`        | Tag metadata changed         |
| `property-changed`     | `{ nodeId: string, metadata: PropertyMetadata }` | Property metadata changed    |

```typescript
// Subscribe to pin changes
nn.on('pinned-files-changed', ({ files }) => {
  console.log(`Total pinned files: ${files.size}`);
  for (const [path, context] of files) {
    console.log(`${path} - folder: ${context.folder}, tag: ${context.tag}`);
  }
});

// Use 'once' for one-time events (auto-unsubscribes)
nn.once('storage-ready', () => {
  // Wait for storage to be ready before querying metadata or pinned files
  console.log('Storage is ready - safe to call read APIs');
  // No need to unsubscribe, it's handled automatically
});

// Use 'on' for persistent listeners
const navRef = nn.on('nav-item-changed', ({ item }) => {
  if (item.folder) {
    console.log('Folder selected:', item.folder.path);
  } else if (item.tag) {
    console.log('Tag selected:', item.tag);
  } else if (item.property) {
    console.log('Property selected:', item.property);
  } else {
    console.log('Navigation selection cleared');
  }
});

const selectionRef = nn.on('selection-changed', ({ state }) => {
  // TypeScript knows 'state' is SelectionState with files and focused properties
  console.log(`${state.files.length} files selected`);
});

// Unsubscribe from persistent listeners
nn.off(navRef);
nn.off(selectionRef);
```

## Core API Methods

| Method                                                                                                       | Description                                      | Returns    |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------- |
| `getVersion()`                                                                                               | Get API version                                  | `string`   |
| `isStorageReady()`                                                                                           | Check if storage cache is ready                  | `boolean`  |
| `on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void)`   | Subscribe to typed event                         | `EventRef` |
| `once<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void)` | Subscribe once (auto-unsubscribes after trigger) | `EventRef` |
| `off(ref)`                                                                                                   | Unsubscribe from event                           | `void`     |

## TypeScript Support

Since Obsidian plugins don't export types like npm packages, you have two options:

### Option 1: With Type Definitions (Recommended)

Download the TypeScript definitions file:

**[📄 notebook-navigator.d.ts](https://github.com/johansan/notebook-navigator/blob/main/src/api/public/notebook-navigator.d.ts)**

Save it to your plugin project and import:

```typescript
import type { NotebookNavigatorAPI, IconString } from './notebook-navigator';

const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI | undefined;
if (!nn) {
  return;
}

// Wait for storage if needed
if (!nn.isStorageReady()) {
  await new Promise<void>(resolve => nn.once('storage-ready', resolve));
}

const folder = app.vault.getFolderByPath('Projects');
if (!folder) {
  return;
}

// Icon strings are type-checked at compile time
const icon: IconString = 'lucide:folder';
await nn.metadata.setFolderMeta(folder, { color: '#FF5733', icon });

// Events have full type inference
nn.on('selection-changed', ({ state }) => {
  console.log(state.files.length);
});
```

### Option 2: Without Type Definitions

```javascript
// Works without type definitions
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Wait for storage if needed, then proceed
  if (!nn.isStorageReady()) {
    await new Promise(resolve => nn.once('storage-ready', resolve));
  }

  const folder = app.vault.getFolderByPath('Projects');
  if (!folder) {
    return;
  }

  await nn.metadata.setFolderMeta(folder, { color: '#FF5733' });
}
```

### Type Safety Features

The type definitions provide:

- **Template literal types** for icons (`IconString`)
- **Typed event names and payloads** (`NotebookNavigatorEventType`, `NotebookNavigatorEvents`)
- **Readonly return types** (selected files arrays, pinned map)
- **Menu extension context types** (file and folder menus)

**Note**: These type checks are compile-time only. At runtime, the API is permissive and accepts any values (see Runtime
Behavior sections for each API).

## Changelog

### Version 1.3.0 (2026-02-14)

- Added `metadata.getPropertyMeta(nodeId)`
- Added `metadata.setPropertyMeta(nodeId, meta)`
- Added `navigation.navigateToProperty(nodeId)`
- Added `property-changed` event

### Version 1.2.0 (2025-12-22)

- Added `navigation.navigateToFolder(folder)`
- Added `navigation.navigateToTag(tag)`
- Added `menus.registerFileMenu(callback)`
- Added `menus.registerFolderMenu(callback)`

### Version 1.0.1 (2025-09-16)

- Added `backgroundColor` property to `FolderMetadata` and `TagMetadata` interfaces

### Version 1.0.0 (2025-09-15)

- Initial public API release
