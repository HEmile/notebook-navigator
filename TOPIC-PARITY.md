# Topic parity audit (2026-11-15, after the 3.5.2 merge)

This audit checks folder and tag features against topics across the navigation pane, the list pane and search, and the
settings, commands, services and API. It was a code read, not a run in Obsidian. Items marked ✓ were confirmed by
reading the code again. The others come from the audit and look right, but haven't been checked line by line.

Every finding is filed as a GitHub issue with the `topics` label: bugs are HEmile/notebook-navigator#9 to #25,
enhancements #26 to #48
([open topic issues](https://github.com/HEmile/notebook-navigator/issues?q=is%3Aissue+label%3Atopics)). Track progress
there; this file is the snapshot from the audit.

Only one finding comes from this merge: the blank Topics row in reorder mode (upstream #328). Everything else was
already in the fork before it.

## Tier 1: bugs in topic features that already exist

1. ✓ **The topic graph is built only at startup.** `rebuildTopicTree` (`src/context/StorageContext.tsx:293`) runs only
   in the initial-load branch (`src/context/storage/useStorageVaultSync.ts:225`). These changes never update it:
   - new, deleted or renamed notes, and frontmatter edits;
   - turning `showTopics` on, or changing `topicTags`;
   - hidden folders, the vault profile, or show-hidden-items.

   The topic section memo in `useNavigationPaneTreeSections.ts` has no graph version in its dependencies, so a rebuild
   would not re-render anyway. Fix: rebuild wherever `scheduleTagTreeRebuild` runs, and add a graph version to the memo.

2. ✓ **"Clean up metadata" deletes topic icons, colors and backgrounds.** Topics store these in `tagColors`, `tagIcons`
   and `tagBackgroundColors`, keyed by topic name. The cleanup validator (`TagMetadataService.ts:610`, `:677`) only
   accepts names in the tag tree, so it removes them. Renaming or deleting a tag also moves or removes the styling of a
   topic with the same name. Minimal fix: make the validators accept topic names too.
3. ✓ **`topic:"Name"` search fails when the name has capitals.** `filterSearch.ts:928` lowercases the name, but
   `findTopicNode` (`topicGraph.ts:349`) compares it exactly, so the search hides every file.
4. ✓ **Reveal bugs in `useNavigatorReveal.ts`.**
   - Lines 1109 and 1135 expand `'topics'` instead of `TOPICS_ROOT_VIRTUAL_FOLDER_ID` (`'topics-root'`).
   - `revealTopicAllPaths` selects the bare name (line 1149), so a nested topic is never highlighted.
   - `revealTopic` builds `name/name` (line 1100).
5. ✓ **Topics never scroll into view.** `buildNavigationPathIndexMap` (`navigationIndex.ts:70`) has no topic branch. The
   same gap is in the selected item type in `useNavigationPaneScroll.ts`. `ensureSelectedNavigationItemVisible` and
   `handleTreeUpdateComplete` send a topic path as `ItemType.FOLDER`.
6. **Pinned notes leak between contexts.**
   - `listItems.ts:244` has no topic `contextFilter`, so a topic's list shows notes pinned in folder, tag and property
     contexts.
   - `MetadataAPI.unpin`, `isPinned` and `pin('all')`, and `FileMetadataService.isPinned`, ignore the `topic` context.
     `unpin` can drop a topic pin.
7. **A topic's list doesn't refresh on metadata changes.** `useListPaneRefresh.ts:442` handles tag and property
   selections only.
8. **Topic row rendering** (`TopicRow` in `NavigationPaneTreeRow.tsx`).
   - A background color never shows, because the row lacks the `nn-has-custom-background` class.
   - The count shows `0`, and ignores the descendants and separate-counts settings.
   - The chevron icon is hard-coded.
   - The Topics header reuses the Tags section icon.
9. **Changing topic sort order doesn't re-render.** `setTopicSortOrder` (`PluginPreferencesController.ts:376`) never
   calls `notifySettingsUpdate`. It also writes a localStorage key that nothing reads.
10. **Topic shortcuts are never marked missing.** `useNavigationPaneListSections.ts:332` and `ShortcutsContext.tsx:535`
    hardcode `isMissing: false`.
11. **List pane state is keyed wrongly for topics.**
    - Manual sort is broken: `useListActions.ts:972` doesn't pass the topic, and `ListPane.tsx:460` returns the session
      key `'none'`.
    - Collapsed list groups are shared with the vault root (`listGroupCollapse.ts:75`).
    - The scroll context keys in `useListPaneScroll.ts:1487` and `:1543` leave out the topic.
12. **Reorder mode (#328) shows a blank Topics row.** The row has no label or icon, and still shows when topics are off
    (`useNavigationRootReorder.tsx:455`, `:1280`). This is the one finding from the merge.
13. **`hasTopicTag` matches by substring** (`topicGraph.ts:108`). For example, `#maandag` counts as the `maand` topic
    tag.
14. **The parent-folder line is hidden in topic lists**, though topic lists are vault-wide like tag lists
    (`listPaneMeasurements.ts:504`).
15. **The selection history skips topics** (`selection/state.ts:70`). `navigateSelectionHistory` sends any entry that
    isn't a folder or tag to `navigateToProperty`.

## Tier 2: missing parity, small to medium

- **Keyboard navigation**: arrows, Home/End, left/right and Enter skip topic rows (`useNavigationPaneKeyboard.ts`). The
  collapse-selected command has no topic target (`navigationExpansion.ts:220`). Depends on item 5.
- **Expand all, collapse all and smart collapse** ignore `expandedTopics` (`useNavigationActions.ts`).
- **The collapse-other-branches setting** is ignored for topics, which toggle with `TOGGLE_TOPIC_EXPANDED` directly.
- **Alt+click to toggle all descendants**: the `TOGGLE_DESCENDANT_TOPICS` reducer exists, but nothing dispatches it.
- **Stale expanded topics** are never cleaned up, because nothing dispatches `CLEANUP_DELETED_TOPICS`.
- **Commands** ignore a topic selection: open all files, toggle pinned section, select next/previous file
  (`navigatorCommandHandlers.ts:228`).
- **The selected topic isn't restored after a reload.** There is no storage key for it.
- **Selecting a topic doesn't auto-select a file** (`useSelectionProvider.ts:267`).
- **Opening a note switches the selection away from the topic**, even when the note belongs to it
  (`revealFileInNearestFolder`).
- **Renaming or deleting a topic note doesn't move its keyed state**: sort overrides, appearances, hidden state,
  styling, shortcuts, expansion.
- **The Topics settings page only has two settings.** It is missing a `topicTags` field, an icons toggle and a hidden
  topics list. The default tags are duplicated as a hardcoded fallback in `StorageContext.tsx:298`.
- **Settings aren't validated on load**: `topicSortOrder`, `topicTags`, `hiddenTopics`, `rootTopicOrder`.
- **The context menu** uses the older icon and color pickers. It lacks:
  - the appearance dialog;
  - copy, paste and remove for styles;
  - a navigation separator;
  - an icon item that respects the icon setting.
- **The section header menu** has no Topics entries (`navigationSectionMenuBuilder.ts:73`).
- **Appearance** is missing:
  - indent guides;
  - color inheritance along the topic graph, and rainbow colors;
  - root-level spacing;
  - a list pane header icon.
- **Search**: no modifier-click to add a topic to the search, no highlight for search matches, and a saved search under
  a topic doesn't remember the topic.
- **Topic shortcut activation** doesn't focus the navigation pane in dual-pane mode, which tag shortcuts do.

## Tier 3: larger features with no topic version

- **Drag and drop**: dragging a topic to shortcuts or the editor, and dropping notes onto a topic, which would write a
  frontmatter link.
- **New note under the selected topic**, with the topic link in its frontmatter.
- **Manual root order and reorder mode for topics.** `useRootTopicOrder` and `rootTopicOrder` exist but are never used:
  wire them in or delete them. There is also no child sort order (`topicTreeSortOverrides`).
- **A navigate-to-topic command** (fuzzy modal), and a topic sort toggle command.
- **Topic pills on file rows.**
- **"Apply to descendants"** for topic sort and appearance.
- **Separate `topicColors` / `topicIcons` / `topicBackgroundColors` maps.** This removes the collision with tags by
  design.
- **`hiddenTopics` per vault profile**, and a syncable `topicSortOrder`.

## Not applicable to topics

- Inline rename and delete: a topic is a note.
- The untagged and "all tags" collections.
- Scoping tags to the current selection.
- The keep-empty-tags-property option.
- Folder-only features: folder notes, templates, exclusions, root folder.
- The Dual pane settings group, settings export to the vault root, and the note name format setting.
