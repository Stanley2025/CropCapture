/**
 * A fetch for the Supabase client that keeps the admin dashboard working while the database
 * is missing some columns or relationships (migrations not applied yet).
 *
 * PostgREST fails a whole query when a single selected column does not exist, and the admin
 * pages then show an empty list. Here, when a read (GET/HEAD) fails with "column X does not
 * exist" or "could not find a relationship", only that column or join is removed from the
 * `select=` list and the request is retried. What was dropped is remembered per table, so later
 * requests succeed first time. Only the database's own answer triggers this, so real errors
 * (permissions, bad filters) are returned untouched.
 *
 * No imports: it is plain TypeScript so it can also be unit tested with node.
 */

const droppedColumns = new Map<string, Set<string>>(); // table -> columns the database does not have
const droppedJoins = new Map<string, Set<string>>(); // parent table -> embedded tables it cannot join

/** Columns and joins dropped so far (for diagnostics). */
export function getDroppedSchemaParts() {
  return {
    columns: Object.fromEntries([...droppedColumns].map(([t, s]) => [t, [...s]])),
    joins: Object.fromEntries([...droppedJoins].map(([t, s]) => [t, [...s]])),
  };
}

export function resetDroppedSchemaParts() {
  droppedColumns.clear();
  droppedJoins.clear();
}

/** Split a select list on top-level commas ("a, b:t(c, d), e" -> ["a", "b:t(c, d)", "e"]). */
function splitTop(select: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The embedded table in "alias:table!hint(...)", "table(...)" etc. */
function embeddedTableOf(head: string): string {
  return head.split(':').pop()!.split('!')[0].trim();
}

/** Remove known-missing columns and joins from a select list. */
export function pruneSelect(table: string, select: string): string {
  const kept: string[] = [];
  for (const item of splitTop(select)) {
    const open = item.indexOf('(');
    if (open > -1 && item.endsWith(')')) {
      const head = item.slice(0, open);
      const child = embeddedTableOf(head);
      if (droppedJoins.get(table)?.has(child)) continue;
      const inner = pruneSelect(child, item.slice(open + 1, -1));
      if (inner.trim()) kept.push(`${head}(${inner})`);
    } else {
      const name = item.split('::')[0].split(':').pop()!.trim();
      if (droppedColumns.get(table)?.has(name)) continue;
      kept.push(item);
    }
  }
  return kept.join(',');
}

/** What the database complained about, if it is a missing column or join. */
function parseSchemaError(message: string): { column?: { table: string; name: string }; join?: { parent: string; child: string } } | null {
  let m = message.match(/column ([A-Za-z0-9_]+)\.([A-Za-z0-9_]+) does not exist/);
  if (m) return { column: { table: m[1].replace(/_\d+$/, ''), name: m[2] } }; // "farmers_1" = a second embed of farmers
  m = message.match(/Could not find the '([^']+)' column of '([^']+)'/);
  if (m) return { column: { table: m[2], name: m[1] } };
  m = message.match(/Could not find a relationship between '([^']+)' and '([^']+)'/);
  if (m) return { join: { parent: m[1], child: m[2] } };
  return null;
}

const REST = '/rest/v1/';

export function createResilientFetch(base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET') || 'GET').toUpperCase();
    const urlText = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if ((method !== 'GET' && method !== 'HEAD') || !urlText.includes(REST)) return base(input, init);

    let url: URL;
    try {
      url = new URL(urlText);
    } catch {
      return base(input, init);
    }
    const table = url.pathname.split(REST)[1]?.split('/')[0];
    if (!table || !url.searchParams.has('select')) return base(input, init);

    const original = url.searchParams.get('select') || '*';
    let response: Response | null = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      const select = original === '*' ? '*' : pruneSelect(table, original);
      url.searchParams.set('select', select);
      const request = typeof input === 'string' || input instanceof URL ? url.toString() : new Request(url.toString(), input as Request);
      response = await base(request, init);
      if (response.status !== 400 && response.status !== 404) return response;

      let message = '';
      try {
        message = String(((await response.clone().json()) as { message?: string }).message || '');
      } catch {
        return response;
      }
      const problem = parseSchemaError(message);
      if (!problem) return response;

      const before = pruneSelect(table, original);
      if (problem.column) {
        const set = droppedColumns.get(problem.column.table) || new Set<string>();
        set.add(problem.column.name);
        droppedColumns.set(problem.column.table, set);
      } else if (problem.join) {
        const set = droppedJoins.get(problem.join.parent) || new Set<string>();
        set.add(problem.join.child);
        droppedJoins.set(problem.join.parent, set);
      }
      // Nothing left to drop (or "select=*"): the error is real, give it back.
      if (original === '*' || pruneSelect(table, original) === before) return response;
    }
    return response as Response;
  };
}
