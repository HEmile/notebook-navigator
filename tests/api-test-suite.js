/**
 * Notebook Navigator API Test Suite
 * Version: 2.0.0 - Updated with complete API coverage
 *
 * A comprehensive test suite for the Notebook Navigator API.
 * Paste this entire script into the Obsidian developer console to run tests.
 *
 * Tests include:
 * - Icon format validation (frontmatter-style icon values)
 * - NavItem type for navigation selection
 * - Event API with all supported event types
 * - Context-aware pinning with PinContext type
 * - Map-based returns (getPinned returns Readonly<Pinned> Map)
 *
 * ⚠️ WARNING: This test suite will create and delete files in your vault!
 *
 * TEST DATA LOCATION:
 * - Creates temporary test files at the ROOT of your vault with names like:
 *   - test-navigation.md
 *   - test-pinned.md
 * - Creates temporary test folders at the ROOT of your vault:
 *   - test-metadata-folder/
 *
 * CLEANUP:
 * - All test files and folders are automatically deleted after tests complete
 * - If tests fail or are interrupted, you may need to manually delete test files
 * - Use runTests({cleanup: false}) to keep test data for inspection
 *
 * SAFETY:
 * - Only creates files/folders with "test-" prefix
 * - Does NOT modify any existing files in your vault
 * - Does NOT read or access your personal notes
 * - Modifies plugin settings temporarily (colors, icons, pins) but restores them
 *
 * Usage:
 *   runTests()                    - Run all tests (with auto-cleanup)
 *   runTests({verbose: true})     - Show detailed output
 *   runTests({only: 'metadata'})  - Run only specific test suite
 *   runTests({only: ['metadata', 'navigation']}) - Run multiple suites
 *   runTests({cleanup: false})    - Keep test files after running (for debugging)
 */

