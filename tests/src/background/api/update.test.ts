import { z } from 'zod';

import { UpdateApi } from '../../../../Extension/src/background/api';
import {
    mockLocalStorage,
    getStorageFixturesV0,
    getStorageFixturesV1,
    getStorageFixturesV2,
    getStorageFixturesV3,
    getStorageFixturesV4,
    getStorageFixturesV5,
    getStorageFixturesV6,
    type StorageData,
} from '../../../helpers';
import { getRunInfo } from '../../../../Extension/src/background/utils';
import { FILTER_KEY_PREFIX, SbCache } from '../../../../Extension/src/background/storages';
import { HybridStorage } from '../../../../Extension/src/background/storages/hybrid-storage';
import { SettingOption } from '../../../../Extension/src/background/schema/settings/main';
import { ADGUARD_SETTINGS_KEY } from '../../../../Extension/src/common/constants';

jest.mock('../../../../Extension/src/background/engine');

describe('Update Api', () => {
    describe('update method', () => {
        const timestamp = 12345;

        const expires = timestamp + SbCache.CACHE_TTL_MS;

        const v0 = getStorageFixturesV0();
        const v1 = getStorageFixturesV1();
        const v2 = getStorageFixturesV2(expires);
        const v3 = getStorageFixturesV3(expires);
        const v4 = getStorageFixturesV4(expires);
        const v5 = getStorageFixturesV5(expires);
        const v6 = getStorageFixturesV6(expires);

        let setMultipleSpy: jest.SpyInstance;

        beforeAll(() => {
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);
        });

        beforeEach(() => {
            setMultipleSpy = jest.spyOn(HybridStorage.prototype, 'setMultiple').mockImplementation(
                async () => {
                    return true;
                },
            );
        });

        afterEach(() => {
            setMultipleSpy.mockRestore();
        });

        const getCases = (from: StorageData[], to: StorageData[]) => {
            const cases = [];

            for (let i = 0; i < Math.min(from.length, to.length); i += 1) {
                cases.push({ from: from[i] as StorageData, to: to[i] as StorageData });
            }

            return cases;
        };

        const runCase = async (data: {
            from: StorageData,
            to: StorageData,
        }) => {
            const storage = mockLocalStorage(data.from);
            const runInfo = await getRunInfo();

            await UpdateApi.update(runInfo);

            // Some properties in the data are stored as strings, but we need to compare them as objects, not as strings
            const jsonStringSchema = z.string().transform((val) => JSON.parse(val)).optional();

            const settingsSchema = z.object({
                [ADGUARD_SETTINGS_KEY]: z.object({
                    [SettingOption.I18nMetadata]: jsonStringSchema,
                    [SettingOption.Metadata]: jsonStringSchema,
                    [SettingOption.GroupsState]: jsonStringSchema,
                    [SettingOption.FiltersVersion]: jsonStringSchema,
                    [SettingOption.FiltersState]: jsonStringSchema,
                }).passthrough(),
            }).passthrough();

            const settings = await storage.get();
            expect(settingsSchema.parse(settings)).toStrictEqual(settingsSchema.parse(data.to));
        };

        it.each(getCases(v0, v6))('should update from v0 to v6', runCase);
        it.each(getCases(v1, v6))('should update from v1 to v6', runCase);
        it.each(getCases(v2, v6))('should update from v2 to v6', runCase);
        it.each(getCases(v3, v6))('should update from v3 to v6', runCase);
        it.each(getCases(v4, v6))('should update from v4 to v6', runCase);
        it.each(getCases(v5, v6))('should update from v5 to v6', runCase);

        // Separate test for migration from V3 storage, because after this
        // version we moved from localStorage to hybridStorage.
        it('should move filter data to IDB', async () => {
            const [data] = getStorageFixturesV3(expires);

            if (!data) {
                throw new Error('fixture is not defined');
            }
            mockLocalStorage(data);
            const runInfo = await getRunInfo();
            const filterRelatedKeys = Object.keys(data).filter((key) => key.startsWith(FILTER_KEY_PREFIX));

            await UpdateApi.update(runInfo);

            expect(setMultipleSpy).toHaveBeenCalledTimes(1);
            expect(setMultipleSpy).toHaveBeenCalledWith(
                // An object that contains all filter-related keys from the old data
                // If this test passes, it means that data was passed to the hybrid storage
                expect.objectContaining(
                    filterRelatedKeys.reduce((acc: { [key: string]: any }, key) => {
                        acc[key] = expect.anything();
                        return acc;
                    }, {}),
                ),
            );
        });
    });
});
