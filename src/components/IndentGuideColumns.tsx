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

import React from 'react';
import type { CSSPropertiesWithVars } from '../types';

const indentGuideStyleCache = new Map<number, CSSPropertiesWithVars>();

function getIndentGuideStyle(level: number): CSSPropertiesWithVars {
    const cachedStyle = indentGuideStyleCache.get(level);
    if (cachedStyle) {
        return cachedStyle;
    }

    const style: CSSPropertiesWithVars = { '--nn-indent-guide-level': level };
    indentGuideStyleCache.set(level, style);
    return style;
}

export const IndentGuideColumns = React.memo(function IndentGuideColumns({ levels }: { levels?: readonly number[] }) {
    if (!levels || levels.length === 0) {
        return null;
    }

    return (
        <>
            {levels.map(level => (
                <span key={level} className="nn-navitem-indent-guide" style={getIndentGuideStyle(level)} aria-hidden="true" />
            ))}
        </>
    );
});
