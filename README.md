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
