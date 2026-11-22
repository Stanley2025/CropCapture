'use strict';
/**
 * Upsert that survives a database that has not had every migration applied yet.
 *
 * If the database rejects a column that does not exist ("Could not find the 'x' column"),
 * the column is dropped from the rows and the upsert is retried. A column is only dropped
 * when the DATABASE says it does not have it, so nothing is lost that could have been stored.
 * Real errors (permissions, constraints on required columns) are returned untouched.
 *
 * Shared by the mobile app's sync engine and the USSD server.
 */

/** Optional references that may be dropped when the table they point to is missing or empty. */
const DROPPABLE_ON_FOREIGN_KEY = Object.freeze(['county_id', 'district_id']);

/** The column a PostgREST / Postgres error is complaining about, and why. */
function describeError(message) {
  const msg = String(message || '');
  let m = msg.match(/Could not find the '([^']+)' column/i);
  if (m) return { column: m[1], kind: 'missing_column' };
  m = msg.match(/column "?([a-z_]+)"? (?:of relation "?\w+"? )?does not exist/i);
  if (m) return { column: m[1], kind: 'missing_column' };
  m = msg.match(/violates foreign key constraint "\w+?_([a-z]+_id)_fkey"/i);
  if (m) return { column: m[1], kind: 'foreign_key' };
  return null;
}

/**
 * @param upsert   async (rows) => ({ error })   performs one attempt
 * @param rows     array of row objects
 * @param skip     Set of columns already known to be missing (kept by the caller between calls)
 * @returns {{ error: any, rows: object[], dropped: string[] }}
 */
async function upsertDroppingMissingColumns(upsert, rows, skip = new Set(), { maxAttempts = 12, droppableOnForeignKey = DROPPABLE_ON_FOREIGN_KEY } = {}) {
  const dropped = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const payload = rows.map((r) => {
      const row = { ...r };
      for (const col of skip) delete row[col];
      return row;
    });
    const { error } = await upsert(payload);
    if (!error) return { error: null, rows: payload, dropped };
    const info = describeError(error.message);
    const canDrop =
      info &&
      !skip.has(info.column) &&
      payload.length > 0 &&
      info.column in payload[0] &&
      (info.kind === 'missing_column' || droppableOnForeignKey.includes(info.column));
    if (!canDrop) return { error, rows: payload, dropped };
    skip.add(info.column);
    dropped.push(info.column);
  }
  return { error: new Error('too many missing columns'), rows, dropped };
}

module.exports = { upsertDroppingMissingColumns, describeError, DROPPABLE_ON_FOREIGN_KEY };
