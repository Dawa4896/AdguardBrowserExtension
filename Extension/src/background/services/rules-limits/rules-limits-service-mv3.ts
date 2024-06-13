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

import browser from 'webextension-polyfill';
import { isEqual } from 'lodash-es';

import {
    TooManyRegexpRulesError,
    TooManyRulesError,
    RULE_SET_NAME_PREFIX,
    type LimitationError,
    type ConfigurationResult,
} from '@adguard/tswebextension/mv3';

import { MessageType } from '../../../common/messages';
import { FilterMetadata, FiltersApi } from '../../api';
import { CUSTOM_FILTERS_START_ID } from '../../../common/constants';
import { filterStateStorage } from '../../storages';
import { rulesLimitsStorage } from '../../storages/rules-limits';
import { rulesLimitsStorageDataValidator } from '../../schema/rules-limits';
import { logger } from '../../../common/logger';
// Note: due to circular dependencies, import message-handler.ts after all
// other imports.
import { messageHandler } from '../../message-handler';

import { type IRulesLimits } from './interface';

const {
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES,
    MAX_NUMBER_OF_REGEX_RULES,
    MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
} = browser.declarativeNetRequest;

/**
 * RuleSetCounter interface.
 */
interface RuleSetCounter {
    filterId: number;
    rulesCount: number;
    regexpRulesCount: number;
}

/**
 * Map of ruleset counters.
 */
interface RuleSetCountersMap {
    [key: number]: RuleSetCounter;
}

/**
 * Service to work with configuration result.
 */
export class RulesLimitsService {
    configurationResult: ConfigurationResult | null = null;

    /**
     * Initialize the service.
     */
    init(): void {
        // Subscribe to messages from the options' page
        messageHandler.addListener(MessageType.GetRulesLimits, this.onGetRulesLimits.bind(this));
        messageHandler.addListener(
            MessageType.ClearRulesLimitsWarning,
            RulesLimitsService.cleanExpectedEnabledFilters,
        );
    }

    /**
     * Get the number of enabled static filters.
     *
     * @returns The number of enabled static filters.
     */
    static getStaticEnabledFiltersCount(): number {
        return FiltersApi.getEnabledFiltersWithMetadata()
            .filter(f => f.groupId <= CUSTOM_FILTERS_START_ID).length;
    }

    /**
     * Returns a map of ruleset counters.
     *
     * @param result Configuration result.
     * @returns A map of ruleset counters.
     */
    static getRuleSetsCountersMap = (result: ConfigurationResult): RuleSetCountersMap => {
        return result.staticFilters
            .reduce((acc: { [key: number]: RuleSetCounter }, ruleset) => {
                const filterId = Number(ruleset.getId()
                    .slice(RULE_SET_NAME_PREFIX.length));

                acc[filterId] = {
                    filterId,
                    rulesCount: ruleset.getRulesCount(),
                    regexpRulesCount: ruleset.getRegexpRulesCount(),
                };

                return acc;
            }, {});
    };

    /**
     * Returns an array of ruleset counters.
     *
     * @param filters List of filters with metadata.
     * @param ruleSetsCounters A map of ruleset counters.
     * @returns An array of ruleset counters by filters ids.
     */
    static getRuleSetCounters = (filters: FilterMetadata[], ruleSetsCounters: RuleSetCountersMap): RuleSetCounter[] => {
        return filters
            .filter((f) => f.groupId < CUSTOM_FILTERS_START_ID)
            .map(filter => ruleSetsCounters[filter.filterId])
            .filter((ruleSet): ruleSet is RuleSetCounter => ruleSet !== undefined);
    };

    /**
     * Get the number of static rules enabled.
     *
     * @param result Configuration result.
     * @param filters Filters with metadata.
     * @returns The number of static rules enabled.
     */
    static getStaticRulesEnabledCount(result: ConfigurationResult, filters: FilterMetadata[]): number {
        const ruleSetsCounters = RulesLimitsService.getRuleSetsCountersMap(result);

        const ruleSets = RulesLimitsService.getRuleSetCounters(filters, ruleSetsCounters);

        return ruleSets.reduce((sum, ruleSet) => {
            return sum + ruleSet.rulesCount;
        }, 0);
    }

