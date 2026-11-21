# AgriTrack Liberia 🇱🇷

> **"Every Farm Recorded. Every Harvest Measured. Every Quality Verified."**

**AgriTrack Liberia** is a cross-platform, native mobile application built with **React Native**, **Expo (SDK 52)**, **TypeScript**, **Expo Router**, and **Supabase (PostgreSQL + RLS)**. Designed specifically for the Liberian agricultural context, it empowers smallholder farmers, cooperative managers, agricultural extension agents, and national quality inspectors to manage the complete agricultural lifecycle—even in remote areas with unreliable internet connectivity.

---

## 🌾 Core Capabilities

1. **Farmer & Cooperative Profile Management**
   - Unique Farmer ID: `AGR-F-000001`
   - Cooperative affiliation tracking (e.g., Nimba Farmers Multipurpose Cooperative)
   - Privacy-first design protecting farmer personal contact and financial details.

2. **Farm Parcel & Geolocation Management**
   - Native GPS boundary & coordinate capture (`expo-location`)
   - Land tenure classifications (Family Customary Land, Freehold, Leasehold, Communal)
   - Soil taxonomy (Clay Loam, Peat, Alluvial Swamp, Lateritic)
   - Irrigation & water control indicators.

3. **Multi-Crop Season Planning**
   - Catalogue of major Liberian crops: Rice, Cassava, Maize, Cocoa, Coffee, Pepper, Plantain, Sweet Potato, Vegetables, Oil Palm.
   - Crop varieties (e.g., Suakoko 8, LAC 23, CARICASS 1, DMR-ESR-Y, Forastero).
   - Planting schedules, seed quantities, and cultivated acreage.

4. **Digital Farm Records**
   - Field operations: Land preparation, planting, fertilizer application, weeding, pest management, irrigation, field inspection.
   - Labor tracking and direct operational costs.
   - Searchable, filterable activity history.

5. **Input & Financial Expense Management**
   - Multi-currency support: **USD** and **LRD**.
   - Input procurement inventory: Seeds, fertilizers, pesticides, tools.
   - Farm expense ledgers with categorical breakdown.

6. **Harvest Management & Unique Batch References**
   - Unique national batch reference generation: `AGR-2026-RICE-000001`.
   - Yield measurement (kg, metric tonnes, 50kg bags).
   - Storage warehouse logging and harvest condition observations.

7. **Configurable Quality Inspection Engine**
   - Dedicated Quality Inspector workspace.
   - Crop-specific parameters:
     - **Rice**: Moisture content (10–14%), Foreign matter (<1.5%), Damaged grains (<3%), Grain appearance, Pest infestation, Odour.
     - **Cassava**: Freshness window (<48h), Physical damage (<5%), Rot/decay (0%), Size & condition.
     - **Cocoa**: Moisture content (6–7.5%), Bean count (90–110), Fermentation degree (>70%), Defective beans (<3%).
   - Automated grade determination: **Grade A**, **Grade B**, **Grade C**, **Rejected**.
   - Non-repudiable inspector certification & decisions.

8. **End-to-End QR Harvest Traceability**
   - Native QR code generation & camera scanning (`react-native-qrcode-svg`, `expo-camera`).
   - Cryptographically random security tokens (`agritrack_sec_tok_...`).
   - Public traceability passport displaying commodity provenance, harvest date, and certified grade without exposing private farmer PII.

9. **Offline-First Synchronization Engine**
   - Persistent local storage backed by SQLite and reactive state stores.
   - Offline sync queue with client-generated UUIDs, retry policies, and conflict detection.
   - In-app **Simulate Offline Mode** toggle for real-time offline demonstration.
   - Explicit sync status indicators: `Saved on Device`, `Waiting to Sync`, `Synchronizing`, `Synced`, `Sync Failed`.

10. **Extension Officer Advisory System**
    - GPS farm visit logging.
    - Pest & disease diagnostics (Fall Armyworm, Cassava Mosaic Disease, Rice Blast, etc.).
    - Technical farmer recommendations and follow-up visit scheduling.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Runtime** | React Native 0.76.9, Expo SDK 52, TypeScript 5.3 |
