# Topic Navigator — Port Implementation Map

## Context

The `main` branch contains a topic graph navigation feature built on top of an older fork of notebook-navigator (base commit ~`377675e`). The `update` branch is a rebased version tracking the upstream `johansan/notebook-navigator` at v2.5.8. The two branches diverged significantly — the upstream gained Properties support, a hooks-based architecture, and a heavily refactored navigation pane — making a direct merge unreliable.

This document maps every change the topic feature requires onto the `update` branch's current structure, using the `main` branch as the reference implementation.

---

## New Files to Create (port directly from main)

These files have no counterpart in `update`. Port them from `/tmp/notebook-navigator-main/src/...` with only minor import-path fixes.

| Source (main) | Destination (update) | Notes |
|---|---|---|
| `src/utils/topicGraph.ts` | `src/utils/topicGraph.ts` | Core graph builder. No changes needed beyond verifying imports resolve. |
| `src/utils/topicNotes.ts` | `src/utils/topicNotes.ts` | Topic-note file helpers. Port as-is. |
| `src/services/TopicGraphService.ts` | `src/services/TopicGraphService.ts` | Service singleton. Port as-is. |
| `src/hooks/useRootTopicOrder.ts` | `src/hooks/useRootTopicOrder.ts` | Root topic drag-order management. Port as-is. |
| `src/hooks/useTopicNavigation.ts` | `src/hooks/useTopicNavigation.ts` | `navigateToTopic(topicPath)` hook. Port as-is. |
| `src/utils/contextMenu/topicMenuBuilder.ts` | `src/utils/contextMenu/topicMenuBuilder.ts` | Topic context menu. Port as-is. |

---

## Files to Modify

### 1. `src/types.ts`

**What to add:**

```typescript
// Extend ItemType
export const ItemType = {
    FILE: 'file',
    FOLDER: 'folder',
    TAG: 'tag',
    PROPERTY: 'property',
    TOPIC: 'topic'         // ADD
} as const;

// Extend NavigationPaneItemType
export const NavigationPaneItemType = {
    ...existing...,
    TOPIC: 'topic',                    // ADD
    SHORTCUT_TOPIC: 'shortcut-topic'   // ADD
} as const;

// Extend NavigationSectionId
export const NavigationSectionId = {
    SHORTCUTS: 'shortcuts',
    RECENT: 'recent',
    FOLDERS: 'folders',
    TAGS: 'tags',
    PROPERTIES: 'properties',
    TOPICS: 'topics'        // ADD
} as const;

// Update DEFAULT_NAVIGATION_SECTION_ORDER (insert TOPICS before TAGS)
export const DEFAULT_NAVIGATION_SECTION_ORDER: NavigationSectionId[] = [
    NavigationSectionId.SHORTCUTS,
    NavigationSectionId.RECENT,
    NavigationSectionId.FOLDERS,
    NavigationSectionId.TOPICS,   // ADD
    NavigationSectionId.TAGS,
    NavigationSectionId.PROPERTIES
];

// Extend NavigatorContext (used for pinned notes)
export type NavigatorContext = 'folder' | 'tag' | 'property' | 'topic';  // ADD 'topic'

// Extend LocalStorageKeys interface
expandedTopicsKey: string;     // ADD
selectedTopicKey: string;      // ADD

// Extend STORAGE_KEYS object
expandedTopicsKey: 'notebook-navigator-expanded-topics',   // ADD
selectedTopicKey: 'notebook-navigator-selected-topic',     // ADD
```

---

### 2. `src/types/storage.ts`

**What to add** (after the existing `TagTreeNode` / `NNNode` section):

```typescript
export interface TopicNode extends NNNode {
    name: string;                        // Topic name (file basename without extension)
    parents: Map<string, TopicNode>;     // Bidirectional — parents in the DAG
    children: Map<string, TopicNode>;    // Children in the topic hierarchy
    notesWithTag: Set<string>;           // File paths that reference this topic
}
```

`NNNode` already exists in `update`'s storage.ts — verify it has `name`/`path`/`displayPath` (same as `TagTreeNode`'s base).

---

### 3. `src/context/ExpansionContext.tsx`

**What to add:**

**State interface:**
```typescript
interface ExpansionState {
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
    expandedProperties: Set<string>;
    expandedVirtualFolders: Set<string>;
    expandedTopics: Set<string>;    // ADD
}
```

**Action union (add these cases):**
```typescript
| { type: 'SET_EXPANDED_TOPICS'; topics: Set<string> }
| { type: 'TOGGLE_TOPIC_EXPANDED'; topicName: string }
| { type: 'EXPAND_TOPICS'; topicNames: string[] }
| { type: 'TOGGLE_DESCENDANT_TOPICS'; descendantNames: string[]; expand: boolean }
| { type: 'CLEANUP_DELETED_TOPICS'; existingTopics: Set<string> }
```

