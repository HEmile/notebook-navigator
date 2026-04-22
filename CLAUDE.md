# Notebook Navigator — Fork Overview

This is a personal fork of [johansan/notebook-navigator](https://github.com/johansan/notebook-navigator) (base commit `377675e`). It adds a **Topic Graph** navigation system on top of the upstream tag/folder navigator, plus several smaller UI improvements. It is described in the README as "vibe-coded in a day" and specific to the owner's personal Obsidian setup.

---

## Major Feature: Topic Graph Navigation

### What it does
A "Topics" section appears in the navigation pane alongside Folders and Tags. Topics are derived from **typed links** in frontmatter — not from tags. A note belongs to a topic if its frontmatter contains a recognized relation key pointing to another note (which acts as the topic node).

The topic hierarchy is a DAG (directed acyclic graph), not a simple tree. A topic can have multiple parents. The UI presents it as a tree by picking one canonical parent path per node.

### How it works (`src/utils/topicGraph.ts`)
- `HAS_TOPIC_RELATIONS` — the set of frontmatter keys treated as "this note relates to a topic" (e.g. `hasTopic`, `isA`, `for`, `subset`, `in`, `author`, `publishedIn`, `artiest`, `adres`, `gerecht`, …).
- `SUBSET_RELATIONS` — subset of the above that also form parent–child edges in the topic graph (e.g. `subset`, `in`, `partOf`).
- `TOPIC_TAGS` — Obsidian tags (`#topic`, `#jaar`, `#decennium`, `#maand`) that mark a note as a topic node.
- The graph is built by scanning vault metadata: a note tagged with a topic tag becomes a `TopicNode`; relations in frontmatter wire up parent/child edges and assign `notesWithTag` membership.
- Supports non-DAG cycles (self-references are filtered out).
- `getTopicRelations` / `getTopicTags` extract relations from `CachedMetadata`.

### Key new files
| Path | Role |
|---|---|
| [src/utils/topicGraph.ts](src/utils/topicGraph.ts) | Graph construction, traversal, path utilities |
| [src/utils/topicNotes.ts](src/utils/topicNotes.ts) | Helpers for finding the topic note file for a given topic name, and walking the hierarchy to find the first topic a note belongs to |
| [src/services/TopicGraphService.ts](src/services/TopicGraphService.ts) | `TopicService` singleton wrapping the graph; acts as a React↔non-React bridge (same pattern as `TagTreeService`) |
| [src/hooks/useRootTopicOrder.ts](src/hooks/useRootTopicOrder.ts) | Manages custom drag-and-drop ordering of root-level topics, persisted in `settings.rootTopicOrder` |
| [src/hooks/useTopicNavigation.ts](src/hooks/useTopicNavigation.ts) | `navigateToTopic(topicPath)` — sets selection, handles single-pane view switching |
| [src/utils/contextMenu/topicMenuBuilder.ts](src/utils/contextMenu/topicMenuBuilder.ts) | Context-menu entries for topic nodes |

### Storage / state
- `TopicNode` type added in [src/types/storage.ts](src/types/storage.ts): `name`, `children`, `parents`, `notesWithTag`. Shares a `NNNode` base with `TagTreeNode`.
- `ExpansionContext` gains `expandedTopics: Set<string>` and corresponding actions (`TOGGLE_TOPIC_EXPANDED`, `EXPAND_TOPICS`, `TOGGLE_DESCENDANT_TOPICS`, `CLEANUP_DELETED_TOPICS`). Persisted to localStorage under `notebook-navigator-expanded-topics`.
- `SelectionContext` gains `selectedTopicPath: string | null` and `SET_SELECTED_TOPIC` action.
- `ItemType.TOPIC`, `NavigationPaneItemType.TOPIC`, `NavigationPaneItemType.SHORTCUT_TOPIC`, and `NavigationSectionId.TOPICS` added to [src/types.ts](src/types.ts).
- Default navigation section order changed to put **Topics before Tags before Notes**.

### Settings
New settings in `NotebookNavigatorSettings`:
- `showTopics: boolean` — toggle the Topics section.
- `topicSortOrder: TagSortOrder` — alphabetical or by frequency.
- `hiddenTopics: string[]` — comma-separated topic names to exclude.
- `topicIcons`, `topicColors`, `topicBackgroundColors`, `topicSortOverrides`, `topicAppearances` — per-topic appearance customization (same shape as tag equivalents).
- `rootTopicOrder: string[]` — custom drag-to-reorder for root topics.

### Commands
- `reveal-active-topic` — reveal the active note's first topic in the navigator.
- `reveal-active-topic-all-paths` — expand all paths a note appears under in the topic graph.

### Search integration
`topic:"<name>"` tokens in the search bar filter the list pane to notes belonging to that topic (including descendants when `includeDescendantNotes` is on). The token is stripped from the Omnisearch query so it doesn't confuse the full-text engine.

---

## Other Changes vs Upstream

### Group-by-folder in List Pane
`settings.groupByDate: boolean` replaced by `settings.noteGrouping: 'none' | 'date' | 'folder'`.
- `date` — existing date headers (unchanged behavior).
- `folder` — groups notes by their immediate parent subfolder when inside a folder view; groups by top-level vault folder when inside a tag view. This is a new mode not present upstream.

### Dual-Pane Vertical Split
- `settings.dualPaneOrientation: 'horizontal' | 'vertical'` — splits the two panes side-by-side or stacked.
- `useResizablePane` generalised from width-only to support both axes. The hook's API changed: `paneWidth` → `paneSize`, `initialWidth` → `initialSize`.
- New localStorage keys: `notebook-navigator-navigation-pane-height`, `notebook-navigator-dual-pane-orientation`.
- New utilities: [src/utils/paneSizing.ts](src/utils/paneSizing.ts) (default/min dimensions per orientation), [src/utils/paneLayout.ts](src/utils/paneLayout.ts) (CSS class helpers).

### Dual-Pane Background Mode
`settings.dualPaneBackground: 'separate' | 'primary' | 'secondary'` — controls whether the two panes use independent background colors or both use the primary/secondary Obsidian theme color. Exposed in General settings (desktop only).

### Update Notice Indicator
[src/components/UpdateNoticeIndicator.tsx](src/components/UpdateNoticeIndicator.tsx) — a small badge shown in the navigator header when a new plugin version is available. Uses [src/hooks/useAutoDismissFade.ts](src/hooks/useAutoDismissFade.ts) for the auto-fade animation.

---

## Architecture Notes

- The topic system deliberately mirrors the tag system in structure (service, context, appearance settings, shortcuts, context menus, keyboard navigation) to minimise divergence from upstream patterns.
- Topic paths use `/`-separated strings like tag paths but are based on note names, not Obsidian tag syntax.
- `require(...)` is used in a few places inside callbacks to avoid circular imports at module load time (e.g. `getTopicAncestors` inside `handleShortcutTopicActivate`). These are intentional workarounds.
- The `SUBSET_RELATIONS` and `HAS_TOPIC_RELATIONS` constants are domain-specific to the owner's Dutch/English mixed Obsidian vault (note values like `groep`, `artiest`, `adres`, `gerecht`, `maand`). They are not locale-configurable.