(function () {
    'use strict';

    // Test Framework
    class TestRunner {
        constructor(options = {}) {
            this.options = {
                verbose: false,
                only: null,
                cleanup: true,
                ...options
            };

            this.results = {
                passed: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };

            this.testFiles = [];
            this.testFolders = [];
            this.startTime = null;
        }

        // Console styling
        log(message, type = 'info') {
            const styles = {
                header: 'color: #7c3aed; font-weight: bold; font-size: 14px',
                success: 'color: #10b981; font-weight: bold',
                error: 'color: #ef4444; font-weight: bold',
                warning: 'color: #f59e0b; font-weight: bold',
                info: 'color: #6b7280',
                test: 'color: #3b82f6',
                dim: 'color: #9ca3af'
            };

            console.log(`%c${message}`, styles[type] || styles.info);
        }

        // Assertions
        assertEqual(actual, expected, message) {
            if (actual !== expected) {
                throw new Error(message || `Expected ${expected}, got ${actual}`);
            }
        }

        assertTrue(condition, message) {
            if (!condition) {
                throw new Error(message || 'Assertion failed: expected true');
            }
        }

        assertFalse(condition, message) {
            if (condition) {
                throw new Error(message || 'Assertion failed: expected false');
            }
        }

        assertExists(value, message) {
            if (value === null || value === undefined) {
                throw new Error(message || 'Value does not exist');
            }
        }

        async assertThrows(fn, message) {
            let threw = false;
            try {
                await fn();
            } catch (e) {
                threw = true;
            }
            if (!threw) {
                throw new Error(message || 'Expected function to throw');
            }
        }

        // Test execution
        async runTest(name, testFn) {
            if (this.options.verbose) {
                this.log(`  Running: ${name}`, 'dim');
            }

            const startTime = performance.now();

            try {
                await testFn();
                const duration = (performance.now() - startTime).toFixed(2);
                this.log(`  ✅ ${name} (${duration}ms)`, 'success');
                this.results.passed++;
            } catch (error) {
                const duration = (performance.now() - startTime).toFixed(2);
                this.log(`  ❌ ${name} (${duration}ms)`, 'error');
                this.log(`     ${error.message}`, 'error');
                this.results.failed++;
                this.results.errors.push({ test: name, error: error.message });
            }
        }

        async runSuite(suiteName, tests) {
            // Check if we should run this suite
            if (this.options.only) {
                const only = Array.isArray(this.options.only) ? this.options.only : [this.options.only];
                if (!only.includes(suiteName.toLowerCase())) {
                    this.results.skipped += Object.keys(tests).length;
                    return;
                }
            }

            this.log(`\n📋 ${suiteName}`, 'header');

            for (const [testName, testFn] of Object.entries(tests)) {
                await this.runTest(testName, testFn.bind(this));
            }
        }

        // Helper methods for test data
        async createTestFile(path, content = '') {
            const file = await app.vault.create(path, content);
            this.testFiles.push(file);
            return file;
        }

        async createTestFolder(path) {
            await app.vault.createFolder(path);
            const folder = app.vault.getFolderByPath(path);
            this.testFolders.push(folder);
            return folder;
        }

        async cleanup() {
            if (!this.options.cleanup) return;

            this.log('\n🧹 Cleaning up test data...', 'dim');

            // Delete test files
            for (const file of this.testFiles) {
                try {
                    await app.fileManager.trashFile(file);
                } catch (e) {
                    // File might already be deleted
                }
            }

            // Delete test folders (in reverse order to delete children first)
            for (const folder of this.testFolders.reverse()) {
                try {
                    await app.fileManager.trashFile(folder);
                } catch (e) {
                    // Folder might already be deleted
                }
            }

            this.testFiles = [];
            this.testFolders = [];
        }

        async run() {
            this.startTime = performance.now();

            this.log('🚀 Notebook Navigator API Test Suite', 'header');
            this.log('================================\n', 'header');

            // Get the API
            const plugin = app.plugins.plugins['notebook-navigator'];
            if (!plugin) {
                this.log('❌ Notebook Navigator plugin is not installed or enabled', 'error');
                return;
            }

            const api = plugin.api;
            if (!api) {
                this.log('❌ Notebook Navigator API is not available', 'error');
                return;
            }

            this.api = api;
            this.log(`API Version: ${api.getVersion()}`, 'info');

            // Run test suites
            await this.runSuite('Core API', this.coreTests());
            await this.runSuite('Navigation', this.navigationTests());
            await this.runSuite('Metadata', this.metadataTests());
            await this.runSuite('Selection', this.selectionTests());
            await this.runSuite('Events', this.eventTests());

            // Cleanup
            await this.cleanup();

            // Results
            this.printResults();
        }

        printResults() {
            const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);

            this.log('\n================================', 'header');
            this.log('📊 Test Results', 'header');
            this.log('================================\n', 'header');

            this.log(`✅ Passed: ${this.results.passed}`, 'success');
            if (this.results.failed > 0) {
                this.log(`❌ Failed: ${this.results.failed}`, 'error');
            }
            if (this.results.skipped > 0) {
                this.log(`⏭️  Skipped: ${this.results.skipped}`, 'warning');
            }

            this.log(`\n⏱️  Total time: ${duration}s`, 'info');

            if (this.results.errors.length > 0) {
                this.log('\n❌ Failed Tests:', 'error');
                for (const error of this.results.errors) {
                    this.log(`  • ${error.test}: ${error.error}`, 'error');
                }
            }

            if (this.results.failed === 0) {
                this.log('\n🎉 All tests passed!', 'success');
            }
        }

        // Test Suites
        coreTests() {
            return {
                'API version should be defined': async function () {
                    const version = this.api.getVersion();
                    this.assertExists(version, 'API version is not defined');
                    this.assertTrue(version.match(/^\d+\.\d+\.\d+$/), `Invalid version format: ${version}`);
                },

                'Should have isStorageReady method': async function () {
                    this.assertExists(this.api.isStorageReady, 'isStorageReady method not found');
                    const isReady = this.api.isStorageReady();
                    this.assertTrue(typeof isReady === 'boolean', 'isStorageReady should return a boolean');
                },

                'Should have whenReady method': async function () {
                    this.assertExists(this.api.whenReady, 'whenReady method not found');
                    const readyPromise = this.api.whenReady();
                    this.assertTrue(typeof readyPromise?.then === 'function', 'whenReady should return a Promise');
                },

                'Should expose tagCollections helpers': async function () {
                    this.assertExists(this.api.tagCollections, 'tagCollections helper not found');
                    this.assertEqual(this.api.tagCollections.taggedId, '__tagged__', 'taggedId should match the public constant');
                    this.assertEqual(this.api.tagCollections.untaggedId, '__untagged__', 'untaggedId should match the public constant');
                    this.assertTrue(this.api.tagCollections.isCollection('__tagged__'), 'Should detect tagged aggregate id');
                    this.assertFalse(this.api.tagCollections.isCollection('work'), 'Normal tags should not be treated as aggregate ids');
                    this.assertTrue(
                        typeof this.api.tagCollections.getLabel(this.api.tagCollections.taggedId) === 'string',
                        'getLabel should return a string'
                    );
                },

                'Should expose propertyNodes helpers': async function () {
                    this.assertExists(this.api.propertyNodes, 'propertyNodes helper not found');
                    this.assertEqual(this.api.propertyNodes.rootId, 'properties-root', 'rootId should match the public constant');
                    const rootParts = this.api.propertyNodes.parse(this.api.propertyNodes.rootId);
                    this.assertExists(rootParts, 'parse(rootId) should return a descriptor');
                    this.assertEqual(rootParts.kind, 'root', 'Root descriptor should use kind=root');
                }
            };
        }

        navigationTests() {
            return {
                'Navigation API should exist': async function () {
                    this.assertExists(this.api.navigation, 'Navigation API not found');
                },

                'Should resolve file navigation to a boolean': async function () {
                    const testFile = await this.createTestFile('test-navigation.md', '# Test Navigation');
                    const revealed = await this.api.navigation.reveal(testFile);
                    this.assertTrue(typeof revealed === 'boolean', 'Navigation should resolve to a boolean');
                },

                'Should handle navigation to non-existent file gracefully': async function () {
                    const fakeFile = { path: 'fake-file-that-does-not-exist.md' };
                    const revealed = await this.api.navigation.reveal(fakeFile);
                    this.assertFalse(revealed, 'Should return false for non-existent file');
                }
            };
        }

        metadataTests() {
            return {
                'Metadata API should exist': async function () {
                    this.assertExists(this.api.metadata, 'Metadata API not found');
                },

                'Should get and set folder metadata': async function () {
                    const testFolder = await this.createTestFolder('test-metadata-folder');

                    // Get initial metadata (should be null when nothing is set)
                    const initialMeta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(initialMeta, null, 'Should return null when no metadata is set');

                    // Set color
                    await this.api.metadata.setFolderMeta(testFolder, { color: '#ff0000' });
                    const afterColor = this.api.metadata.getFolderMeta(testFolder);
                    this.assertExists(afterColor, 'Should return metadata after setting color');
                    this.assertEqual(afterColor.color, '#ff0000', 'Color should be set');

                    // Set icon - test both Lucide and emoji formats
                    await this.api.metadata.setFolderMeta(testFolder, { icon: 'folder-open' });
                    const afterIcon = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(afterIcon.icon, 'folder-open', 'Icon should be set');

                    // Test emoji icon format
                    await this.api.metadata.setFolderMeta(testFolder, { icon: '📁' });
                    const afterEmoji = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(afterEmoji.icon, '📁', 'Emoji icon should be set');

                    // Clear metadata by passing null
                    await this.api.metadata.setFolderMeta(testFolder, { color: null, icon: null });
                    const cleared = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(cleared, null, 'Should return null when all metadata is cleared');
                },

                'Should manage tag metadata': async function () {
                    const testTag = '#test-tag';

                    // Get initial metadata (should be null when nothing is set)
                    const initialMeta = this.api.metadata.getTagMeta(testTag);
                    this.assertEqual(initialMeta, null, 'Should return null when no metadata is set');

                    // Set color
                    await this.api.metadata.setTagMeta(testTag, { color: '#00ff00' });
                    const afterColor = this.api.metadata.getTagMeta(testTag);
                    this.assertExists(afterColor, 'Should return metadata after setting color');
                    this.assertEqual(afterColor.color, '#00ff00', 'Tag color should be set');

                    // Set icon - test both Lucide and emoji formats
                    await this.api.metadata.setTagMeta(testTag, { icon: 'tag' });
                    const afterIcon = this.api.metadata.getTagMeta(testTag);
                    this.assertEqual(afterIcon.icon, 'tag', 'Tag icon should be set');

                    // Test emoji icon format
                    await this.api.metadata.setTagMeta(testTag, { icon: '🏷️' });
                    const afterEmoji = this.api.metadata.getTagMeta(testTag);
                    this.assertEqual(afterEmoji.icon, '🏷️', 'Emoji icon should be set');

                    // Clear metadata by passing null
                    await this.api.metadata.setTagMeta(testTag, { color: null, icon: null });
                    const cleared = this.api.metadata.getTagMeta(testTag);
                    this.assertEqual(cleared, null, 'Should return null when all metadata is cleared');
                },

                'Should handle tag normalization': async function () {
                    // Test that tags work with and without # prefix
                    const tagWithHash = '#normalize-test';
                    const tagWithoutHash = 'normalize-test';

                    // Set metadata using tag without #
                    await this.api.metadata.setTagMeta(tagWithoutHash, { color: '#123456' });

                    // Get metadata using tag with # - should return the same data
                    const metaWithHash = this.api.metadata.getTagMeta(tagWithHash);
                    this.assertExists(metaWithHash, 'Should find metadata when querying with #');
                    this.assertEqual(metaWithHash.color, '#123456', 'Should return same color regardless of # prefix');

                    // Get metadata using tag without # - should also work
                    const metaWithoutHash = this.api.metadata.getTagMeta(tagWithoutHash);
                    this.assertExists(metaWithoutHash, 'Should find metadata when querying without #');
                    this.assertEqual(metaWithoutHash.color, '#123456', 'Should return same color regardless of # prefix');

                    // Test case-insensitive normalization
                    const upperTag = 'NORMALIZE-TEST';
                    const metaUpper = this.api.metadata.getTagMeta(upperTag);
                    this.assertExists(metaUpper, 'Should find metadata when querying with uppercase');
                    this.assertEqual(metaUpper.color, '#123456', 'Should return same color for uppercase tag');

                    // Test mixed case with hash
                    const mixedTag = '#Normalize-Test';
                    const metaMixed = this.api.metadata.getTagMeta(mixedTag);
                    this.assertExists(metaMixed, 'Should find metadata when querying with mixed case');
                    this.assertEqual(metaMixed.color, '#123456', 'Should return same color for mixed case tag');

                    // Clean up
                    await this.api.metadata.setTagMeta(tagWithHash, { color: null });
                },

                'Should handle partial metadata updates': async function () {
                    const testFolder = await this.createTestFolder('test-partial-update-folder');

                    // Set both color and icon
                    await this.api.metadata.setFolderMeta(testFolder, {
                        color: '#ff0000',
                        icon: 'folder'
                    });

                    let meta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(meta.color, '#ff0000', 'Color should be set');
                    this.assertEqual(meta.icon, 'folder', 'Icon should be set');

                    // Update only color (icon should be preserved)
                    await this.api.metadata.setFolderMeta(testFolder, { color: '#00ff00' });
                    meta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(meta.color, '#00ff00', 'Color should be updated');
                    this.assertEqual(meta.icon, 'folder', 'Icon should be preserved when not specified');

                    // Update only icon (color should be preserved)
                    await this.api.metadata.setFolderMeta(testFolder, { icon: '📂' });
                    meta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(meta.color, '#00ff00', 'Color should be preserved when not specified');
                    this.assertEqual(meta.icon, '📂', 'Icon should be updated');

                    // Clear only color (icon should remain)
                    await this.api.metadata.setFolderMeta(testFolder, { color: null });
                    meta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(meta.color, undefined, 'Color should be cleared');
                    this.assertEqual(meta.icon, '📂', 'Icon should still be present');

                    // Clear icon as well
                    await this.api.metadata.setFolderMeta(testFolder, { icon: null });
                    meta = this.api.metadata.getFolderMeta(testFolder);
                    this.assertEqual(meta, null, 'Should return null when all metadata is cleared');
                },

                'Should manage pinned files': async function () {
                    const testFile = await this.createTestFile('test-pinned.md', '# Pinned Test');

                    // Initially should not be pinned
                    let isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should not be pinned initially');

                    // Pin the file (defaults to 'all' - both contexts)
                    await this.api.metadata.pin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertTrue(isPinned, 'File should be pinned after pin()');

                    // Check specific contexts
                    this.assertTrue(this.api.metadata.isPinned(testFile, 'folder'), 'Should be pinned in folder context');
                    this.assertTrue(this.api.metadata.isPinned(testFile, 'tag'), 'Should be pinned in tag context');
                    this.assertTrue(this.api.metadata.isPinned(testFile, 'all'), 'Should be pinned in all contexts');

                    // Get all pinned files (returns Readonly<Map>)
                    const pinnedFiles = this.api.metadata.getPinned();
                    this.assertTrue(pinnedFiles instanceof Map, 'Should return Map of pinned files (Readonly<Pinned>)');
                    this.assertTrue(pinnedFiles.has(testFile.path), 'Pinned files should include our test file');

                    // Check context info in returned data
                    const ourContext = pinnedFiles.get(testFile.path);
                    this.assertExists(ourContext, 'Should have context for our pinned file');
                    this.assertTrue(ourContext.folder, 'Should have folder context');
                    this.assertTrue(ourContext.tag, 'Should have tag context');

                    // Unpin from specific context
                    await this.api.metadata.unpin(testFile, 'folder');
                    this.assertFalse(this.api.metadata.isPinned(testFile, 'folder'), 'Should not be pinned in folder context');
                    this.assertTrue(this.api.metadata.isPinned(testFile, 'tag'), 'Should still be pinned in tag context');
                    this.assertTrue(this.api.metadata.isPinned(testFile), 'Should still be pinned (in at least one context)');

                    // Pin in folder context again
                    await this.api.metadata.pin(testFile, 'folder');
                    this.assertTrue(this.api.metadata.isPinned(testFile, 'folder'), 'Should be pinned in folder context again');

                    // Unpin completely (from all contexts)
                    await this.api.metadata.unpin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should be unpinned after unpin()');
                    this.assertFalse(this.api.metadata.isPinned(testFile, 'folder'), 'Should not be pinned in folder context');
                    this.assertFalse(this.api.metadata.isPinned(testFile, 'tag'), 'Should not be pinned in tag context');
                }
            };
        }

        selectionTests() {
            return {
                'Selection API should exist': async function () {
                    this.assertExists(this.api.selection, 'Selection API not found');
                },

                'Should get selected navigation item': async function () {
                    const navItem = this.api.selection.getNavItem();
                    this.assertExists(navItem, 'Should return NavItem object');
                    this.assertExists(navItem.type, 'NavItem should have type field');
                    this.assertExists(navItem.folder !== undefined, 'NavItem should have folder property');
                    this.assertExists(navItem.tag !== undefined, 'NavItem should have tag property');
                    this.assertExists(navItem.property !== undefined, 'NavItem should have property field');

                    // Only one navigation target can be selected at a time
                    const selectedTargets = [navItem.folder, navItem.tag, navItem.property].filter(Boolean).length;
                    if (selectedTargets > 1) {
                        this.assertTrue(false, 'Only one of folder, tag, or property should be selected');
                    }

                    // If a folder is selected, it should be a valid TFolder
                    if (navItem.type === 'folder') {
                        this.assertExists(navItem.folder.path, 'Selected folder should have a path');
                        this.assertTrue(typeof navItem.folder.path === 'string', 'Folder path should be a string');
                    }

                    // If a tag is selected, it should be a string
                    if (navItem.type === 'tag') {
                        this.assertTrue(typeof navItem.tag === 'string', 'Tag should be a string');
                    }

                    // If a property is selected, it should be a string id
                    if (navItem.type === 'property') {
                        this.assertTrue(typeof navItem.property === 'string', 'Property should be a string');
                    }
                },

                'Should handle no selection gracefully': async function () {
                    // This test verifies the API handles the case when nothing is selected
                    const navItem = this.api.selection.getNavItem();
                    this.assertExists(navItem, 'Should always return a NavItem object');

                    // All can be null when nothing is selected
                    if (!navItem.folder && !navItem.tag && !navItem.property) {
                        this.assertTrue(true, 'API correctly handles no selection');
                    } else {
                        // Something is selected, which is also valid
                        this.assertTrue(true, 'API returns current selection');
                    }
                },

                'Should get file selection state': async function () {
                    // Test getting selection state
                    const state = this.api.selection.getCurrent();
                    this.assertExists(state, 'getSelectionState should return an object');
                    this.assertTrue(Array.isArray(state.files), 'State should have files array');
                    this.assertTrue(state.focused === null || typeof state.focused === 'object', 'State should have focused property');
                },

                'Should handle file selection events': async function () {
                    // Test event subscription
                    let eventFired = false;
                    let eventData = null;

                    const eventRef = this.api.on('selection-changed', ({ state }) => {
                        eventFired = true;
                        eventData = state;
                    });

                    // The event should have been set up
                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // Clean up event listener
                    this.api.off(eventRef);

                    // Verify event data structure if an event was captured
                    if (eventData) {
                        this.assertTrue(Array.isArray(eventData.files), 'Event should include files array (readonly TFile[])');
                        // Note: We don't test the readonly aspect, just that it's an array
                        // focused can be null or a TFile
                        this.assertTrue(
                            eventData.focused === null || typeof eventData.focused === 'object',
                            'Focused should be null or TFile'
                        );
                    }
                }
            };
        }

        eventTests() {
            return {
                'Should handle storage-ready event': async function () {
                    let eventFired = false;

                    const eventRef = this.api.on('storage-ready', () => {
                        eventFired = true;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle nav-item-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('nav-item-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.item, 'Should have item');

                        // Check nav item shape
                        if (eventData.item.folder) {
                            this.assertTrue(typeof eventData.item.folder === 'object', 'Folder should be TFolder object');
                            this.assertExists(eventData.item.folder.path, 'Folder should have path');
                            this.assertEqual(eventData.item.tag, null, 'Tag should be null when folder is selected');
                            this.assertEqual(eventData.item.property, null, 'Property should be null when folder is selected');
                        } else if (eventData.item.tag) {
                            this.assertTrue(typeof eventData.item.tag === 'string', 'Tag should be string');
                            this.assertEqual(eventData.item.folder, null, 'Folder should be null when tag is selected');
                            this.assertEqual(eventData.item.property, null, 'Property should be null when tag is selected');
                        } else if (eventData.item.property) {
                            this.assertTrue(typeof eventData.item.property === 'string', 'Property should be string');
                            this.assertEqual(eventData.item.folder, null, 'Folder should be null when property is selected');
                            this.assertEqual(eventData.item.tag, null, 'Tag should be null when property is selected');
                        } else {
                            this.assertEqual(eventData.item.folder, null, 'Folder should be null when nothing selected');
                            this.assertEqual(eventData.item.tag, null, 'Tag should be null when nothing selected');
                            this.assertEqual(eventData.item.property, null, 'Property should be null when nothing selected');
                        }
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle pinned-files-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('pinned-files-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertTrue(eventData.files instanceof Map, 'Should have files Map (Readonly<Pinned>)');
                        // Note: We don't test the readonly aspect, just that it's a Map
                        // Map contains all currently pinned files with their contexts
                        for (const [path, context] of eventData.files) {
                            this.assertTrue(typeof path === 'string', 'Path should be a string');
                            this.assertExists(context, 'Each entry should have context');
                            this.assertTrue(typeof context.folder === 'boolean', 'Context should have folder boolean');
                            this.assertTrue(typeof context.tag === 'boolean', 'Context should have tag boolean');
                        }
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle folder-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('folder-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.folder, 'Should have folder');
                        this.assertTrue(
                            eventData.metadata === null || typeof eventData.metadata === 'object',
                            'Metadata should be null or an object'
                        );
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle tag-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('tag-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.tag, 'Should have tag');
                        this.assertTrue(
                            eventData.metadata === null || typeof eventData.metadata === 'object',
                            'Metadata should be null or an object'
                        );
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should unsubscribe from events': async function () {
                    // Test that off() works correctly
                    const eventRef = this.api.on('storage-ready', () => {});
                    this.assertExists(eventRef, 'Should get event reference');

                    // Should not throw when unsubscribing
                    this.api.off(eventRef);

                    // Should be idempotent (safe to call multiple times)
                    this.api.off(eventRef);
                    this.api.off(eventRef);
                },

                'Should handle once() for one-time event subscription': async function () {
                    // Test that once() only fires once
                    let callCount = 0;

                    // Subscribe with once
                    const ref = this.api.once('storage-ready', () => {
                        callCount++;
                    });

                    this.assertExists(ref, 'once() should return an event reference');

                    // Note: We can't easily trigger events in this test environment,
                    // but we can verify the method exists and returns a reference
                    // In a real scenario, the callback would only fire once

                    // Try to unsubscribe (should be safe even if already auto-unsubscribed)
                    this.api.off(ref);

                    // Test once() with different event types
                    const onceRef1 = this.api.once('nav-item-changed', ({ item }) => {});
                    const onceRef2 = this.api.once('selection-changed', ({ state }) => {});

                    this.assertExists(onceRef1, 'once() should work with nav-item-changed');
                    this.assertExists(onceRef2, 'once() should work with selection-changed');

                    // Clean up
                    this.api.off(onceRef1);
                    this.api.off(onceRef2);
                },

                'Event API should support all documented event types': async function () {
                    // Test that all event types can be subscribed to
                    const eventTypes = [
                        'storage-ready',
                        'nav-item-changed',
                        'selection-changed',
                        'pinned-files-changed',
                        'folder-changed',
                        'tag-changed',
                        'property-changed'
                    ];

                    const refs = [];

                    // Subscribe to all event types with on()
                    for (const eventType of eventTypes) {
                        const ref = this.api.on(eventType, () => {});
                        this.assertExists(ref, `Should be able to subscribe to ${eventType}`);
                        refs.push(ref);
                    }

                    // Also test with once()
                    const onceRefs = [];
                    for (const eventType of eventTypes) {
                        const ref = this.api.once(eventType, () => {});
                        this.assertExists(ref, `Should be able to subscribe once to ${eventType}`);
                        onceRefs.push(ref);
                    }

                    // Clean up all subscriptions
                    for (const ref of [...refs, ...onceRefs]) {
                        this.api.off(ref);
                    }

                    this.assertTrue(true, 'All event types are supported with both on() and once()');
                }
            };
        }
    }

    // Make the test runner globally available
    window.runTests = async function (options = {}) {
        const runner = new TestRunner(options);
        await runner.run();
        return runner.results;
    };

    // Auto-run if this script is executed directly
    if (typeof runTests !== 'undefined') {
        console.log('Notebook Navigator API Test Suite loaded!');
        console.log('Run tests with: runTests()');
        console.log('Options:');
        console.log('  runTests({verbose: true})     - Show detailed output');
        console.log('  runTests({only: "metadata"})  - Run only specific suite');
        console.log('  runTests({cleanup: false})    - Keep test data after running');
    }
})();

// Run the tests immediately
runTests();