**Reducer cases:** mirror the `TOGGLE_TAG_EXPANDED` / `EXPAND_TAGS` / `CLEANUP_DELETED_TAGS` pattern exactly.

**Initializer:** load from `localStorage.get(STORAGE_KEYS.expandedTopicsKey)`.

**Persistence effect:** `localStorage.set(STORAGE_KEYS.expandedTopicsKey, Array.from(state.expandedTopics))`.

---

### 4. `src/context/SelectionContext.tsx`

**What to add:**

**State interface:**
```typescript
interface SelectionState {
    selectedFolder: string | null;
    selectedTag: string | null;
    selectedProperty: string | null;
    selectedTopicPath: string | null;   // ADD
    selectedFile: TFile | null;
    // ...rest unchanged
}
```

**Action union:**
```typescript
| { type: 'SET_SELECTED_TOPIC'; topicPath: string | null; autoSelectedFile?: TFile | null }
```

**Reducer:** mirror the `SET_SELECTED_TAG` case. When `SET_SELECTED_TOPIC` fires and `autoSelectedFile` is `undefined`, auto-select the first file from `getFilesForTopicByPath()`.

**Persistence:** load/save `selectedTopicKey` from `STORAGE_KEYS`.

---

### 5. `src/context/StorageContext.tsx`

This is the largest injection point. The `update` branch's StorageContext (590 lines) is ~1/3 the size of `main`'s (1580 lines) because the `main` branch inlined topic graph building here.

**What to add:**

**Imports:**
```typescript
import { buildTopicGraphFromDatabase } from '../utils/topicGraph';
```

**Topic rebuild function** (inside the provider, mirroring `rebuildTagTree`):
```typescript
const rebuildTopicTree = useCallback(() => {
    if (!db || !topicService) return;
    const topicGraph = buildTopicGraphFromDatabase(db, app, excludedFolderPatterns, includedPaths);
    topicService.updateTopicGraph(topicGraph);
}, [db, app, excludedFolderPatterns, includedPaths, topicService]);
```

**Call sites** — add `rebuildTopicTree()` alongside `rebuildTagTree()` in:
- The initial storage-ready effect (after tag tree is built)
- The file-change listener that triggers tag rebuilds
- The settings-change handler (when `settings.showTopics` toggles)

**Condition:** wrap topic rebuild calls with `if (settings.showTopics)`.

**Effect for topic-specific file changes** (from main branch lines ~906–934): subscribe to DB content changes for files that have topic-related frontmatter keys, debounced with a 2-minute timeout.

---

### 6. `src/context/ServicesContext.tsx`

**What to add:**

```typescript
import { TopicService } from '../services/TopicGraphService';

interface Services {
    // ...existing...
    topicService: TopicService | null;    // ADD
}

// In ServicesProvider useMemo:
topicService: plugin.topicService,   // ADD
```

**Convenience hook** (mirror `useTagTreeService`):
```typescript
export function useTopicService(): TopicService | null {
    return useServices().topicService;
}
```

---

### 7. `src/settings/types.ts`

**What to add** to `NotebookNavigatorSettings`:

```typescript
showTopics: boolean;
topicSortOrder: TagSortOrder;   // reuse existing TagSortOrder type
hiddenTopics: string[];
rootTopicOrder: string[];
// Optional appearance maps (same shape as tag equivalents):
topicIcons?: Record<string, string>;
topicColors?: Record<string, string>;
topicBackgroundColors?: Record<string, string>;
topicSortOverrides?: Record<string, TagSortOrder>;
```

---

### 8. `src/settings/defaultSettings.ts`

```typescript
showTopics: true,
topicSortOrder: 'alpha-asc',
hiddenTopics: [],
rootTopicOrder: [],
```

---

### 9. `src/main.ts`

**Class field:**
```typescript
topicService: TopicService | null = null;
```

**In `onload()`** after `this.tagTreeService = new TagTreeService()`:
```typescript
this.topicService = new TopicService();
```

**Commands** (in `registerNavigatorCommands.ts` or inline):
- `reveal-active-topic` — reveal the active note's first topic in the navigator
- `reveal-active-topic-all-paths` — expand all parent paths a note appears under

---

### 10. `src/utils/fileFinder.ts`

**What to add** (after `getFilesForTag`):

```typescript
export function getFilesForTopicByName(
    topicName: string,
    settings: NotebookNavigatorSettings,
    app: App,
    topicService: TopicService | null
): TFile[]

export function getFilesForTopicByPath(
    topicPath: string,
    settings: NotebookNavigatorSettings,
    app: App,
    topicService: TopicService | null
): TFile[]

function getFilesForTopic(
    topicNode: TopicNode,
    settings: NotebookNavigatorSettings,
    app: App,
    topicService: TopicService | null
): TFile[]
```

Logic: collect descendants when `settings.includeDescendantNotes`, resolve TFile objects from paths, apply sort, handle pinned notes — identical pattern to `getFilesForTag`.

