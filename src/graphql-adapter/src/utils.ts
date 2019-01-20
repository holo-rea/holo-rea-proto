/**
 * Helper functions for handling data from the Holochain DHT in GraphQL queries
 *
 * @package: HoloREA
 * @author:  pospi <pospi@spadgos.com>
 * @since:   2019-01-19
 */

import { DHTResponse, Hash } from '@holorea/zome-api-wrapper'

// what the zome APIs provide
type DHTReadFn<T> = (which: Hash<T>[]) => Promise<DHTResponse<T>[]>

// abstractions that these helpers provide
export const readSingleEntry = <T extends {}>
  (reader: DHTReadFn<T>) =>
    async (id: string): Promise<DHTResponse<T>> => {
      const records = await reader([id])
      return records[0]
    }

export const resolveSingleEntry = <T extends {}, R extends DHTResponse<any>>
  (reader: DHTReadFn<T>) =>
    (refField: string) =>
      async (inputObj: R): Promise<DHTResponse<T> | null> => {
        if (!inputObj.entry[refField]) {
          return null
        }
        return readSingleEntry(reader)(inputObj.entry[refField])
      }

export const readNamedEntries = <T extends {}, K extends string>
  (reader: DHTReadFn<T>) =>
    async (entryIds: { [k in K]: string }): Promise<{ [k in K]?: DHTResponse<T> } | null> => {
      const recordIds = Object.keys(entryIds)
      if (!recordIds.length) {
        return null
      }

      const records = await reader(Object.values(entryIds))

      return recordIds.reduce((res: { [k in K]?: DHTResponse<T> }, id: string, idx: number) => {
        const rId = id as K
        res[rId] = records[idx]
        return res
      }, {})
    }
