/**
 * Who may see which records on this phone.
 *
 * The phone's local store holds every record that was ever saved or synced on it, so each screen must
 * show only what the signed-in person is allowed to see:
 *   - a farmer sees their own farms and everything on them;
 *   - an extension officer sees ONLY the farmers (or farms) assigned to them, never everyone on the phone;
 *   - a buyer has no farm records at all (they see harvest pages through the QR code);
 *   - the other staff roles keep their wider view.
 */
import { localDb } from '../storage/localDatabase';
import type { UserRole } from '../../types/database';

export interface Scope {
  /** false = no restriction (staff roles with a wider view) */
  restricted: boolean;
  farmerIds: Set<string>;
  farmIds: Set<string>;
  farm: (f: { id: string }) => boolean;
  /** any record that belongs to a farm and/or a farmer */
  row: (r: { farm_id?: string | null; farmer_id?: string | null }) => boolean;
}

const make = (restricted: boolean, farmerIds: Set<string>, farmIds: Set<string>): Scope => ({
  restricted,
  farmerIds,
  farmIds,
  farm: (f) => !restricted || farmIds.has(f.id),
  row: (r) => !restricted || Boolean((r.farm_id && farmIds.has(r.farm_id)) || (r.farmer_id && farmerIds.has(r.farmer_id))),
});

export async function getScope(role: UserRole | string, profileId?: string | null, farmerId?: string | null): Promise<Scope> {
  if (role === 'farmer') {
    const farms = await localDb.getFarms();
    const mine = new Set<string>(farmerId ? [farmerId] : []);
    return make(true, mine, new Set(farms.filter((f) => f.farmer_id && mine.has(f.farmer_id)).map((f) => f.id)));
  }
  if (role === 'extension_officer') {
    const assignments = profileId ? await localDb.getExtensionAssignments(profileId) : [];
    // only whole-farmer assignments make every record of that farmer visible
    const farmers = new Set(assignments.filter((a) => !a.farm_id).map((a) => a.farmer_id));
    const farms = await localDb.getFarms();
    const farmIds = new Set<string>();
    for (const a of assignments) {
      // an assignment to one farm shows only that farm; an assignment to a farmer shows all their farms
      if (a.farm_id) farmIds.add(a.farm_id);
      else for (const f of farms) if (f.farmer_id === a.farmer_id) farmIds.add(f.id);
    }
    return make(true, farmers, farmIds);
  }
  if (role === 'buyer') return make(true, new Set(), new Set());
  return make(false, new Set(), new Set());
}
