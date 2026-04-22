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

import { useEffect, useRef } from 'react';
import { setIcon } from 'obsidian';

interface ObsidianIconProps {
    name: string;
    className?: string;
    'aria-label'?: string;
    'aria-hidden'?: boolean;
}

/**
 * A React component that properly wraps Obsidian's setIcon API.
 * This component ensures that DOM manipulation happens in useEffect,
 * following React best practices.
 *
 * @param props - The component props
 * @param props.name - The name of the Obsidian icon to display
 * @param props.className - Optional CSS class name
 * @param props['aria-label'] - Optional aria-label for accessibility
 * @param props['aria-hidden'] - Optional aria-hidden flag for decorative icons
 * @returns A span element that will contain the icon
 */
export function ObsidianIcon({ name, className, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden }: ObsidianIconProps) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (ref.current) {
            // Clear any existing content first
            ref.current.empty();
            // Set the icon using Obsidian's API
            setIcon(ref.current, name);
        }
    }, [name]);

    return <span ref={ref} className={className} aria-label={ariaLabel} aria-hidden={ariaHidden} />;
}
