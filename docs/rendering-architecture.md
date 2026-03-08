# Notebook Navigator Rendering Architecture

Updated: February 18, 2026

## Table of Contents

- [Overview](#overview)
- [Core Principles](#core-principles)
- [Component Hierarchy](#component-hierarchy)
- [Component Responsibilities](#component-responsibilities)
- [Virtualization Strategy](#virtualization-strategy)
- [Performance Optimizations](#performance-optimizations)
- [Data Flow](#data-flow)
- [Scroll Management System](#scroll-management-system)

## Overview

The Notebook Navigator plugin renders React applications inside two Obsidian `ItemView` implementations:
`NotebookNavigatorView` (main navigator) and `NotebookNavigatorCalendarView` (calendar right sidebar). Both trees are
mounted with `createRoot` and wrapped in `React.StrictMode`.

The main navigator UI is a two-pane layout (`NavigationPane` and `ListPane`). Each pane combines pane-level chrome
(headers, toolbars, pinned sections, overlays) with a virtualized scroll region for rows. Both panes use
`@tanstack/react-virtual` to mount only the rows required for the viewport plus overscan.

The calendar right-sidebar view renders `CalendarRightSidebar`, which hosts `Calendar` in sidebar mode and forwards
date-filter actions to the main navigator view.

Storage is provided through `StorageContext`, which coordinates `IndexedDBStorage`, an in-memory mirror, and the
`ContentProviderRegistry`. Components read cached preview data, metadata, and tag/property trees synchronously during render, and
row components that need live content updates subscribe to the storage instance (`IndexedDBStorage.onFileContentChange`).

Context providers isolate concerns such as settings, UX preferences, recent data, services, shortcuts, expansion state,
selection state, and pane layout. Derived data and behaviors live in dedicated hooks, leaving components to focus on
presentation and wiring.

## Core Principles

### 1. Virtualized Panes

`useNavigationPaneScroll` and `useListPaneScroll` wrap `useVirtualizer` from `@tanstack/react-virtual`. These hooks own
the scroll container refs, gate scroll execution on physical container visibility, keep version counters for list
rebuilds, and queue scroll intents (reveal requests, navigation jumps, configuration changes) so they run only after the
corresponding virtual items exist.

Both virtualizers use `scrollMargin`, and the list pane also uses `scrollPaddingStart`. Both panes use
`scrollPaddingEnd` so `scrollToIndex` aligns rows below the pane chrome and keeps the target row above bottom overlays
(calendar, iOS toolbars).

### 2. Synchronous Storage Mirror

`StorageContext` (`src/context/StorageContext.tsx`) coordinates `IndexedDBStorage`, the `ContentProviderRegistry`, and
the memory mirror. Components call helpers such as `getFile`, `getFiles`, `getTagTree`, `getFileDisplayName`,
`getFileCreatedTime`/`getFileModifiedTime`, `hasPreview`, and `findTagInTree` directly during render.

Components that need push-based updates (for example `FileItem`) subscribe to the `IndexedDBStorage` instance returned by
`getDB` and update local state when cached content changes.

### 3. Derived Data Hooks

Expensive data shaping lives outside component bodies. Examples:

- `useNavigationPaneData` builds the combined folder/tag/property/shortcut tree, computes note counts, resolves icons and
  colours, and tracks virtual folders, banners, pinned shortcuts, and section ordering.
- `useNavigationRootReorder` exposes drag-and-drop reorder state and render helpers for root folders, tags, properties, and section
  headers.
- `useListPaneData` assembles list pane items (pinned files, top spacer, date headers, search metadata, hidden item
  flags) and keeps lookup maps for virtualized scrolling and multi-selection.
- `useListPaneAppearance`, `useListPaneTitle`, `useListActions`, `useNavigationPaneKeyboard`, `useListPaneKeyboard`,
  `useNavigatorReveal`, and `useNavigatorEventHandlers` encapsulate behavior that would otherwise live inside
  components.

### 4. Context-Based State Layers

Nine providers wrap the primary navigator React tree:

- `SettingsContext` – persisted plugin settings and mutation helpers
- `UXPreferencesContext` – runtime-only preferences (search active, include descendant notes, show hidden items, pin
  shortcuts, calendar visibility)
- `RecentDataContext` – recent notes list and recent icon history sourced from local storage
- `ServicesContext` – Obsidian app handles plus file system operations, command queue, metadata service, tag operations,
  property operations, tag tree service, property tree service, Omnisearch integration, and release check service
- `ShortcutsContext` – pinned shortcut hydration, add/remove/reorder operations, and lookup maps
- `StorageContext` – IndexedDB mirror, tag/property trees, synchronous metadata accessors, cache rebuild entry points
- `ExpansionContext` – expanded folders, tags, properties, shortcuts, recent notes, and virtual folders
- `SelectionContext` – selected folder/tag/property/file, multi-selection tracking, reveal targets, and selection dispatchers
- `UIStateContext` – pane mode (single vs dual), focused pane, current single-pane view, navigation pane width, pinned
  shortcuts toggle

The calendar right-sidebar tree uses `SettingsContext` and `ServicesContext` only.

### 5. Stable Rendering Contracts

Heavy components (`NavigationPane`, `ListPane`, `FolderItem`, `TagTreeItem`, `FileItem`, `ShortcutItem`,
`VirtualFolderComponent`) use `React.memo` with stable props. Event handlers are memoized with `useCallback`, derived
class names and counts use `useMemo`, and DOM measurements (navigation item height, indentation, scale transforms) are
applied via effects in `NotebookNavigatorComponent`, `useMeasuredElementHeight`, and `useNavigatorScale` so render output
stays pure.

Both panes use `useSurfaceColorVariables` to map semi-transparent theme variables to solid equivalents and expose surface
colors used for background compositing.

## Component Hierarchy

### Navigator view stack

```mermaid
graph TD
    OV["NotebookNavigatorView"] --> SM["React.StrictMode"] --> SP["SettingsProvider"] --> UX["UXPreferencesProvider"] --> RD["RecentDataProvider"];
    RD --> SVC["ServicesProvider"] --> SHC["ShortcutsProvider"] --> ST["StorageProvider"] --> EP["ExpansionProvider"] --> SEL["SelectionProvider"];
    SEL --> UI["UIStateProvider"] --> NC["NotebookNavigatorContainer"];

    NC -->|isStorageReady=false| SK["SkeletonView"];
    NC -->|isStorageReady=true| NNC["NotebookNavigatorComponent"];
    NNC --> UNB["UpdateNoticeBanner"];
    NNC --> NPR["NavigationPane"];
    NNC --> LPR["ListPane"];
```

### Calendar right-sidebar stack

```mermaid
graph TD
    CV["NotebookNavigatorCalendarView"] --> SM["React.StrictMode"] --> SP["SettingsProvider"] --> SVC["ServicesProvider"] --> CRS["CalendarRightSidebar"];
    CRS --> CAL["Calendar"];
```

### NavigationPane subtree

```mermaid
graph TD
    NPR["NavigationPane"] --> SC["Scroll container"];
    SC --> OVL["Sticky overlay stack"];
    OVL --> NPH["NavigationPaneHeader"];
    OVL --> VTA["VaultTitleArea"];
    OVL --> NTBA["NavigationToolbar Android"];
    OVL --> PB["NavigationBanner pinned"];
    OVL --> PINNED["Pinned shortcuts and recent notes"];
    SC --> NB["NavigationBanner unpinned"];
    SC -->|normal mode| NPL["Virtualized navigation list"];
    SC -->|root reorder| NRP["NavigationRootReorderPanel"];
    NPR --> NTBI["NavigationToolbar iOS"];
    NPR --> CAL["Calendar overlay"];
```

### ListPane subtree

```mermaid
graph TD
    LPR["ListPane"] --> SC["Scroll container"];
    SC --> OVL["Sticky overlay stack"];
    OVL --> LPH["ListPaneHeader"];
    OVL --> LTBA["ListToolbar Android"];
    OVL --> SI["SearchInput"];
    OVL --> LTA["ListPaneTitleArea"];
    SC --> LPL["Virtualized file list"];
    LPR --> LTBI["ListToolbar iOS"];
    LPR --> CAL["Calendar overlay"];
```

## Component Responsibilities

### NotebookNavigatorView

**Location**: `src/view/NotebookNavigatorView.tsx`

- Creates the React root with `createRoot`, wraps it in `React.StrictMode`, applies mobile/platform classes, and mounts
  the provider stack
  (`Settings → UXPreferences → RecentData → Services → Shortcuts → Storage → Expansion → Selection → UIState`).
- Applies Android font compensation to the view container and propagates it to the rendered mobile root.
- Exposes imperative handlers to the plugin (cache rebuild, reveal actions, folder/tag/property modal navigation, search toggle,
  delete/move operations, shortcut creation).
- Dispatches `notebook-navigator-visible` on mobile when the drawer becomes visible so scroll hooks can resume pending
  reveal operations.
- Cleans up container classes and unmounts the React tree on view close.

### NotebookNavigatorCalendarView

**Location**: `src/view/NotebookNavigatorCalendarView.tsx`

- Creates a React root for the calendar right-sidebar leaf and mounts `SettingsProvider` + `ServicesProvider`.
- Renders `CalendarRightSidebar` as the calendar-only UI surface.
- Registers a settings listener to keep platform-specific container classes in sync.
- Unregisters listeners, unmounts the React tree, and tears down view container classes on close.

### CalendarRightSidebar

**Location**: `src/components/CalendarRightSidebar.tsx`

- Hosts the `Calendar` component configured for right-sidebar mode (`weeksToShowOverride={6}`, `isRightSidebar={true}`).
- Resolves the primary navigator leaf, opening it through `plugin.activateView()` when needed.
- Forwards calendar date-filter actions to `NotebookNavigatorView.addDateFilterToSearch(...)` and reveals the navigator leaf when applicable.

### NotebookNavigatorContainer

**Location**: `src/components/NotebookNavigatorContainer.tsx`

- Reads `isStorageReady` from `StorageContext` and pane mode from `UIStateContext`.
- Applies the scale wrapper returned by `useNavigatorScale` when rendering `SkeletonView` so loading layout matches the
  final scale.
- Restores the saved navigation pane size for the active orientation via `localStorage` helpers and
  `getNavigationPaneSizing`.
- Chooses between the skeleton layout and `NotebookNavigatorComponent`, ensuring layout parity (single vs dual pane,
  orientation, search state) while storage warms up.

### SkeletonView

**Location**: `src/components/SkeletonView.tsx`

- Mirrors the active layout with placeholder panes, respecting vertical vs horizontal splits and single-pane mode.
- Shows a search bar placeholder when search is enabled through `UXPreferences`.
- Uses the stored `paneSize` to match navigation pane width while storage loads.

### NotebookNavigatorComponent

**Location**: `src/components/NotebookNavigatorComponent.tsx`

- Wires selection, settings, services, shortcuts, UX preferences, and storage into pane components.
- Manages pane sizing and drag handles via `useResizablePane`, propagating resize props to `ListPane`.
- Shares a root container ref with both panes for keyboard handling and focus tracking.
- Runs `useDragAndDrop`, `useDragNavigationPaneActivation`, `useMobileSwipeNavigation`, `useNavigatorReveal`,
  `useNavigatorEventHandlers`, `useNavigationActions`, `useNavigatorScale`, and `useUpdateNotice` to provide navigation
  commands, drag activation, swipe gestures, and update notices.
- Bridges list search tag filters into `NavigationPane` for tag highlighting via `searchTagFilters`.
- Applies CSS custom properties for navigation item height, indentation, and font sizes once per settings change.
- Renders `UpdateNoticeBanner`, `NavigationPane` (with banner and reorder panel), and `ListPane` in the correct pane
  arrangement (single or dual).

### UpdateNoticeBanner

**Location**: `src/components/UpdateNoticeBanner.tsx`

- Displays a temporary banner when `ReleaseCheckService` reports an available update.
- Uses `useAutoDismissFade` to manage banner visibility and fade-out timing.
- Opens Obsidian’s plugin manager via `obsidian://show-plugin?id=notebook-navigator` when clicked.

### NavigationPaneHeader

**Location**: `src/components/NavigationPaneHeader.tsx`

- Desktop header providing dual/single pane toggle, profile menu trigger, expand/collapse all, hidden item toggle, root
  reorder toggle, calendar toggle, and new folder action.
- Mobile variant renders a simplified profile menu trigger when multiple profiles exist.
- Defers tree-refresh callbacks with `requestAnimationFrame` so scroll hooks can remeasure after batch operations.

### VaultTitleArea

**Location**: `src/components/VaultTitleArea.tsx`

- Renders the active vault profile name in the navigation pane on desktop when multiple profiles exist.
- Uses `useVaultProfileMenu` to open the profile menu from a clickable trigger.

### NavigationToolbar

**Location**: `src/components/NavigationToolbar.tsx`

- Mobile toolbar providing expand/collapse, hidden item toggle, root reorder toggle, calendar toggle, and new folder
  action.
- Rendered at the top on Android and the bottom on iOS.

### NavigationPane

**Location**: `src/components/NavigationPane.tsx`

- Consumes data from `useNavigationPaneData`, `useNavigationRootReorder`, `useNavigationPaneScroll`,
  and `useNavigationPaneKeyboard`.
- Renders a sticky overlay stack (header, vault title, Android toolbar, pinned banner, pinned shortcuts/recent), an
  optional unpinned `NavigationBanner`, and either the virtualized tree or `NavigationRootReorderPanel`.
- Handles folder/tag/property drag targets and uses dnd-kit sortable contexts for shortcut reordering.
- Integrates context menus (`buildFolderMenu`, `buildTagMenu`, `buildPropertyMenu`, `buildFileMenu`) and frontmatter exclusion logic for
  hidden items.
- Measures overlay and bottom overlay heights via `useMeasuredElementHeight` and passes `scrollMargin`,
  `scrollPaddingStart`, and `scrollPaddingEnd` to `useNavigationPaneScroll` so `scrollToIndex` aligns rows below the
  sticky chrome and above bottom overlays (calendar, iOS toolbar).

### NavigationBanner

**Location**: `src/components/NavigationBanner.tsx`

- Renders the configured banner image by resolving the vault file path to a resource URL.

### Calendar

**Location**: `src/components/calendar/Calendar.tsx`

- Renders the calendar overlay and integrates daily note creation/opening workflows.
- Calls `onWeekCountChange` so parent panes can update scroll padding and CSS variables for the calendar layout.
- Delegates presentation to `src/components/calendar/CalendarHeader.tsx`, `src/components/calendar/CalendarGrid.tsx`,
  and `src/components/calendar/CalendarYearPanel.tsx`.

### NavigationRootReorderPanel

**Location**: `src/components/NavigationRootReorderPanel.tsx`

- Displays reorderable sections, folder lists, tag lists, and property lists when root reorder mode is active.
- Provides drop indicators, drag handle labels, and reset buttons that reset root ordering to alphabetical defaults.
- Updates scroll container data attributes to reflect drop targets for visual feedback.

### ListPaneHeader

**Location**: `src/components/ListPaneHeader.tsx`

- Desktop header showing breadcrumb title (with optional icon), search toggle, descendant toggle, sort menu, appearance
  menu, and new note button.
- Mobile variant shows a back button to the navigation pane and renders breadcrumb segments horizontally scrollable with
  fade indicators.
- Uses `useListPaneTitle` to build the breadcrumb segments and `useListActions` for button handlers.

### ListToolbar

**Location**: `src/components/ListToolbar.tsx`

- Mobile toolbar (top on Android, bottom on iOS) exposing search, descendant toggle, sort, appearance, and new note
  actions.
- Shares command logic with the header through `useListActions`.

### ListPane

**Location**: `src/components/ListPane.tsx`

- Consumes data and behavior from `useListPaneData`, `useListPaneScroll`, `useListPaneKeyboard`,
  `useListPaneAppearance`, `useMultiSelection`, `useContextMenu`, and `useFileOpener`.
- Renders the search bar (`SearchInput`), `ListPaneTitleArea`, mobile toolbars, empty states, and the virtual list with
  top spacer, date headers, file rows, and bottom spacer.
- Integrates Omnisearch results when configured, including excerpt matches and highlight metadata.
- Maintains drop-zone attributes for drag-and-drop moves and exposes scroll handlers for reveal operations and search
  reset behavior.
- Measures chrome and bottom overlay heights (iOS toolbar, calendar) and passes them to `useListPaneScroll` as
  `scrollMargin`/`scrollPaddingEnd`.
- Persists search active state through `UXPreferences` and debounces input before triggering expensive filtering.

### SearchInput

**Location**: `src/components/SearchInput.tsx`

- Renders the list pane search field and dispatches `UIStateContext` focus updates for keyboard navigation.
- Initializes `SearchTagInputSuggest` when tag suggestions are enabled and a tag tree service is available.
- Handles search keyboard shortcuts using the configured `settings.keyboardShortcuts`.

### ListPaneTitleArea

**Location**: `src/components/ListPaneTitleArea.tsx`

- Renders the desktop title area when enabled, using `useListPaneTitle` output.

### FileItem

**Location**: `src/components/FileItem.tsx`

- Renders file title, Omnisearch highlights, preview text, feature image, tag pills, parent folder label, and date
  metadata based on appearance settings and optimization flags.
- Subscribes to content updates from `IndexedDBStorage` to refresh preview text, tags, feature image status, custom
  property values, and word counts.
- Provides quick actions (reveal, pin/unpin, open in new tab) on desktop hover and handles drag-and-drop metadata for
  file moves.
- Uses `createHiddenTagVisibility` to filter/style tag pills based on hidden tag rules and “show hidden items”.

### FolderItem

**Location**: `src/components/FolderItem.tsx`

- Displays folder name, icon, colours, note counts, folder note indicator, and tooltip counts.
- Handles expand/collapse, selection, sibling toggles (Alt+click), context menus, and hidden/excluded state rendering.
- Uses `nav-folder-open` / `nav-folder-closed` interface icons for expanded/collapsed folders when no custom folder icon is set.
- Sets Obsidian icons in `useEffect` to avoid blocking React renders and updates tooltips only on desktop.

### TagTreeItem

**Location**: `src/components/TagTreeItem.tsx`

- Renders hierarchical tags with indentation, note counts (current vs descendants), tag icons/colours, and missing-state
  styles for hidden tags.
- Supports expand/collapse, context menus, tag reveal, drag-and-drop, and optional shortcut drag handles.

### PropertyTreeItem

**Location**: `src/components/PropertyTreeItem.tsx`

- Renders property key/value nodes with indentation, note counts, icons/colours, and missing-state styling.
- Supports expand/collapse, context menus, property reveal, drag-and-drop, and child sort override indicators.

### ShortcutItem

**Location**: `src/components/ShortcutItem.tsx`

- Presents folder, note, search, tag, and property shortcuts with labels, counts, drag handles, and missing indicators.
- Shares styling with navigation rows through `NavigationListRow` and participates in dnd-kit sortable reordering.

### RootFolderReorderItem

**Location**: `src/components/RootFolderReorderItem.tsx`

- Specialized `NavigationListRow` wrapper for root reorder mode with drag handles and reset actions.
- Supports folders, tags, properties, and section headers, including missing-item styling, inside dnd-kit sortable lists.

## Virtualization Strategy

### Navigation Pane Virtualization

- `useNavigationPaneData` returns `items: CombinedNavigationItem[]` plus lookup maps (`pathToIndex`) and pinned-section
  arrays (`shortcutItems`, `pinnedRecentNotesItems`) used by the pane chrome.
- `NavigationPane` measures sticky chrome height, unpinned banner height, and bottom overlay height via
  `useMeasuredElementHeight`, then passes:
  - `scrollMargin` (chrome + unpinned banner),
  - `scrollPaddingEnd` (calendar + iOS bottom toolbar),
  into `useNavigationPaneScroll`.
- `useNavigationPaneScroll` initializes the virtualizer with `NAVPANE_MEASUREMENTS` and exposes `requestScroll` for reveal
  operations.
- `NavigationPane` maps `rowVirtualizer.getVirtualItems()` to components, switching on `item.type` to render the correct
  row (`FolderItem`, `TagTreeItem`, `VirtualFolderComponent`, `ShortcutItem`, recent note rows, spacers).
- Because `virtualItem.start` includes `scrollMargin`, row wrappers subtract it when positioning inside the virtual
  container (`virtualItem.start - scrollMargin`).
- Root reorder mode swaps the virtual list for `NavigationRootReorderPanel` (non-virtualized), which renders
  `RootFolderReorderItem` rows.
- `pathToIndex` is passed to `useNavigationPaneScroll` so scroll targets resolve to indices at execution time.

```typescript
const { items, pathToIndex, shortcutItems } = useNavigationPaneData({
  settings,
  activeProfile,
  isVisible: navigationVisible,
  shortcutsExpanded,
  recentNotesExpanded,
  pinShortcuts,
  sectionOrder
});

const { rowVirtualizer, scrollContainerRefCallback, requestScroll } = useNavigationPaneScroll({
  items,
  pathToIndex,
  isVisible: navigationVisible,
  activeShortcutKey,
  scrollMargin: navigationScrollMargin,
  scrollPaddingEnd: calendarOverlayHeight + bottomToolbarHeight
});
```

### List Pane Virtualization

- `useListPaneData` emits `ListPaneItem[]` composed of top/bottom spacers, date headers, and file items with pinned and
  hidden flags plus lookup maps (`filePathToIndex`, `fileIndexMap`).
- `useListPaneScroll` feeds `listItems` into `useVirtualizer`, calculating heights with `getListPaneMeasurements`,
  preview availability (`hasPreview`), search metadata, and appearance settings. The list overlay height is passed as
  `scrollMargin` so `scrollToIndex` aligns items below the header/search chrome.
- The hook maintains a single pending scroll request with priority ranking (reveal, navigation, visibility change,
  search) and executes it after the index version matches the expected rebuild.
- `ListPane` renders virtual items by switching on `item.type` and passing search metadata to `FileItem`; headers are
  inline `<div className="nn-date-group-header">` nodes, matching the measurement logic.
- Because `virtualItem.start` includes `scrollMargin`, row wrappers subtract it when positioning inside the virtual
  container (`virtualItem.start - scrollMargin`).

```typescript
const { listItems, filePathToIndex, orderedFiles } = useListPaneData({
  selectionType,
  selectedFolder,
  selectedTag,
  settings,
  activeProfile,
  searchProvider,
  searchQuery: isSearchActive ? debouncedSearchQuery : undefined,
  searchTokens: isSearchActive ? debouncedSearchTokens : undefined,
  visibility: { includeDescendantNotes, showHiddenItems }
});

const { rowVirtualizer, scrollContainerRefCallback, handleScrollToTop } = useListPaneScroll({
  listItems,
  filePathToIndex,
  selectedFile,
  selectedFolder,
  selectedTag,
  settings,
  folderSettings: appearanceSettings,
  isVisible,
  selectionState,
  selectionDispatch,
  searchQuery: isSearchActive ? debouncedSearchQuery : undefined,
  suppressSearchTopScrollRef,
  topSpacerHeight,
  includeDescendantNotes,
  scrollMargin: listOverlayHeight,
  scrollPaddingEnd: bottomToolbarHeight + calendarOverlayHeight
});
```

## Performance Optimizations

### 1. Scroll-Oriented Hooks

`useNavigationPaneScroll` and `useListPaneScroll` keep pending scroll intents, overscan settings, and index version
counters. Both hooks watch container visibility (via `ResizeObserver`) to avoid failed virtualizer calls when panes are
hidden (mobile drawers, dual-pane toggles).

### 2. Derived Data Caches

`useNavigationPaneData` and `useListPaneData` debounce vault-driven rebuilds with `debounce` from Obsidian, reuse `Map`
instances for lookup tables, and return shortcut/selection metadata so `React.memo` components receive stable props.
`StorageContext` batches diff calculations, content provider queues, and tag/property tree rebuilds so UI components only react
to finalized updates.

### 3. Memoized Components

Virtualized row components (`FolderItem`, `TagTreeItem`, `ShortcutItem`, `FileItem`) memoize expensive derived values
(class names, tooltip data, highlight ranges, tag colours) and rely on stable props to avoid unnecessary renders. Parent
components memoize handler factories and service descriptors to keep prop identity stable.

### 4. Debounced User Input

Search queries are debounced before triggering data rebuilds, and Omnisearch results are ignored when a newer request is
in flight.

### 5. CSS Variables and Scale

Navigation item height, indentation, and font sizes are written to CSS custom properties once per settings change,
keeping render output pure. `useNavigatorScale` applies global scaling for the navigator wrapper rather than
recalculating layout inside virtualized items.

## Data Flow

### Initial Render

`NotebookNavigatorContainer` renders `SkeletonView` until `StorageContext` sets `isStorageReady`, then mounts
`NotebookNavigatorComponent`.

```mermaid
sequenceDiagram
    participant V as Vault
    participant DB as IndexedDBStorage
    participant MC as Memory Cache
    participant ST as StorageContext
    participant NC as NotebookNavigatorContainer
    participant SK as SkeletonView
    participant DH as Data Hooks
    participant UI as Virtualized Panes

    NC->>SK: Render while isStorageReady=false
    ST->>DB: Open IndexedDB and load cached records
    DB->>MC: Seed in-memory mirror
    ST->>V: Enumerate vault files (diff input)
    ST->>DB: Reconcile initial diff
    ST->>ST: Register vault + settings listeners
    ST->>NC: Set isStorageReady=true
    NC->>UI: Mount NotebookNavigatorComponent
    ST->>DH: Expose synchronous getters and tag/property trees
    DH->>UI: Build navigation/list item arrays
    UI->>MC: Read data synchronously during render
```

### File Change

```mermaid
sequenceDiagram
    participant V as Vault
    participant ST as StorageContext
    participant CP as ContentProviderRegistry
    participant DB as IndexedDBStorage
    participant MC as Memory Cache
    participant DH as Data Hooks
    participant UI as Components

    V->>ST: File event (create/modify/delete/rename)
    ST->>DB: Reconcile cache records (diff + rename handling)
    ST->>CP: Queue derived content generation
    CP->>DB: Persist derived content updates
    DB->>MC: Mirror changes in memory
    ST->>DH: Increment change versions, rebuild tag/property trees if needed
    DH->>UI: Recompute virtualized item arrays
    UI->>UI: Rerender affected rows via virtualization
```

### User Interaction

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Virtual Row
    participant CTX as Selection/UIState/UXPreferences
    participant SVC as ServicesContext
    participant V as Vault
    participant ST as StorageContext

    U->>UI: Click/keyboard action
    UI->>CTX: Dispatch selection or preference update
    CTX->>UI: Update focused pane, reveal targets, search state
    UI->>SVC: Invoke command queue / file system / metadata services
    SVC->>V: Execute vault operation (move, create, delete, tag update)
    V->>ST: Emit vault event
    ST->>UI: Propagate updated cache state to virtualization hooks
```

## Scroll Management System

Detailed scroll orchestration for both panes (intent queues, version gating, reveal flows) is documented in
`docs/scroll-orchestration.md`.