---

### 11. `src/hooks/navigationPane/data/useNavigationPaneTreeSections.ts`

This is the primary architecture difference. In `main`, topic rendering is inlined in the monolithic `NavigationPane.tsx`. In `update`, section building lives in this hook.

**What to add:**

1. **Import** `TopicService`, `TopicNode`, `TopicGraphService`, `useTopicService`.

2. **Parameters** (extend `UseNavigationPaneTreeSectionsParams`):
```typescript
topicService: TopicService | null;
```

3. **Topic section builder** — a new `useMemo` (mirroring the existing tag-tree section builder ~lines 460–570) that:
   - Gets `topicGraph = topicService?.getTopicGraph()` 
   - Respects `settings.showTopics` and `settings.hiddenTopics`
   - Applies `settings.topicSortOrder`
   - Uses `useRootTopicOrder` for custom root ordering
   - Returns flat topic tree items for the virtualizer (same item shape as tags)

4. **Return value** (extend `NavigationPaneTreeSectionsResult`):
```typescript
renderTopicTree: Map<string, TopicNode>;
topicRootItems: TopicNode[];
```

---

### 12. `src/components/navigationPane/NavigationPaneContent.tsx`

This is where the Topics section is rendered in the navigation pane UI.

**What to add:**

1. **State:**
```typescript
const [topicsSectionExpanded, setTopicsSectionExpanded] = useState(true);
```

2. **Service access:**
```typescript
const topicService = useTopicService();
```

3. **Hook:**
```typescript
const { navigateToTopic } = useTopicNavigation();
```

4. **Topic section items** — in the virtualizer item array, insert topic items between Recent and Tags sections (following `DEFAULT_NAVIGATION_SECTION_ORDER`). Each topic item gets rendered like a tag item: indent, expand/collapse chevron, note count badge, icon/color decoration.

5. **Item renderer** (`NavigationPaneItemRenderer.tsx` or inline) — add a `TOPIC` / `SHORTCUT_TOPIC` case matching the `TAG` / `SHORTCUT_TAG` case, using:
   - `expansionDispatch({ type: 'TOGGLE_TOPIC_EXPANDED', topicName })`
   - `navigateToTopic(topicPath)`
   - `buildTopicMenu(...)` for context menu
   - `getTotalNoteCount(topicNode)` for count badge

6. **Section header** — a "Topics" collapsible header row (same as Tags/Folders headers), toggling `topicsSectionExpanded`.

7. **Reorder panel** — a `NavigationRootReorderPanel` entry for topics root ordering (same pattern as folders/tags).

---

## Key Architecture Differences to Navigate

| Area | `main` branch | `update` branch | How to handle |
|---|---|---|---|
| Navigation pane | Single 2334-line `NavigationPane.tsx` | `NavigationPaneContent.tsx` (910 lines) + hooks in `hooks/navigationPane/` | Put section building in `useNavigationPaneTreeSections`, rendering in `NavigationPaneContent` |
| Section type | `NavigationSectionId` had 4 values | Has 5 (added `PROPERTIES`) | Add `TOPICS` as 6th |
| Property tree | Not present in main | Full `PropertyTreeService` exists | Topics follows the same service pattern; no conflict |
| File system operations | Inline in components | Abstracted into `src/services/fileSystem/`, `operations/` | Topic operations (no writes needed) unaffected |
| `StorageContext` | 1580 lines, inlines topic build | 590 lines, cleaner | Add topic rebuild as a small callback, same pattern as tag rebuild |
| Hooks organization | Flat in `src/hooks/` | Split: flat + `listPaneData/` + `navigationPane/` subdirs | `useRootTopicOrder` and `useTopicNavigation` stay in flat `hooks/`; topic section data goes in `hooks/navigationPane/data/` |
| `NavigatorContext` type | `'folder' \| 'tag' \| 'topic'` | `'folder' \| 'tag' \| 'property'` | Add `\| 'topic'` |

---

## What Does NOT Need to Change

- `src/utils/tagTree.ts` — topic graph is separate from tag tree
- `src/utils/propertyTree.ts` — unrelated
- `src/components/ListPane.tsx` — topic file list uses same `getFilesForTopicByPath` called from `SelectionContext`; no ListPane changes needed beyond the auto-select side effect
- All calendar, shortcut, recent-notes infrastructure — untouched

---

## Verification

1. Build: `npm run build` must succeed with no TS errors.
2. Load plugin in Obsidian dev vault. Topics section should appear in the navigation pane for any note tagged `#topic`.
3. Clicking a topic should populate the list pane with notes that reference it via frontmatter.
4. Expand/collapse and selection state should survive plugin reload (localStorage persistence).
5. `reveal-active-topic` command should scroll the navigator to the current note's topic.
6. Disabling `showTopics` in settings should hide the section entirely.