    /**
     * Calculates how many regexp rules are in the rulesets.
     *
     * @param result Configuration result.
     * @param filters Filters with metadata.
     * @returns Count of the regexp rules.
     */
    static getStaticRulesRegexpsCount(result: ConfigurationResult, filters: FilterMetadata[]): number {
        const ruleSetsCounters = RulesLimitsService.getRuleSetsCountersMap(result);

        const ruleSets = RulesLimitsService.getRuleSetCounters(filters, ruleSetsCounters);

        return ruleSets.reduce((sum, ruleSet) => {
            return sum + ruleSet.regexpRulesCount;
        }, 0);
    }

    /**
     * Finds first found limitation error.
     *
     * @param result Configuration result.
     * @returns Limitation error.
     */
    static getRegexpRulesLimitExceedErr = (result: ConfigurationResult): LimitationError | undefined => {
        return result.dynamicRules.limitations
            .find((e) => e instanceof TooManyRegexpRulesError);
    };

    /**
     * Finds first too many rules error.
     *
     * @param result Configuration result.
     * @returns Too manu rules error.
     */
    static getRulesLimitExceedErr = (result: ConfigurationResult): LimitationError | undefined => {
        return result.dynamicRules.limitations
            .find((e) => e instanceof TooManyRulesError);
    };

    /**
     * How many dynamic rules are enabled.
     *
     * @param result Configuration result.
     * @returns Count of enabled user rules.
     */
    static getDynamicRulesEnabledCount = (result: ConfigurationResult): number => {
        const rulesLimitExceedErr = RulesLimitsService.getRulesLimitExceedErr(result);
        const declarativeRulesCount = result.dynamicRules.ruleSet.getRulesCount();
        return rulesLimitExceedErr?.numberOfMaximumRules || declarativeRulesCount;
    };

    /**
     * Returns number of maximum possible dynamic rules.
     *
     * @param result Configuration result.
     * @returns Count of rules.
     */
    static getDynamicRulesMaximumCount = (result: ConfigurationResult): number => {
        const rulesLimitExceedErr = RulesLimitsService.getRulesLimitExceedErr(result);
        return rulesLimitExceedErr?.numberOfMaximumRules || MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
    };

    /**
     * Returns how much dynamic regex rules are enabled.
     *
     * @param result Configuration result.
     * @returns Number rules.
     */
    static getDynamicRulesRegexpsEnabledCount = (result: ConfigurationResult): number => {
        const regexpRulesLimitExceedErr = RulesLimitsService.getRegexpRulesLimitExceedErr(result);
        const regexpsCount = result.dynamicRules.ruleSet.getRegexpRulesCount();
        return regexpsCount + (regexpRulesLimitExceedErr?.excludedRulesIds.length || 0);
    };

    /**
     * Returns maximum count of the dynamic regexp rules.
     *
     * @param result Configuration result.
     * @returns Rules count.
     */
    static getDynamicRulesRegexpsMaximumCount = (result: ConfigurationResult): number => {
        const regexpRulesLimitExceedErr = RulesLimitsService.getRegexpRulesLimitExceedErr(result);
        return regexpRulesLimitExceedErr?.numberOfMaximumRules || MAX_NUMBER_OF_REGEX_RULES;
    };

    /**
     * Returns actually enabled filters.
     *
     * @returns Actually enabled filters.
     */
    private static getActuallyEnabledFilters(): number[] {
        return FiltersApi.getEnabledFiltersWithMetadata()
            .filter(f => f.groupId <= CUSTOM_FILTERS_START_ID)
            .map((filter) => filter.filterId);
    }

    /**
     * Determines and returns rules limits.
     *
     * @returns Rules limits.
     */
    async onGetRulesLimits(): Promise<IRulesLimits> {
        const result = this.configurationResult;
        if (!result) {
            throw new Error('result should be ready');
        }

        const filters = FiltersApi.getEnabledFiltersWithMetadata();

        const staticRulesEnabledCount = RulesLimitsService.getStaticRulesEnabledCount(result, filters);
        const availableStaticRulesCount = await browser.declarativeNetRequest.getAvailableStaticRuleCount();
        const staticRulesMaximumCount = staticRulesEnabledCount + availableStaticRulesCount;

        return {
            dynamicRulesEnabledCount: RulesLimitsService.getDynamicRulesEnabledCount(result),
            dynamicRulesMaximumCount: RulesLimitsService.getDynamicRulesMaximumCount(result),
            dynamicRulesRegexpsEnabledCount: RulesLimitsService.getDynamicRulesRegexpsEnabledCount(result),
            dynamicRulesRegexpsMaximumCount: RulesLimitsService.getDynamicRulesRegexpsMaximumCount(result),
            staticFiltersEnabledCount: RulesLimitsService.getStaticEnabledFiltersCount(),
            staticFiltersMaximumCount: MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
            staticRulesEnabledCount,
            staticRulesMaximumCount,
            staticRulesRegexpsEnabledCount: RulesLimitsService.getStaticRulesRegexpsCount(result, filters),
            staticRulesRegexpsMaxCount: MAX_NUMBER_OF_REGEX_RULES,
            actuallyEnabledFilters: RulesLimitsService.getActuallyEnabledFilters(),
            expectedEnabledFilters: rulesLimitsStorage.getData(),
        };
    }

