# Counties section: what the database and the admin hold today

Read from the live database and the admin code before any change.

## Tables and columns used
| Need | Table.column | Notes |
|---|---|---|
| Farmers | `farmers` | `gender` text: `Male`, `Female` or empty. `county` is free text (no ID). `source = 'seed'` marks sample farmers. No `deleted_at`. |
| Farms | `farms` | `farmer_id`, `county` (text) and `county_id` (link to `counties`), `district` (text) and `district_id`. `source = 'seed'` for samples. No `deleted_at`. |
| Counties | `counties` | 15 rows. |
| Districts | `districts` | linked to `counties`. |
| Harvest | `harvest_batches` | `quantity` + `unit`, `quantity_kg`, `kg_per_unit`, `harvest_date`, `crop_id`, `status`, `deleted_at`, `is_latest` (older edits are kept with `is_latest = false`), `source`. |
| Crops | `crops` | name. |
| Admin roles | `profiles.role` | `super_admin`, `agricultural_admin`, others. |

Gender is stored on the farmer only. A farm or a harvest takes the gender of the farmer who owns the farm.

## What the live data looks like (when checked)
- Farmers: 16. Gender: Male 10, Female 3, empty 3. Sources: app 13, seed 3.
- Farmer county spellings: Nimba, Bong, Lofa, Margibi, Bomi, Montserrado (all clean).
- Farm county spellings: clean; every farm has a `county_id`.
- Harvest units found: `kg` only (13 harvests). Status: `submitted`.

## How the dashboard loads data today
The dashboard is a client page: the browser asks Supabase for rows and counts them. Only some figures are real. The new section does not use that path: it asks the database for finished totals.

## Things that do not match the request
- The sign-in has a built-in master login and the middleware accepts any value of the `agritrack_admin_session` cookie, so that cookie cannot prove who someone is. The Counties section therefore checks a real Supabase session and the profile role itself.
- There is no brief file in the repository to read.
- The admin has no translation file; this section adds one text file.