| **Navigation** | Expo Router v4 (File-based native routing & bottom tabs) |
| **State Management** | Zustand 5.0, TanStack Query v5 |
| **Local Offline DB**| Expo SQLite / Local Storage Sync Queue |
| **Backend & Auth** | Supabase, PostgreSQL, Row Level Security (RLS) |
| **Native APIs** | Expo Location (GPS), Expo Camera, Expo Image Picker, Expo SecureStore |
| **Traceability** | `react-native-qrcode-svg` with crypto-random verification tokens |
| **Build & Deploy** | EAS Build (Android APK, Android App Bundle, iOS) |

---

## 📱 User Interface Design Identity

Adheres strictly to the Liberian Agricultural Identity:
- **Primary Green:** `#15803D`
- **Dark Green:** `#14532D`
- **Light Green:** `#DCFCE7`
- **Background Slate:** `#F8FAFC`
- **Card White:** `#FFFFFF`
- **Main Text:** `#1E293B`

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Type Check
```bash
npx tsc --noEmit
```

### 3. Start Expo Development Server
```bash
# Start standard Metro bundler
npx expo start

# Run on Android device / emulator
npx expo start --android

# Run on iOS simulator
npx expo start --ios

# Run in Web browser preview
npx expo start --web
```

---

## 🔄 End-to-End Hackathon Demonstration Workflow

1. **Launch App**: Open the app to view the personalized dashboard for farmer *Emmanuel Gaye* (Nimba County, `AGR-F-000001`).
2. **Register a Farm**: Tap **Register Farm**, capture GPS coordinates, set soil type (e.g. *Clay Loam Swamp Basin*), and save.
3. **Activate Crop Season**: Tap **New Season**, select *Rice (Suakoko 8)*, and set expected harvest dates.
4. **Log Field Operations**: Record a **Planting** or **Fertilizer application** activity with labor and costs.
5. **Register Harvest**: Tap **Register Harvest**, enter yield quantity (e.g., *2,450 kg*), and submit.
   - The app immediately generates a unique batch reference (e.g. `AGR-2026-RICE-000001`) and QR verification token.
6. **Switch Persona to Quality Inspector**:
   - Tap **Role** in the top navigation or Profile screen and switch to **Quality Inspector**.
   - Open the **Quality Inspector Workspace** to see the pending batch.
   - Conduct the crop-specific inspection (Moisture 12.4%, Foreign Matter 0.4%, Zero Pests).
   - The app automatically assigns **Grade A** and certifies the decision.
7. **Verify Public QR Passport**:
   - Return to the batch or open **Scan QR Passport**.
   - View the public certificate displaying certified quality, harvest origin, and batch reference without exposing private phone numbers or financials.
8. **Test Offline-First Capability**:
   - Tap the **Online / Offline Pill** in the top header or visit the **Offline Sync Center**.
   - Enable **Simulate Offline Mode**.
   - Create a new activity or harvest draft while offline. Notice the record is marked `Saved on Device`.
   - Re-enable online mode and tap **Execute Synchronization** to process the queue.

---

## 🗄️ Database Setup (Supabase)

The complete SQL database schema and benchmark seed data are located in:
- `supabase/migrations/20261118_agritrack_schema.sql`: 22 normalized PostgreSQL tables, enums, indexes, and comprehensive Row Level Security (RLS) policies.
- `supabase/seed.sql`: Liberian crops (Rice, Cassava, Maize, Cocoa, Pepper, Oil Palm), elite varieties (Suakoko 8, CARICASS 1, DMR-ESR-Y), and national quality inspection parameter templates.

To apply migrations to your Supabase project:
```bash
# Via Supabase CLI
supabase db push
# Or copy and execute supabase/migrations/20261118_agritrack_schema.sql into the Supabase SQL Editor
```

---

## 📦 Building Installable Mobile Apps with EAS

AgriTrack Liberia is configured with `eas.json` for Android and iOS builds:

```bash
# Build standalone Android APK for direct phone installation:
eas build --platform android --profile preview

# Build Android App Bundle (.aab) for Google Play:
eas build --platform android --profile production

# Build iOS App:
eas build --platform ios --profile preview
```

---

## 📞 USSD Channel (Feature Phones)

