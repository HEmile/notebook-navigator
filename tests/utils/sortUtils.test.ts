import { describe, expect, it } from 'vitest';
import {
    compareByAlphaSortOrder,
    getEffectiveSortOption,
    resolveFolderChildSortOrder,
    sortFiles,
    shouldRefreshOnFileModifyForSort,
    shouldRefreshOnMetadataChangeForSort
} from '../../src/utils/sortUtils';
import type { AlphaSortOrder } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { ItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../src/types';
import { buildPropertyKeyNodeId } from '../../src/utils/propertyTree';
import { createTestTFile } from './createTestTFile';

function createFolderSortSettings(folderSortOrder: AlphaSortOrder, overrides: Record<string, AlphaSortOrder> = {}) {
    return {
        folderSortOrder,
        folderTreeSortOverrides: overrides
    };
}

describe('sortFiles', () => {
    it('sorts by file name (A on top / Z on top)', () => {
        const files = [
            createTestTFile('z/file10.md'),
            createTestTFile('z/file2.md'),
            createTestTFile('z/file1.md'),
            createTestTFile('z/file001.md')
        ];

        sortFiles(
            files,
            'filename-asc',
            () => 0,
            () => 0
        );
        expect(files.map(file => file.basename)).toEqual(['file1', 'file001', 'file2', 'file10']);

        sortFiles(
            files,
            'filename-desc',
            () => 0,
            () => 0
        );
        expect(files.map(file => file.basename)).toEqual(['file10', 'file2', 'file1', 'file001']);
    });

    it('uses path as a deterministic tie-breaker', () => {
        const files = [createTestTFile('b/dup.md'), createTestTFile('a/dup.md')];

        sortFiles(
            files,
            'filename-asc',
            () => 0,
            () => 0
        );

        expect(files.map(file => file.path)).toEqual(['a/dup.md', 'b/dup.md']);
    });

    it('sorts by property then title (A on top)', () => {
        const propertyValueByPath = new Map<string, string | null>([
            ['z/with-b.md', 'b'],
            ['z/with-a.md', 'a'],
            ['z/with-a2.md', 'a'],
            ['z/missing-z.md', null],
            ['z/missing-m.md', null]
        ]);

        const files = [
            createTestTFile('z/missing-z.md'),
            createTestTFile('z/with-b.md'),
            createTestTFile('z/missing-m.md'),
            createTestTFile('z/with-a2.md'),
            createTestTFile('z/with-a.md')
        ];

        sortFiles(
            files,
            'property-asc',
            () => 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null
        );

        expect(files.map(file => file.basename)).toEqual(['with-a', 'with-a2', 'with-b', 'missing-m', 'missing-z']);
    });

    it('sorts property values using natural comparison', () => {
        const propertyValueByPath = new Map<string, string | null>([
            ['z/with-10.md', '10'],
            ['z/with-2.md', '2'],
            ['z/with-1.md', '1']
        ]);

        const files = [createTestTFile('z/with-10.md'), createTestTFile('z/with-2.md'), createTestTFile('z/with-1.md')];

        sortFiles(
            files,
            'property-asc',
            () => 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null
        );
        expect(files.map(file => file.basename)).toEqual(['with-1', 'with-2', 'with-10']);

        sortFiles(
            files,
            'property-desc',
            () => 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null
        );
        expect(files.map(file => file.basename)).toEqual(['with-10', 'with-2', 'with-1']);
    });

    it('sorts by property then title (Z on top)', () => {
        const propertyValueByPath = new Map<string, string | null>([
            ['z/with-b.md', 'b'],
            ['z/with-a.md', 'a'],
            ['z/missing-a.md', null],
            ['z/missing-z.md', null]
        ]);

        const files = [
            createTestTFile('z/missing-a.md'),
            createTestTFile('z/with-a.md'),
            createTestTFile('z/missing-z.md'),
            createTestTFile('z/with-b.md')
        ];

        sortFiles(
            files,
            'property-desc',
            () => 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null
        );

        expect(files.map(file => file.basename)).toEqual(['with-b', 'with-a', 'missing-z', 'missing-a']);
    });

    it('sorts by property then created date when configured', () => {
        const propertyValueByPath = new Map<string, string | null>([
            ['z/one.md', 'a'],
            ['z/two.md', 'a'],
            ['z/three.md', 'a']
        ]);
        const createdTimeByPath = new Map<string, number>([
            ['z/one.md', 10],
            ['z/two.md', 30],
            ['z/three.md', 20]
        ]);

        const files = [createTestTFile('z/two.md'), createTestTFile('z/three.md'), createTestTFile('z/one.md')];

        sortFiles(
            files,
            'property-asc',
            file => createdTimeByPath.get(file.path) ?? 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null,
            'created'
        );

        expect(files.map(file => file.basename)).toEqual(['one', 'three', 'two']);

        sortFiles(
            files,
            'property-desc',
            file => createdTimeByPath.get(file.path) ?? 0,
            () => 0,
            file => file.basename,
            file => propertyValueByPath.get(file.path) ?? null,
            'created'
        );

        expect(files.map(file => file.basename)).toEqual(['two', 'three', 'one']);
    });

    it('sorts by property then file name when configured', () => {
        const propertyValueByPath = new Map<string, string | null>([
            ['z/a.md', 'a'],
            ['z/b.md', 'a']
        ]);
        const displayNameByPath = new Map<string, string>([
            ['z/a.md', 'zebra'],
            ['z/b.md', 'alpha']
        ]);

        const files = [createTestTFile('z/b.md'), createTestTFile('z/a.md')];

        sortFiles(
            files,
            'property-asc',
            () => 0,
            () => 0,
            file => displayNameByPath.get(file.path) ?? file.basename,
            file => propertyValueByPath.get(file.path) ?? null,
            'filename'
        );

        expect(files.map(file => file.basename)).toEqual(['a', 'b']);
    });
});

describe('sort refresh triggers', () => {
    it('detects when file modify events should refresh sorted results', () => {
        expect(shouldRefreshOnFileModifyForSort('modified-desc', 'title')).toBe(true);
        expect(shouldRefreshOnFileModifyForSort('property-asc', 'modified')).toBe(true);
        expect(shouldRefreshOnFileModifyForSort('property-desc', 'title')).toBe(false);
        expect(shouldRefreshOnFileModifyForSort('title-asc', 'modified')).toBe(false);
    });

    it('detects when metadata change events should refresh sorted results', () => {
        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'title-asc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'title-asc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: 'title',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'created-desc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: 'created',
                frontmatterModifiedField: ''
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'created-desc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: false,
                frontmatterNameField: '',
                frontmatterCreatedField: 'created',
                frontmatterModifiedField: ''
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'modified-asc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: 'modified'
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: 'order',
                propertySortSecondary: 'title',
                useFrontmatterMetadata: false,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'created',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: 'created',
                frontmatterModifiedField: ''
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'modified',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'modified',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: 'modified'
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'modified',
                useFrontmatterMetadata: false,
                frontmatterNameField: '',
                frontmatterCreatedField: 'created',
                frontmatterModifiedField: 'modified'
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'title',
                useFrontmatterMetadata: true,
                frontmatterNameField: '',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(false);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'title',
                useFrontmatterMetadata: true,
                frontmatterNameField: 'title',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(true);

        expect(
            shouldRefreshOnMetadataChangeForSort({
                sortOption: 'property-asc',
                propertySortKey: '',
                propertySortSecondary: 'title',
                useFrontmatterMetadata: false,
                frontmatterNameField: 'title',
                frontmatterCreatedField: '',
                frontmatterModifiedField: ''
            })
        ).toBe(false);
    });
});

describe('folder child sort order', () => {
    it('compares names using natural order and configured direction', () => {
        expect(compareByAlphaSortOrder('folder2', 'folder10', 'alpha-asc')).toBeLessThan(0);
        expect(compareByAlphaSortOrder('folder2', 'folder10', 'alpha-desc')).toBeGreaterThan(0);
    });

    it('resolves child order from global folder sort setting', () => {
        const settings = createFolderSortSettings('alpha-desc');
        expect(resolveFolderChildSortOrder(settings, 'projects')).toBe('alpha-desc');
    });

    it('resolves child order from folder override when present', () => {
        const settings = createFolderSortSettings('alpha-asc', {
            projects: 'alpha-desc'
        });
        expect(resolveFolderChildSortOrder(settings, 'projects')).toBe('alpha-desc');
    });

    it('resolves root child order from root override when present', () => {
        const settings = createFolderSortSettings('alpha-asc', {
            '/': 'alpha-desc'
        });
        expect(resolveFolderChildSortOrder(settings, '/')).toBe('alpha-desc');
    });
});

describe('getEffectiveSortOption', () => {
    it('returns a property-specific sort override for selected property nodes', () => {
        const propertyNodeId = buildPropertyKeyNodeId('status');
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.defaultFolderSort = 'modified-desc';
        settings.propertySortOverrides = {
            [propertyNodeId]: 'title-asc'
        };

        const effective = getEffectiveSortOption(settings, ItemType.PROPERTY, null, null, propertyNodeId);
        expect(effective).toBe('title-asc');
    });

    it('returns default sort when property selection has no override', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.defaultFolderSort = 'created-asc';
        settings.propertySortOverrides = {};

        const effective = getEffectiveSortOption(settings, ItemType.PROPERTY, null, null, buildPropertyKeyNodeId('status'));
        expect(effective).toBe('created-asc');
    });

    it('supports a custom sort override on the properties root selection', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.defaultFolderSort = 'modified-desc';
        settings.propertySortOverrides = {
            [PROPERTIES_ROOT_VIRTUAL_FOLDER_ID]: 'filename-asc'
        };

        const effective = getEffectiveSortOption(settings, ItemType.PROPERTY, null, null, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID);
        expect(effective).toBe('filename-asc');
    });
});
