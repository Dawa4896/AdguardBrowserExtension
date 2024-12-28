/**
 * @file
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdGuard Browser Extension. If not, see <http://www.gnu.org/licenses/>.
 */

import React, { useEffect, useRef } from 'react';

import cn from 'classnames';

type TabParams = {
    /**
     * Tab id.
     */
    id: string,

    /**
     * Tab index.
     */
    index: number;

    /**
     * Tab title.
     */
    title: string,

    /**
     * Whether the tab is active.
     */
    active: boolean,

    /**
     * Panel id.
     */
    panelId: string,

    /**
     * Whether the tab should focus.
     * Used to focus the tab when it becomes active.
     */
    shouldFocus: boolean,

    /**
     * Click handler.
     */
    onClick: () => void,

    /**
     * Keyboard navigation handler.
     *
     * @param toIndex - Index of the tab to navigate to (`-1` for the last tab, `length` for the first tab).
     */
    onKeyNavigate: (toIndex: number) => void,
};

export const Tab = ({
    id,
    index,
    title,
    active,
    panelId,
    shouldFocus,
    onClick,
    onKeyNavigate,
}: TabParams) => {
    const ref = useRef<HTMLButtonElement>(null);
    const tabClass = cn('tabs__tab', { 'tabs__tab--active': active });

    const focus = () => {
        if (ref.current) {
            ref.current.focus();
        }
    };

    const activateTab = () => {
        onClick();
        focus();
    };

    const handleFocus = () => {
        if (!active) {
            activateTab();
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // only activate tab if it's the left button (mousedown gets triggered by all mouse buttons)
        // but not when the control key is pressed (avoiding MacOS right click)
        if (e.button === 0 && e.ctrlKey === false) {
            activateTab();
        } else {
            // prevent focus to avoid accidental activation
            e.preventDefault();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        let stopPropagation = false;

        switch (e.key) {
            case 'ArrowLeft':
                onKeyNavigate(index - 1);
                stopPropagation = true;
                break;
            case 'ArrowRight':
                onKeyNavigate(index + 1);
                stopPropagation = true;
                break;
            case 'Home':
                onKeyNavigate(0);
                stopPropagation = true;
                break;
            case 'End':
                onKeyNavigate(-1);
                stopPropagation = true;
                break;
            case 'Enter':
            case ' ':
                activateTab();
                stopPropagation = true;
                break;
            default:
                break;
        }

        if (stopPropagation) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    useEffect(() => {
        if (shouldFocus && active) {
            focus();
        }
    }, [active, shouldFocus]);

    return (
        <button
            ref={ref}
            id={id}
            role="tab"
            type="button"
            className={tabClass}
            title={title}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onFocus={handleFocus}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
        >
            {title}
        </button>
    );
};