Farmers with basic phones can register a farm, record harvests and expenses, view everything they have recorded (from USSD or the app), see a season summary, and get a 3-day weather forecast by dialing **`*123#`**. The USSD channel writes to the **same Supabase tables** the mobile app syncs to, so records from either channel appear in the other.

```
Feature phone ──► Mobile network / aggregator ──► POST /ussd ──► server/ussd/menu.js
(or /simulator)    (Africa's Talking, etc.)                         │
                                                                    ▼
Mobile app ──► local store ──► sync engine ──────────────►  Supabase (farmers, farms,
           ◄── pull-to-refresh / Sync ◄─────────────────────  farm_seasons, harvest_batches, expenses)
```

Shared business logic (record shapes, batch references, QR tokens, phone matching, profit estimate, county list) lives in [`src/shared/farmRecords.js`](src/shared/farmRecords.js) and is used by **both** the app and the USSD server.

### Run the demo

```bash
npm install                      # once
npm run ussd:seed -- --reset     # (re)create demo farmers in Supabase (uses .env)
npm run ussd                     # USSD server on http://localhost:4000 (Supabase store)
# Offline fallback (no internet / no Supabase): in-memory store, pre-seeded
npm run ussd:memory
```

| URL | What |
| :--- | :--- |
| http://localhost:4000/simulator | Browser feature-phone simulator (acts as the gateway) |
| http://localhost:4000/activity | Live activity log, each record labelled **USSD**, **App** or **Seed** |
| `POST http://localhost:4000/ussd` | Aggregator callback endpoint |

Set `PORT` to change the port. The server reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`; on a real deployment set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` instead (server-side only).

**Migrations:** the app's Register Farm screen saves `farming_type`, `livestock_details`, `registration_date`, `county_id` and `district_id`, which come from these migrations: `20261120_farm_enterprise_and_clean_data.sql`, `20261120_farm_livestock_details.sql`, `20261120_counties_and_districts.sql` (creates the `counties` and `districts` tables the new columns refer to) and `20261121_record_source.sql` (`source`). Apply all of them in the Supabase SQL editor so USSD and the app store farms in full. If one is missing, the USSD server still saves the farm: it leaves out only the columns your database does not have yet and logs a warning such as `farms.livestock_details is not in the database yet`.

### Demo farmers (seed)

| Farmer | Phone | Farms |
| :--- | :--- | :--- |
| Musu Kollie | +231-77-100-0001 | Kollie Rice Farm (Bong) |
| Joseph Flomo | +231-88-100-0002 | Flomo Cocoa Farm, Flomo Cassava Plot (Lofa) |
| Comfort Doe | +231-77-100-0003 | Doe Vegetable Garden (Nimba) |
| Emmanuel Gaye | +231-77-654-3210 | Existing **app** account (not created by the seed) |
| New farmer | +231-77-100-0009 | Not registered. Use it to demo first-time registration. `--reset` removes it again |

### Menu

```
*123#  (unregistered phone -> name -> farm registration)
1. Register farm     the SAME information as the app's Register Farm screen:
                       farm name -> farm type (crops / livestock / both) -> county -> district
                       -> community -> size + acres/hectares -> land ownership -> soil type -> irrigation
                       crops or both:    crops grown (type numbers like 1,2)
                       livestock or both: animals, breed, head count, purpose, management system,
                                         housing type (+ size, capacity), grazing (+ arrangement, area),
                                         water source, feeding system
                       -> registration date (today or DDMMYYYY) -> confirm
2. Record harvest    [farm] -> crop -> quantity -> confirm
3. Record expense    [farm] -> Seeds/Labour/Fertilizer/Transport/Other -> amount (USD) -> confirm
4. My farm summary   harvest per crop, expenses, estimated sales, net (this calendar year)
5. Weather forecast  county -> next 3 days (Open-Meteo, cached 15 min)
6. My records        1. My farms -> [farm] -> details (county, size, crops, totals)
                                    -> 1. its harvests / 2. its expenses
                     2. Recent harvests   3. Recent expenses   (4 per page, 98 = More)
                     Farm screen: 3. Farm details (community, land, soil, irrigation, crops, date)
                                  4. Livestock details (animals, breed, housing, water, feed ...)
0 = back, 00 = main menu. Invalid input re-prompts. Every screen is 160 characters or fewer.
```

