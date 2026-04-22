/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type NamedDeclaration =
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration
    | ts.ClassDeclaration
    | ts.MethodDeclaration
    | ts.PropertyDeclaration
    | ts.MethodSignature
    | ts.PropertySignature;

function hasExportModifier(node: NamedDeclaration): boolean {
    return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasPrivateOrProtectedModifier(node: ts.MethodDeclaration | ts.PropertyDeclaration): boolean {
    return (
        node.modifiers?.some(
            modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword
        ) ?? false
    );
}

function getNameText(name: ts.PropertyName | undefined): string | null {
    if (!name) {
        return null;
    }
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
    }
    return null;
}

function readSourceFile(relativePath: string): ts.SourceFile {
    const filePath = path.resolve(process.cwd(), relativePath);
    const content = readFileSync(filePath, 'utf8');
    return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
}

function getExportedTypeNames(sourceFile: ts.SourceFile): Set<string> {
    const names = new Set<string>();

    for (const statement of sourceFile.statements) {
        if (!hasExportModifier(statement as NamedDeclaration)) {
            continue;
        }

        if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
            names.add(statement.name.text);
        }
    }

    return names;
}

function getInterfaceMemberNames(sourceFile: ts.SourceFile, interfaceName: string): Set<string> {
    const names = new Set<string>();

    for (const statement of sourceFile.statements) {
        if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== interfaceName) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isMethodSignature(member) && !ts.isPropertySignature(member)) {
                continue;
            }

            const name = getNameText(member.name);
            if (name) {
                names.add(name);
            }
        }
    }

    return names;
}

function getClassPublicInstanceMemberNames(sourceFile: ts.SourceFile, className: string): Set<string> {
    const names = new Set<string>();

    for (const statement of sourceFile.statements) {
        if (!ts.isClassDeclaration(statement) || statement.name?.text !== className || !hasExportModifier(statement)) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isMethodDeclaration(member) && !ts.isPropertyDeclaration(member)) {
                continue;
            }

            if (hasPrivateOrProtectedModifier(member)) {
                continue;
            }

            const name = getNameText(member.name);
            if (name) {
                names.add(name);
            }
        }
    }

    return names;
}

function getPropertyTypeNodeFromClass(sourceFile: ts.SourceFile, className: string, propertyName: string): ts.TypeNode | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isClassDeclaration(statement) || statement.name?.text !== className || !hasExportModifier(statement)) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isPropertyDeclaration(member) || hasPrivateOrProtectedModifier(member)) {
                continue;
            }

            const name = getNameText(member.name);
            if (name === propertyName) {
                return member.type ?? null;
            }
        }
    }

    return null;
}

function getPropertyTypeNodeFromInterface(sourceFile: ts.SourceFile, interfaceName: string, propertyName: string): ts.TypeNode | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== interfaceName) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isPropertySignature(member)) {
                continue;
            }

            const name = getNameText(member.name);
            if (name === propertyName) {
                return member.type ?? null;
            }
        }
    }

    return null;
}

function collectPickLiteralNames(typeNode: ts.TypeNode, names: Set<string>): void {
    if (!ts.isTypeReferenceNode(typeNode) || typeNode.typeName.getText() !== 'Pick') {
        return;
    }

    const [, pickedKeys] = typeNode.typeArguments ?? [];
    if (!pickedKeys) {
        return;
    }

    collectUnionStringLiteralNames(pickedKeys, names);
}

function collectUnionStringLiteralNames(typeNode: ts.TypeNode, names: Set<string>): void {
    if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
        names.add(typeNode.literal.text);
        return;
    }

    if (ts.isUnionTypeNode(typeNode)) {
        for (const child of typeNode.types) {
            collectUnionStringLiteralNames(child, names);
        }
    }
}

function getTypeLiteralMemberNames(typeNode: ts.TypeNode, names: Set<string>): void {
    if (!ts.isTypeLiteralNode(typeNode)) {
        return;
    }

    for (const member of typeNode.members) {
        if (!ts.isMethodSignature(member) && !ts.isPropertySignature(member)) {
            continue;
        }

        const name = getNameText(member.name);
        if (name) {
            names.add(name);
        }
    }
}

function getNestedMemberNamesFromTypeNode(typeNode: ts.TypeNode | null): Set<string> {
    const names = new Set<string>();
    if (!typeNode) {
        return names;
    }

    collectPickLiteralNames(typeNode, names);
    getTypeLiteralMemberNames(typeNode, names);

    return names;
}

