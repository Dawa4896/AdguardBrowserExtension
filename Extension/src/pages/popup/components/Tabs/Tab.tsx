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

import React from 'react';

import cn from 'classnames';

type TabParams = {
    /**
     * Tab id.
     */
    id: string,

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
     * Click handler.
     */
    onClick: () => void,
};

export const Tab = ({
    id,
    title,
    active,
    panelId,
    onClick,
}: TabParams) => {
    const tabClass = cn('tabs__tab', { 'tabs__tab--active': active });

    return (
        <button
            id={id}
            role="tab"
            type="button"
            className={tabClass}
            onClick={onClick}
            title={title}
            aria-selected={active}
            aria-controls={panelId}
        >
            {title}
        </button>
    );
};
