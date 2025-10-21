import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { getIconService, useIconServiceVersion } from '../services/icons';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { ObsidianIcon } from './ObsidianIcon';
import { setIcon } from 'obsidian';

/**
 * Configuration for the drag handle element that appears in reorderable rows
 */
export interface DragHandleConfig {
    label: string; // Accessibility label for the drag handle
    only?: boolean; // If true, only the handle is draggable, not the entire row
    disabled?: boolean; // Disables drag functionality
    visible?: boolean; // Controls visibility of the drag handle
    icon?: string; // Custom icon for the drag handle
}

/**
 * Props for a navigation list row component that supports icons, counts, actions, and drag-and-drop reordering
 */
interface NavigationListRowProps {
    icon: string;
    color?: string;
    label: string;
    description?: string;
    level: number;
    itemType: string;
    role?: 'treeitem' | 'listitem';
    tabIndex?: number;
    ariaDisabled?: boolean;
    ariaGrabbed?: boolean;
    isDisabled?: boolean;
    isExcluded?: boolean;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    dragHandlers?: ListReorderHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
    showCount?: boolean;
    count?: number | string;
    actions?: React.ReactNode;
    dragHandleConfig?: DragHandleConfig;
    className?: string;
    chevronIcon?: string;
    labelClassName?: string;
    onLabelClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Renders a navigation list row with support for icons, counts, actions, and drag-and-drop reordering.
 * Used for displaying items in navigation panes like shortcuts, tags, and folders.
 */
export function NavigationListRow({
    icon,
    color,
    label,
    level,
    itemType,
    description,
    isDisabled,
    isExcluded,
    onClick,
    onMouseDown,
    onContextMenu,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource,
    showCount,
    count,
    actions,
    dragHandleConfig,
    className,
    chevronIcon,
    role = 'treeitem',
    tabIndex,
    ariaDisabled,
    ariaGrabbed,
    labelClassName,
    onLabelClick
}: NavigationListRowProps) {
    const settings = useSettingsState();
    const chevronRef = useRef<HTMLSpanElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    // Determine whether to apply color to the label text instead of the icon
    const applyColorToLabel = Boolean(color) && !settings.colorIconOnly;

    // Compute CSS style for label with color when colorIconOnly is disabled
    const labelStyle = useMemo(() => {
        return applyColorToLabel && color ? { color } : undefined;
    }, [applyColorToLabel, color]);

    // Builds CSS class names based on component state (disabled, excluded, dragging, etc.)
    const classes = useMemo(() => {
        const classList = ['nn-navitem', 'nn-drag-item'];
        if (className) {
            classList.push(className);
        }
        if (isDisabled) {
            classList.push('nn-shortcut-disabled');
        }
        if (isExcluded) {
            classList.push('nn-shortcut-excluded');
        }
        if (isDragSource) {
            classList.push('nn-shortcut-drag-source');
        }
        if (dragHandleConfig?.visible) {
            classList.push('nn-drag-item-has-handle');
        }
        return classList.join(' ');
    }, [className, dragHandleConfig?.visible, isDisabled, isDragSource, isExcluded]);

    // Builds CSS classes for the label element, combining base class with optional custom class
    const labelClasses = useMemo(() => {
        const classList = ['nn-navitem-name'];
        if (labelClassName) {
            classList.push(labelClassName);
        }
        if (applyColorToLabel && color) {
            classList.push('nn-has-custom-color');
        }
        return classList.join(' ');
    }, [applyColorToLabel, color, labelClassName]);

    // Renders chevron icon when provided, clearing it for rows without chevrons
    useEffect(() => {
        if (!chevronRef.current) {
            return;
        }

        if (!chevronIcon) {
            chevronRef.current.empty();
            return;
        }

        chevronRef.current.empty();
        setIcon(chevronRef.current, chevronIcon);
    }, [chevronIcon]);

    // Renders icon using Obsidian's icon service, clearing it if icons are disabled in settings
    useEffect(() => {
        if (!iconRef.current) {
            return;
        }

        if (!settings.showIcons) {
            iconRef.current.textContent = '';
            return;
        }

        const iconService = getIconService();
        iconService.renderIcon(iconRef.current, icon);
    }, [icon, iconVersion, settings.showIcons]);

    // Determines drag and drop behavior based on handlers and configuration
    // Supports both full-row dragging and handle-only dragging modes
    const draggable = dragHandlers?.draggable ?? false;
    const handleVisible = Boolean(dragHandleConfig?.visible);
    const handleOnly = dragHandleConfig?.only === true;
    const handleDisabled = dragHandleConfig?.disabled === true;
    const handleInteractive = handleVisible && draggable && !handleDisabled;
    const rowDraggable = draggable && !handleOnly;
    // Check if count has a valid value - supports both numeric counts and string labels
    const hasCountValue = typeof count === 'number' ? count > 0 : typeof count === 'string' ? count.length > 0 : false;
    // Determine if count badge should be displayed based on settings and valid count value
    const shouldShowCount = Boolean(showCount && hasCountValue);

    // Handles drag start event for the drag handle - sets custom drag image from parent row
    // This ensures the entire row appears as the drag image, not just the handle
    const handleDragStart =
        handleInteractive && dragHandlers?.onDragStart
            ? (event: DragEvent<HTMLElement>) => {
                  const parentRow = event.currentTarget.closest('.nn-drag-item');
                  if (parentRow instanceof HTMLElement) {
                      try {
                          const rect = parentRow.getBoundingClientRect();
                          const offsetX = event.clientX - rect.left;
                          const offsetY = event.clientY - rect.top;
                          event.dataTransfer.setDragImage(parentRow, offsetX, offsetY);
                      } catch {
                          // Ignore platforms that do not support custom drag images
                      }
                  }
                  dragHandlers.onDragStart(event);
              }
            : undefined;

    const handleDragEnd = handleInteractive ? dragHandlers?.onDragEnd : undefined;

    // Handles click events on the label element, preventing event propagation to parent row
    const handleLabelClick = useCallback(
        (event: React.MouseEvent<HTMLSpanElement>) => {
            if (!onLabelClick) {
                return;
            }
            event.stopPropagation();
            onLabelClick(event);
        },
        [onLabelClick]
    );

    return (
        <div
            className={classes}
            role={role}
            tabIndex={tabIndex}
            aria-disabled={ariaDisabled || undefined}
            aria-grabbed={ariaGrabbed ? true : undefined}
            data-nav-item-type={itemType}
            data-nav-item-disabled={isDisabled ? 'true' : undefined}
            data-nav-item-excluded={isExcluded ? 'true' : undefined}
            data-nav-item-level={level}
            data-level={level}
            data-reorder-draggable={rowDraggable ? 'true' : undefined}
            data-reorder-drop-before={showDropIndicatorBefore ? 'true' : undefined}
            data-reorder-drop-after={showDropIndicatorAfter ? 'true' : undefined}
            aria-level={level + 1}
            draggable={rowDraggable}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
            onDragStart={rowDraggable ? dragHandlers?.onDragStart : undefined}
            onDragOver={dragHandlers?.onDragOver}
            onDragLeave={dragHandlers?.onDragLeave}
            onDrop={dragHandlers?.onDrop}
            onDragEnd={rowDraggable ? dragHandlers?.onDragEnd : undefined}
            style={{ '--level': level } as CSSProperties}
        >
            <div className="nn-navitem-content">
                <span
                    ref={chevronRef}
                    className={`nn-navitem-chevron${chevronIcon ? '' : ' nn-navitem-chevron--no-children'}`}
                    aria-hidden="true"
                />
                {settings.showIcons ? (
                    <span
                        ref={iconRef}
                        className="nn-navitem-icon"
                        aria-hidden="true"
                        data-has-color={color ? 'true' : 'false'}
                        style={color ? { color } : undefined}
                    />
                ) : null}
                <span className={labelClasses} onClick={onLabelClick ? handleLabelClick : undefined}>
                    <span className="nn-shortcut-label" data-has-color={applyColorToLabel ? 'true' : undefined} style={labelStyle}>
                        {label}
                    </span>
                    {description ? <span className="nn-shortcut-description">{description}</span> : null}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldShowCount ? <span className="nn-navitem-count">{count}</span> : null}
                {actions ? <div className="nn-shortcut-actions">{actions}</div> : null}
                {handleVisible ? (
                    <span
                        className={`nn-drag-handle${handleInteractive ? '' : ' nn-drag-handle-disabled'}${
                            isDragSource ? ' nn-drag-handle-active' : ''
                        }`}
                        role="button"
                        tabIndex={-1}
                        aria-label={dragHandleConfig?.label}
                        data-reorder-handle-draggable={handleInteractive ? 'true' : undefined}
                        draggable={handleInteractive}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <ObsidianIcon name={dragHandleConfig?.icon ?? 'lucide-grip-horizontal'} />
                    </span>
                ) : null}
            </div>
        </div>
    );
}
