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

// src/context/ServicesContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { App, Platform } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { FileSystemOperations } from '../services/FileSystemService';
import { MetadataService } from '../services/MetadataService';
import { PropertyOperations } from '../services/PropertyOperations';
import { TagOperations } from '../services/TagOperations';
import { TagTreeService } from '../services/TagTreeService';
import { PropertyTreeService } from '../services/PropertyTreeService';
import { CommandQueueService } from '../services/CommandQueueService';
import { OmnisearchService } from '../services/OmnisearchService';
import ReleaseCheckService from '../services/ReleaseCheckService';

/**
 * Interface defining all services and stable dependencies available through the context.
 * Services provide business logic separated from UI components.
 */
interface Services {
    /** The Obsidian App instance */
    app: App;
    /** The plugin instance */
    plugin: NotebookNavigatorPlugin;
    /** Whether the app is running on a mobile device */
    isMobile: boolean;
    /** File system operations service for creating, renaming, and deleting files/folders */
    fileSystemOps: FileSystemOperations;
    /** Metadata service for managing folder colors, icons, sorts, and pinned notes */
    metadataService: MetadataService | null;
    /** Tag operations service for renaming and deleting tags */
    tagOperations: TagOperations | null;
    /** Property operations service for renaming and deleting property keys */
    propertyOperations: PropertyOperations | null;
    /** Tag tree service for accessing the current tag tree */
    tagTreeService: TagTreeService | null;
    /** Property tree service for accessing the current property tree */
    propertyTreeService: PropertyTreeService | null;
    /** Command queue service for managing operations and their context */
    commandQueue: CommandQueueService | null;
    /** Omnisearch integration service */
    omnisearchService: OmnisearchService | null;
    /** Release check service for GitHub update notifications */
    releaseCheckService: ReleaseCheckService | null;
}

/**
 * React context for dependency injection of services.
 * Provides a centralized way to access business logic throughout the app.
 */
const ServicesContext = createContext<Services | null>(null);

/**
 * Provider component that instantiates and provides services to child components.
 * Services are memoized to ensure singleton behavior.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to services
 * @param props.plugin - The plugin instance providing app and metadata service
 */
export function ServicesProvider({ children, plugin }: { children: React.ReactNode; plugin: NotebookNavigatorPlugin }) {
    const isMobile = Platform.isMobile;

    /**
     * Use the single MetadataService instance from the plugin
     * This ensures consistency between vault event handlers and UI
     */
    // Create services object with all plugin services
    const services = useMemo<Services>(() => {
        // Get FileSystemOperations instance from plugin
        const fileSystemOps = plugin.fileSystemOps;
        if (!fileSystemOps) {
            throw new Error('FileSystemOperations not initialized');
        }

        // Return services object with all required service instances
        return {
            app: plugin.app,
            plugin,
            isMobile,
            fileSystemOps,
            metadataService: plugin.metadataService,
            tagOperations: plugin.tagOperations,
            propertyOperations: plugin.propertyOperations,
            tagTreeService: plugin.tagTreeService,
            propertyTreeService: plugin.propertyTreeService,
            commandQueue: plugin.commandQueue,
            omnisearchService: plugin.omnisearchService,
            releaseCheckService: plugin.releaseCheckService
        };
    }, [plugin, isMobile]);

    return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/**
 * Hook to access all services.
 * Must be used within a ServicesProvider.
 *
 * @returns Object containing all available services
 * @throws If used outside of ServicesProvider
 */
export function useServices() {
    const services = useContext(ServicesContext);
    if (!services) {
        throw new Error('useServices must be used within a ServicesProvider');
    }
    return services;
}

/**
 * Convenience hook to access the FileSystemOperations service directly.
 * Use this when you only need file system operations.
 *
 * @returns The FileSystemOperations service instance
 */
export function useFileSystemOps() {
    const { fileSystemOps } = useServices();
    return fileSystemOps;
}

/**
 * Convenience hook to access the MetadataService directly.
 * Use this when you need to manage folder colors, icons, sorts, or pinned notes.
 *
 * @returns The MetadataService instance
 */
export function useMetadataService() {
    const { metadataService } = useServices();
    if (!metadataService) {
        throw new Error('MetadataService not initialized');
    }
    return metadataService;
}

/**
 * Convenience hook to access the TagOperations service directly.
 * Use this when you need to rename or delete tags.
 *
 * @returns The TagOperations service instance
 */
export function useTagOperations() {
    const { tagOperations } = useServices();
    if (!tagOperations) {
        throw new Error('TagOperations not initialized');
    }
    return tagOperations;
}

export function usePropertyOperations() {
    const { propertyOperations } = useServices();
    if (!propertyOperations) {
        throw new Error('PropertyOperations not initialized');
    }
    return propertyOperations;
}

/**
 * Convenience hook to access the CommandQueue service directly.
 * Use this when you need to execute operations with proper context tracking.
 *
 * @returns The CommandQueue service instance
 */
export function useCommandQueue() {
    const { commandQueue } = useServices();
    if (!commandQueue) {
        throw new Error('CommandQueue not initialized');
    }
    return commandQueue;
}