### Demo script (about 5 minutes)

**Before judges arrive:** run `npm run ussd:seed -- --reset`, then `npm run ussd`. Open `/simulator` and `/activity` side by side on the projector. Log in to the mobile app as the demo farmer (Emmanuel Gaye).

1. **A feature-phone farmer records a harvest.** In the simulator, pick *Musu Kollie*, press **Send** on `*123#`. Enter `2` (Record harvest), `1` (Rice), `250`, `1` (Save). The phone shows the batch reference. On the activity log, a new orange **USSD** harvest row appears within 4 seconds.
2. **Season summary.** Dial again, enter `4`. You see *Rice: 1,000 kg, Expenses: $175, Est. sales: $450, Net: +$275*.
3. **Record an expense.** Dial, `3` (Record expense), `3` (Fertilizer), `30`, `1`. Show the new USSD row on the activity log.
4. **View records.** Dial as Musu, enter `6` (My records), `1` (My farms): the farm details appear. Enter `1` to list its harvests, including the 250 kg one from step 1. Enter `0` to go back, then `2` for its expenses.
5. **Validation and navigation.** Dial, `2`, `1`, then type `abc`: the phone asks for a number. Enter `0` to go back, then `00` for the main menu. Press **End**.
6. **One account, two channels.** Pick *Emmanuel Gaye (app account)* and dial. The menu greets *Hi Emmanuel*, because his phone number matched his app account. Record a harvest: `2`, `1`, `100`, `1`. In the mobile app, open **Harvests** and pull down to refresh. The 100 kg harvest appears with the note "Recorded via USSD".
7. **And back the other way.** In the app, add an expense under **Inputs & Expenses** and tap **Sync** (Offline Sync Center). In the simulator, dial as Emmanuel and enter `4`. The summary now includes the app expense. (This needs the app's sync to the live database to work. Check the Sync Center shows no errors before the demo.)
8. **New farmer registration.** (Names are typed on the keypad like a real phone: press `2` once for A, twice for B; `0` is a space; `#` switches ABC / 123. A computer keyboard works too.) Pick *New farmer*, dial, enter `Sarah Johnson`, `Sarah Farm`, then answer the same questions as the app: `1` (Crops), `98` + `12` (Nimba), `1` (first district), `Gbehley` (community), `2.5` (size), `1` (acres), `1` (family customary land), `1` (soil), `2` (no irrigation), `1,2` (Rice and Cassava), `1` (today), `1` (Save). The phone shows her new Farm ID. Dial again: *Hi Sarah*. Enter `6`, `1` (My farms) to see the farm, then `3` for its full details. In the mobile app, pull down to refresh on **My Farms**: the same farm appears with all the same fields.
9. **Weather.** Enter `5`, `98`, `12` (Nimba) for a 3-day forecast.

### Connecting a real aggregator (e.g. Africa's Talking)

1. Deploy the server (`node server/index.js`) somewhere with a public HTTPS URL. For a quick test, tunnel your laptop: `ngrok http 4000` or `cloudflared tunnel --url http://localhost:4000`.
2. In the Africa's Talking dashboard, go to **USSD → Create Channel**, choose a service code, and set the **Callback URL** to `https://<your-host>/ussd`.
3. Africa's Talking POSTs `sessionId`, `serviceCode`, `phoneNumber`, `text` (plus `networkCode`) as `application/x-www-form-urlencoded`. This matches what the simulator sends, so no code changes are needed. The endpoint replies `text/plain` starting with `CON` (expects input) or `END` (closes the session). It also accepts JSON bodies.
4. Use `SUPABASE_SERVICE_ROLE_KEY` on the server, and keep the response fast (aggregators time out after a few seconds; the weather call has a 4-second timeout and a cache).

**Design notes:** the handler is stateless. It replays the `*`-joined `text` from the main menu on every request, so no session store is needed. Saves only happen on the final confirm. Record IDs come from `sessionId` + inputs, so a retried request updates the same row instead of creating a duplicate.

### Tests

```bash
npm test     # includes __tests__/ussdMenu.test.js (flows, validation, back navigation, 160-char limit, weather cache)
```

---

## 🌱 Season record and season weather

**Season record** (`app/season/[id].tsx`, opened from "Open season record" on the farm screen) fills the gaps in what the app knows about a season. Every question is optional, saves as you tap, and works offline. Only what the existing tables lack was added: crop, variety, area and seed quantity already lived in `farm_seasons`; labour counts and costs in `farm_activities`; harvest date and quantity in `harvest_batches`; costs in `expenses` / `input_records`.

| Section | What is recorded |
| :--- | :--- |
| Field | field type (upland / lowland-swamp), size, variety (or saved seed), previous crop or fallow length, land preparation (brushed, felled, burned, ploughed) |
| Planting | seed source, seed quantity in cups, tins, bags or kg (stored with its kg conversion), intercropped yes/no |
| Labour | family, hired or kuu (communal group): days, cost, currency |
| Problems | birds, rats, insects, disease (cassava mosaic, cocoa black pod, rice blast), weeds, flood, drought, windstorm, fire, animals, theft: date and small / medium / big |
| Harvest | quantity in local units with kg conversion; where it went: sold / eaten at home / kept as seed / lost (rot, rats, wet) |
| Sales | price per unit, month sold, buyer or market, transport cost; LRD or USD stored on each record |
| Storage | method, months, loss in kg |
| Season end | "What would you do differently?" (plant earlier, weed more, more seed, change variety, other) plus an audio note |
| Profit | **cash profit** per currency and **value of food kept for home** on separate lines |

**Profit.** Cash profit is sales minus transport, labour, expenses, inputs and activity costs, shown separately for LRD and USD (the two are never mixed). The value of food kept for home is kg eaten at home times the price the farmer gives for 1 kg. It is never added to cash profit. A cost with no season on a farm that has two seasons overlapping cannot be assigned, so it is left out and the screen says how many were left out.

**Local units to kg.** `KG_PER_UNIT` in `src/shared/seasonRecord.js` holds the weights. The **cup and tin weights are placeholders** that vary by market and crop: have a local agronomist confirm them (and add per-crop overrides in `KG_PER_UNIT_BY_CROP_CODE`). Each record keeps the quantity as the farmer said it, the factor used and the kg, so changing a factor later never rewrites history.

### Weather, recorded inside the season

There is no weather screen, forecast, alert or advice in this feature. Weather is recorded quietly and shown only inside the season record and in the season comparison.

- **Window:** 30 days before planting to season end. Planting = earliest "Planting" activity of the season, else the season's planting date. Season end = last harvest date (never in the future), else today.
- **Data:** daily rain (mm), max and min temperature from the Open-Meteo **historical archive** for the farm's GPS point. Coordinates are rounded to 2 decimals (about 1 km) before they are sent. The archive trails real time by a few days, so the newest days are marked "not available yet".
- **Stored per season (synced to phones, without the daily rows):** total rain, rainy days (1 mm or more), longest dry spell, average max and min temperature, rain in the first 30 days after planting, longest dry spell in the first 60 days, start of the rains (first 3-day period with at least 20 mm, dated to its first wet day), heavy-rain days (50 mm or more) and a month-by-month breakdown. The daily rows go to `season_weather_daily` on the server only.
- **Thresholds** are named constants in `WEATHER_THRESHOLDS` (`src/shared/seasonWeather.js`), so agronomists can adjust them in one place.
- **Comparing seasons** (`app/season/compare.tsx`): only seasons of the same crop, lined up by days since planting (never by calendar month). Phones hold the summary, so the like-for-like measures are rain in the first 30 days, dry spell in the first 60 days and the start of the rains relative to planting. A season that is not finished is always labelled "season still running", and a running season compared with finished ones carries a warning.

**Setup:** apply `supabase/migrations/20261122_season_record_and_weather.sql` in the Supabase SQL editor (safe to run twice). It adds `quantity_kg` / `kg_per_unit` to harvests, the new season tables, and a private `season-audio` storage bucket for the audio notes. Until it is applied, everything still works on the phone; the new records simply wait in the sync queue.