function normalizeTypeText(typeNode: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string {
    return (typeNode?.getText(sourceFile) ?? '').replace(/\s+/g, ' ').trim();
}

type SerializedParameter = {
    isOptional: boolean;
    isRest: boolean;
    type: string;
};

type SerializedMethodSignature = {
    parameters: SerializedParameter[];
    returnType: string;
};

type SerializedPropertySignature = {
    isOptional: boolean;
    isReadonly: boolean;
    type: string;
};

function hasReadonlyModifier(node: ts.PropertySignature | ts.PropertyDeclaration): boolean {
    return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;
}

function serializeParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): SerializedParameter[] {
    return parameters.map(parameter => ({
        isOptional: Boolean(parameter.questionToken),
        isRest: Boolean(parameter.dotDotDotToken),
        type: normalizeTypeText(parameter.type, sourceFile)
    }));
}

function serializeMethodDeclaration(
    declaration: ts.MethodDeclaration | ts.MethodSignature,
    sourceFile: ts.SourceFile
): SerializedMethodSignature {
    return {
        parameters: serializeParameters(declaration.parameters, sourceFile),
        returnType: normalizeTypeText(declaration.type, sourceFile)
    };
}

function getClassMethodSignature(sourceFile: ts.SourceFile, className: string, methodName: string): SerializedMethodSignature | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isClassDeclaration(statement) || statement.name?.text !== className || !hasExportModifier(statement)) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isMethodDeclaration(member) || hasPrivateOrProtectedModifier(member)) {
                continue;
            }

            if (getNameText(member.name) === methodName) {
                return serializeMethodDeclaration(member, sourceFile);
            }
        }
    }

    return null;
}

function getTypeLiteralMethodSignature(
    typeNode: ts.TypeNode | null,
    methodName: string,
    sourceFile: ts.SourceFile
): SerializedMethodSignature | null {
    if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
        return null;
    }

    for (const member of typeNode.members) {
        if (!ts.isMethodSignature(member)) {
            continue;
        }

        if (getNameText(member.name) === methodName) {
            return serializeMethodDeclaration(member, sourceFile);
        }
    }

    return null;
}

function getTypeLiteralCallableSignature(
    typeNode: ts.TypeNode | null,
    memberName: string,
    sourceFile: ts.SourceFile
): SerializedMethodSignature | null {
    if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
        return null;
    }

    for (const member of typeNode.members) {
        const name = getNameText(member.name);
        if (name !== memberName) {
            continue;
        }

        if (ts.isMethodSignature(member)) {
            return serializeMethodDeclaration(member, sourceFile);
        }

        if (ts.isPropertySignature(member) && member.type && ts.isFunctionTypeNode(member.type)) {
            return {
                parameters: serializeParameters(member.type.parameters, sourceFile),
                returnType: normalizeTypeText(member.type.type, sourceFile)
            };
        }
    }

    return null;
}

function getTypeLiteralPropertySignature(
    typeNode: ts.TypeNode | null,
    propertyName: string,
    sourceFile: ts.SourceFile
): SerializedPropertySignature | null {
    if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
        return null;
    }

    for (const member of typeNode.members) {
        if (!ts.isPropertySignature(member)) {
            continue;
        }

        if (getNameText(member.name) === propertyName) {
            return {
                isOptional: Boolean(member.questionToken),
                isReadonly: hasReadonlyModifier(member),
                type: normalizeTypeText(member.type, sourceFile)
            };
        }
    }

    return null;
}

function getInterfacePropertySignature(
    sourceFile: ts.SourceFile,
    interfaceName: string,
    propertyName: string
): SerializedPropertySignature | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== interfaceName) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isPropertySignature(member)) {
                continue;
            }

            if (getNameText(member.name) === propertyName) {
                return {
                    isOptional: Boolean(member.questionToken),
                    isReadonly: hasReadonlyModifier(member),
                    type: normalizeTypeText(member.type, sourceFile)
                };
            }
        }
    }

    return null;
}

function getInterfaceMethodSignature(
    sourceFile: ts.SourceFile,
    interfaceName: string,
    methodName: string
): SerializedMethodSignature | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== interfaceName) {
            continue;
        }

        for (const member of statement.members) {
            if (!ts.isMethodSignature(member)) {
                continue;
            }

            if (getNameText(member.name) === methodName) {
                return serializeMethodDeclaration(member, sourceFile);
            }
        }
    }

    return null;
}

function getTypeAliasText(sourceFile: ts.SourceFile, typeName: string): string | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isTypeAliasDeclaration(statement) || !hasExportModifier(statement) || statement.name.text !== typeName) {
            continue;
        }

        return normalizeTypeText(statement.type, sourceFile);
    }

    return null;
}

