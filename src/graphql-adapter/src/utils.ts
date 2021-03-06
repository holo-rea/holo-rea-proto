/**
 * Helper functions for handling data from the Holochain DHT in GraphQL queries
 *
 * @package: HoloREA
 * @author:  pospi <pospi@spadgos.com>
 * @since:   2019-01-19
 */

import { DHTResponse, VfObject, Hash } from '@holorea/zome-api-wrapper'

// what the zome APIs provide

type DHTReadFn<T> = (which: Hash<T>[]) => Promise<DHTResponse<T>[]>

// abstractions that these helpers provide

export type GraphRecord<T extends VfObject> = T | { [id: string]: string }

/**
 * Takes a raw response from the DHT (with separate hash / entry)
 * and combines it into a single record object for GraphQL.
 *
 * In this process we lose `type`, but that's OK because GraphQL adds its *own* types.
 */
export const normaliseRecord = <T extends {}>(response: DHTResponse<T>): GraphRecord<T> => {
  return {
    id: response.hash,
    ...response.entry
  }
}

/**
 * Given an entry reader function from zomes.js, returns a function which
 * queries DHT records by ID.
 */
export const readSingleEntry = <T extends {}>
  (reader: DHTReadFn<T>) =>
    async (id: string): Promise<GraphRecord<T>> => {
      const records = await reader([id])
      return normaliseRecord(records[0])
    }

/**
 * Entry reader wrapper for loading record fields. Creates a two-step curried
 * function which takes an entry reader function followed by a field ID.
 * Upon executing the final step, accepts input records which are expected to contain
 * the identified field and retrieves the referenced DHT record for the field.
 */
export const resolveSingleEntry = <T extends {}, R extends GraphRecord<any>>
  (reader: DHTReadFn<T>) =>
    (refField: string) =>
      async (inputObj: R): Promise<GraphRecord<T> | null> => {
        if (!inputObj[refField]) {
          return null
        }
        return readSingleEntry(reader)(inputObj[refField])
      }

/**
 * Higher-order function for wrapping zome entry reader functions for key/value
 * queries. The returned function accepts a mapping of keys -> DHT IDs; and
 * performs retrieval of all referenced IDs as full records before returning
 * results in a HashMap of the same shape.
 */
export const readNamedEntries = <T extends {}, K extends string>
  (reader: DHTReadFn<T>) =>
    async (entryIds: { [k in K]: string }): Promise<{ [k in K]?: GraphRecord<T> }> => {
      const recordIds = Object.keys(entryIds)
      if (!recordIds.length) {
        return {}
      }

      const records = await reader(Object.values(entryIds))

      return recordIds.reduce((res: { [k in K]?: GraphRecord<T> }, id: string, idx: number) => {
        const rId = id as K
        res[rId] = normaliseRecord(records[idx])
        return res
      }, {})
    }

/**
 * Higher-order function for reading lists of zome entries and normalizing them.
 * The returned function from the first curry accepts an array of DHT record hashes
 * and returns an array of records.
 * Note that the order of returned records may not match the input query order.
 */
export const readMultipleEntries = <T extends {}>
  (reader: DHTReadFn<T>) =>
    async (entryIds: Hash<T>[]): Promise<GraphRecord<T>[]> => {
      if (!entryIds.length) {
        return []
      }

      const records = await reader(entryIds)
      return records.map(normaliseRecord)
    }

/**
 * Entry reader wrapper for loading record fields which reference arrays of DHT
 * hashes. Creates a two-step curried function which takes an entry reader
 * function followed by a field ID.
 * Upon executing the final step, accepts input records which are expected to contain
 * the identified field and retrieves the referenced DHT records for all hashes
 * present in the field.
 */
export const resolveMultipleEntries = <T extends {}, R extends GraphRecord<any>>
  (reader: DHTReadFn<T>) =>
    (refField: string) =>
      async (inputObj: R): Promise<GraphRecord<T>[]> => {
        if (!inputObj[refField]) {
          return []
        }
        return readMultipleEntries(reader)(inputObj[refField])
      }