    /**
     * Checks whether the filter limits are exceeded.
     *
     * @returns True if the filter limits are exceeded, false otherwise.
     */
    static areFilterLimitsExceeded(): boolean {
        const actuallyEnabledFilters = RulesLimitsService.getActuallyEnabledFilters().length;
        const expectedEnabledFilters = RulesLimitsService.getExpectedEnabledFilters().length;

        // limits are exceeded if the number of actually enabled filters is fewer
        // than the number of filters that should be enabled (expected enabled filters)
        return actuallyEnabledFilters !== expectedEnabledFilters;
    }

    /**
     * Set configuration result to the service.
     *
     * @param result Configuration result.
     */
    set(result: ConfigurationResult): void {
        this.configurationResult = result;
    }

    /**
     * Check if filters limits have changed and update filters state if needed.
     *
     * @param update Function to update filters state.
     */
    static async checkFiltersLimitsChange(update: (skipCheck: boolean) => Promise<void>): Promise<void> {
        const expectedEnabledFilters = FiltersApi.getEnabledFiltersWithMetadata()
            .filter(f => f.filterId < CUSTOM_FILTERS_START_ID)
            .map((filter) => filter.filterId)
            .sort((a, b) => a - b);

        const actuallyEnabledFilters = (await chrome.declarativeNetRequest.getEnabledRulesets())
            .map((s) => Number.parseInt(s.slice(RULE_SET_NAME_PREFIX.length), 10))
            .sort((a, b) => a - b);

        const isStateBroken = !isEqual(expectedEnabledFilters, actuallyEnabledFilters);

        const filtersToDisable = expectedEnabledFilters.filter((id) => !actuallyEnabledFilters.includes(id));

        // TODO: add this broken state icon
        // await browserActions.setIconBroken(isStateBroken);

        if (isStateBroken) {
            // Save last expected to be enabled filters to notify UI.
            await rulesLimitsStorage.setData(expectedEnabledFilters);
            filterStateStorage.enableFilters(actuallyEnabledFilters);
            filterStateStorage.disableFilters(filtersToDisable);

            await update(true);
        } else {
            const prevExpectedEnabledFilters = await RulesLimitsService.getFromStorage();
            // If state is not broken - clear list of "broken" filters
            if (prevExpectedEnabledFilters.length > 0) {
                await rulesLimitsStorage.setData([]);
            }
        }
    }

    /**
     * Clean filters that were expected to be enabled.
     */
    static async cleanExpectedEnabledFilters(): Promise<void> {
        await rulesLimitsStorage.setData([]);
    }

    /**
     * Returns an array of previously set filter ids from storage.
     *
     * @returns An array of previously set filter ids.
     */
    private static async getFromStorage(): Promise<number[]> {
        let data: number[] = [];
        try {
            const storageData = await rulesLimitsStorage.read();
            if (typeof storageData === 'string') {
                data = rulesLimitsStorageDataValidator.parse(JSON.parse(storageData));
                rulesLimitsStorage.setCache(data);
            } else {
                data = [];
                await rulesLimitsStorage.setData(data);
            }
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.warn(`Cannot parse data from "${rulesLimitsStorage.key}" storage, set default states. Origin error: `, e);
            data = [];
            await rulesLimitsStorage.setData(data);
        }
        return data;
    }

    /**
     * Returns previously enabled filters.
     *
     * @returns Previously enabled filters.
     */
    public static getExpectedEnabledFilters = (): number[] => {
        return rulesLimitsStorage.getData();
    };
}

export const rulesLimitsService = new RulesLimitsService();