describe('public API declaration file', () => {
    it('includes exported public API type names from source', () => {
        const sourceTypes = getExportedTypeNames(readSourceFile('src/api/types.ts'));
        const menuTypes = getExportedTypeNames(readSourceFile('src/api/modules/MenusAPI.ts'));
        const publicTypes = getExportedTypeNames(readSourceFile('src/api/public/notebook-navigator.d.ts'));

        const expectedExports = new Set<string>(sourceTypes);
        expectedExports.add('MenuExtensionDispose');

        const missingExports = Array.from(expectedExports)
            .filter(name => !publicTypes.has(name))
            .sort();

        expect(missingExports).toEqual([]);
        expect(menuTypes.has('MenuExtensionDispose')).toBe(true);
    });

    it('matches the top-level public NotebookNavigatorAPI member names', () => {
        const sourceMembers = getClassPublicInstanceMemberNames(readSourceFile('src/api/NotebookNavigatorAPI.ts'), 'NotebookNavigatorAPI');
        const publicMembers = getInterfaceMemberNames(readSourceFile('src/api/public/notebook-navigator.d.ts'), 'NotebookNavigatorAPI');

        expect(Array.from(publicMembers).sort()).toEqual(Array.from(sourceMembers).sort());
    });

    it('matches top-level public NotebookNavigatorAPI method signatures', () => {
        const sourceFile = readSourceFile('src/api/NotebookNavigatorAPI.ts');
        const publicFile = readSourceFile('src/api/public/notebook-navigator.d.ts');

        for (const methodName of ['getVersion', 'isStorageReady', 'whenReady', 'on', 'once', 'off']) {
            expect(getInterfaceMethodSignature(publicFile, 'NotebookNavigatorAPI', methodName)).toEqual(
                getClassMethodSignature(sourceFile, 'NotebookNavigatorAPI', methodName)
            );
        }
    });

    it('matches nested public NotebookNavigatorAPI namespace member names', () => {
        const sourceFile = readSourceFile('src/api/NotebookNavigatorAPI.ts');
        const publicFile = readSourceFile('src/api/public/notebook-navigator.d.ts');
        const namespaceNames = ['navigation', 'metadata', 'selection', 'menus', 'tagCollections', 'propertyNodes'];

        for (const namespaceName of namespaceNames) {
            const sourceMembers = getNestedMemberNamesFromTypeNode(
                getPropertyTypeNodeFromClass(sourceFile, 'NotebookNavigatorAPI', namespaceName)
            );
            const publicMembers = getNestedMemberNamesFromTypeNode(
                getPropertyTypeNodeFromInterface(publicFile, 'NotebookNavigatorAPI', namespaceName)
            );

            expect(Array.from(publicMembers).sort()).toEqual(Array.from(sourceMembers).sort());
        }
    });

    it('matches public NotebookNavigatorEvents event names', () => {
        const sourceMembers = getInterfaceMemberNames(readSourceFile('src/api/types.ts'), 'NotebookNavigatorEvents');
        const publicMembers = getInterfaceMemberNames(readSourceFile('src/api/public/notebook-navigator.d.ts'), 'NotebookNavigatorEvents');

        expect(Array.from(publicMembers).sort()).toEqual(Array.from(sourceMembers).sort());
    });

    it('matches critical nested public method signatures', () => {
        const publicFile = readSourceFile('src/api/public/notebook-navigator.d.ts');
        const apiFile = readSourceFile('src/api/NotebookNavigatorAPI.ts');
        const navigationFile = readSourceFile('src/api/modules/NavigationAPI.ts');
        const metadataFile = readSourceFile('src/api/modules/MetadataAPI.ts');
        const selectionFile = readSourceFile('src/api/modules/SelectionAPI.ts');
        const propertyNodesFile = readSourceFile('src/api/modules/PropertyNodesAPI.ts');

        const checks = [
            {
                namespace: 'navigation',
                sourceFile: navigationFile,
                sourceClass: 'NavigationAPI',
                methodName: 'reveal'
            },
            {
                namespace: 'navigation',
                sourceFile: navigationFile,
                sourceClass: 'NavigationAPI',
                methodName: 'navigateToFolder'
            },
            {
                namespace: 'navigation',
                sourceFile: navigationFile,
                sourceClass: 'NavigationAPI',
                methodName: 'navigateToTag'
            },
            {
                namespace: 'navigation',
                sourceFile: navigationFile,
                sourceClass: 'NavigationAPI',
                methodName: 'navigateToProperty'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'getFolderMeta'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'setFolderMeta'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'getTagMeta'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'setTagMeta'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'getPropertyMeta'
            },
            {
                namespace: 'metadata',
                sourceFile: metadataFile,
                sourceClass: 'MetadataAPI',
                methodName: 'setPropertyMeta'
            },
            {
                namespace: 'selection',
                sourceFile: selectionFile,
                sourceClass: 'SelectionAPI',
                methodName: 'getNavItem'
            },
            {
                namespace: 'selection',
                sourceFile: selectionFile,
                sourceClass: 'SelectionAPI',
                methodName: 'getCurrent'
            },
            {
                namespace: 'propertyNodes',
                sourceFile: propertyNodesFile,
                sourceClass: 'PropertyNodesAPI',
                methodName: 'buildKey'
            },
            {
                namespace: 'propertyNodes',
                sourceFile: propertyNodesFile,
                sourceClass: 'PropertyNodesAPI',
                methodName: 'buildValue'
            },
            {
                namespace: 'propertyNodes',
                sourceFile: propertyNodesFile,
                sourceClass: 'PropertyNodesAPI',
                methodName: 'parse'
            },
            {
                namespace: 'propertyNodes',
                sourceFile: propertyNodesFile,
                sourceClass: 'PropertyNodesAPI',
                methodName: 'normalize'
            }
        ];

        for (const check of checks) {
            const publicNamespaceType = getPropertyTypeNodeFromInterface(publicFile, 'NotebookNavigatorAPI', check.namespace);
            const publicSignature = getTypeLiteralMethodSignature(publicNamespaceType, check.methodName, publicFile);
            const sourceSignature = getClassMethodSignature(check.sourceFile, check.sourceClass, check.methodName);

            expect(publicSignature).toEqual(sourceSignature);
        }

        const tagCollectionsType = getPropertyTypeNodeFromClass(apiFile, 'NotebookNavigatorAPI', 'tagCollections');
        const publicTagCollectionsType = getPropertyTypeNodeFromInterface(publicFile, 'NotebookNavigatorAPI', 'tagCollections');

        expect(getTypeLiteralCallableSignature(publicTagCollectionsType, 'isCollection', publicFile)).toEqual(
            getTypeLiteralCallableSignature(tagCollectionsType, 'isCollection', apiFile)
        );
        expect(getTypeLiteralCallableSignature(publicTagCollectionsType, 'getLabel', publicFile)).toEqual(
            getTypeLiteralCallableSignature(tagCollectionsType, 'getLabel', apiFile)
        );
        expect(getTypeLiteralPropertySignature(publicTagCollectionsType, 'taggedId', publicFile)).toEqual(
            getTypeLiteralPropertySignature(tagCollectionsType, 'taggedId', apiFile)
        );
        expect(getTypeLiteralPropertySignature(publicTagCollectionsType, 'untaggedId', publicFile)).toEqual(
            getTypeLiteralPropertySignature(tagCollectionsType, 'untaggedId', apiFile)
        );
    });

    it('matches critical public type and event payload shapes', () => {
        const sourceFile = readSourceFile('src/api/types.ts');
        const publicFile = readSourceFile('src/api/public/notebook-navigator.d.ts');

        for (const typeName of ['NavItem', 'NavItemType', 'TagCollectionId', 'PropertyNodeParts']) {
            expect(getTypeAliasText(publicFile, typeName)).toEqual(getTypeAliasText(sourceFile, typeName));
        }

        const interfacePropertyChecks = [
            { interfaceName: 'FolderMetadataUpdate', propertyName: 'color' },
            { interfaceName: 'FolderMetadataUpdate', propertyName: 'backgroundColor' },
            { interfaceName: 'FolderMetadataUpdate', propertyName: 'icon' },
            { interfaceName: 'TagMetadataUpdate', propertyName: 'color' },
            { interfaceName: 'TagMetadataUpdate', propertyName: 'backgroundColor' },
            { interfaceName: 'TagMetadataUpdate', propertyName: 'icon' },
            { interfaceName: 'PropertyMetadataUpdate', propertyName: 'color' },
            { interfaceName: 'PropertyMetadataUpdate', propertyName: 'backgroundColor' },
            { interfaceName: 'PropertyMetadataUpdate', propertyName: 'icon' },
            { interfaceName: 'SelectionState', propertyName: 'files' },
            { interfaceName: 'SelectionState', propertyName: 'focused' },
            { interfaceName: 'NotebookNavigatorEvents', propertyName: 'nav-item-changed' },
            { interfaceName: 'NotebookNavigatorEvents', propertyName: 'selection-changed' },
            { interfaceName: 'NotebookNavigatorEvents', propertyName: 'folder-changed' },
            { interfaceName: 'NotebookNavigatorEvents', propertyName: 'tag-changed' },
            { interfaceName: 'NotebookNavigatorEvents', propertyName: 'property-changed' }
        ];

        for (const check of interfacePropertyChecks) {
            expect(getInterfacePropertySignature(publicFile, check.interfaceName, check.propertyName)).toEqual(
                getInterfacePropertySignature(sourceFile, check.interfaceName, check.propertyName)
            );
        }
    });
});
