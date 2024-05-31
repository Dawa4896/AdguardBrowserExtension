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

import { convertFiltersToRulesets } from './resources/build-rule-sets';
import { findDangerousRules } from './resources/dangerous-rules';
import { downloadFilters } from './resources/download-filters';
import { updateLocalScriptRules } from './resources/update-local-script-rules';

const resources = async () => {
    await downloadFilters();
    await updateLocalScriptRules();
    await findDangerousRules();

    // converting filters to rulesets should be done after all filters are downloaded
    await convertFiltersToRulesets();
};

(async () => {
    await resources();
})();
