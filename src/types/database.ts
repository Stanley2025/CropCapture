export type UserRole =
  | 'super_admin'
  | 'agricultural_admin'
  | 'farmer'
  | 'cooperative_manager'
  | 'extension_officer'
  | 'quality_inspector'
  | 'public_viewer';

export type SeasonStatus = 'planned' | 'active' | 'harvesting' | 'completed' | 'cancelled';

export type HarvestStatus =
  | 'draft'
  | 'submitted'
  | 'pending_inspection'
  | 'under_inspection'
  | 'inspected'
  | 'approved'
  | 'rejected'
  | 'requires_reinspection';

export type QualityGrade = 'grade_a' | 'grade_b' | 'grade_c' | 'rejected' | 'pending_review';

export type SyncStatusType =
  | 'saved_on_device'
  | 'waiting_to_sync'
  | 'synchronizing'
  | 'synced'
  | 'sync_failed'
  | 'conflict';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role: UserRole;
  county?: string | null;
  district?: string | null;
  community?: string | null;
  avatar_url?: string | null;
  cooperative_id?: string | null;
  photo_url?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Farmer {
  id: string;
  profile_id?: string | null;
  farmer_id_code: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone_number: string;
  email?: string | null;
  county: string;
  district: string;
  community: string;
  address?: string | null;
  cooperative_id?: string | null;
  photo_url?: string | null;
  pin?: string | null;
  id_type?: 'passport' | 'national_id' | string | null;
  id_number?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface County {
  id: string;
  name: string;
  code: string;
  created_at?: string;
}

export interface District {
  id: string;
  county_id: string;
  name: string;
  created_at?: string;
}

export interface LivestockDetails {
  animal_type: 'Goats' | 'Pigs' | 'Sheep' | 'Chickens' | 'Cow' | string;
  selected_animals?: string[];
  species_breakdown?: { species: string; count: number; breed?: string }[];
  breed?: string;
  head_count: number;
  production_purpose: ('Meat production' | 'Egg production' | 'Milk production' | 'Breeding' | string)[];
  management_system?: 'Free-range' | 'Semi-intensive' | 'Intensive' | string;
  housing_type?: string;
  housing_size?: string;
  housing_capacity?: number;
  grazing_availability?: boolean;
  grazing_arrangement?: string;
  grazing_area?: string;
  water_source?: 'Well' | 'Hand pump' | 'River or stream' | 'Borehole' | 'Rainwater' | 'Pipe-borne water' | string;
  feeding_system?: string;
}

export interface Farm {
  id: string;
  farmer_id: string;
  name: string;
  county: string;
  district: string;
  county_id?: string | null;
  district_id?: string | null;
  community: string;
  size: number;
  size_unit: 'acres' | 'hectares';
  farming_type?: 'crops' | 'livestock' | 'both';
  livestock_details?: LivestockDetails | null;
  latitude?: number | null;
  longitude?: number | null;
  ownership_type?: string | null;
  irrigation: boolean;
  soil_type?: string | null;
  photo_url?: string | null;
  description?: string | null;
  registration_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Crop {
  id: string;
  name: string;
  code: string;
  category: string;
  default_unit: string;
  description?: string | null;
  is_active: boolean;
}

export interface CropVariety {
  id: string;
  crop_id: string;
  name: string;
  description?: string | null;
  maturity_days?: number | null;
  is_active: boolean;
}

export interface FarmSeason {
  id: string;
  farm_id: string;
  crop_id: string;
  crop_variety_id?: string | null;
  season_name: string;
  planting_date: string;
  expected_harvest_date?: string | null;
  cultivated_area: number;
  seed_quantity?: number | null;
  status: SeasonStatus;
  cycle_type?: 'crops' | 'livestock';
  livestock_type?: string;
  head_count?: number;
  production_purpose?: string[];
  management_system?: string;
  created_at: string;
  updated_at: string;
  crop?: Crop;
  variety?: CropVariety;
}

export interface FarmActivity {
  id: string;
  farmer_id: string;
  farm_id: string;
  season_id?: string | null;
  activity_type: string;
  activity_date: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  cost: number;
  labor_count: number;
  photo_url?: string | null;
  recorded_by?: string | null;
  sync_status: SyncStatusType;
  created_at: string;
  updated_at: string;
}

export interface InputRecord {
  id: string;
  farm_id: string;
  season_id?: string | null;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchase_date: string;
  supplier?: string | null;
  cost: number;
  currency: 'USD' | 'LRD';
  notes?: string | null;
  created_at: string;
  farm?: Farm;
  season?: FarmSeason;
}

export interface ExpenseRecord {
  id: string;
  farm_id: string;
  season_id?: string | null;
  category: string;
  amount: number;
  currency: 'USD' | 'LRD';
  expense_date: string;
  description?: string | null;
  created_at: string;
  farm?: Farm;
  season?: FarmSeason;
}

export interface HarvestBatch {
  id: string;
  batch_reference: string;
  farmer_id: string;
  farm_id: string;
  season_id?: string | null;
  crop_id: string;
  crop_variety_id?: string | null;
  harvest_date: string;
  quantity: number;
  unit: string;
  total_value?: number | null;
  unit_price?: number | null;
  storage_location?: string | null;
  photo_url?: string | null;
  observations?: string | null;
  status: HarvestStatus;
  qr_token: string;
  created_at: string;
  updated_at: string;
  crop?: Crop;
  variety?: CropVariety;
  farm?: Farm;
  farmer?: Farmer;
}

export interface QualityTemplate {
  id: string;
  crop_id: string;
  template_name: string;
  description?: string | null;
  version: number;
  is_active: boolean;
  parameters?: QualityParameter[];
}

export interface QualityParameter {
  id: string;
  template_id: string;
  parameter_name: string;
  description?: string | null;
  unit?: string | null;
  data_type: 'number' | 'boolean' | 'select' | 'text';
  is_required: boolean;
  min_value?: number | null;
  max_value?: number | null;
  target_value?: string | null;
  weight: number;
  evaluation_rules?: Record<string, any>;
}

export interface QualityInspection {
  id: string;
  batch_id: string;
  inspector_id: string;
  template_id: string;
  inspection_date: string;
  final_grade: QualityGrade;
  decision_status: 'approved' | 'rejected' | 'requires_reinspection' | 'pending';
  observations?: string | null;
  report_url?: string | null;
  sync_status: SyncStatusType;
  created_at: string;
  updated_at: string;
  results?: InspectionResult[];
  evidence?: InspectionEvidence[];
}

export interface InspectionResult {
  id: string;
  inspection_id: string;
  parameter_id: string;
  measured_value: string;
  notes?: string | null;
  passes: boolean;
  parameter?: QualityParameter;
}

export interface InspectionEvidence {
  id: string;
  inspection_id: string;
  photo_url: string;
  caption?: string | null;
  created_at: string;
}

export interface QRPassport {
  id: string;
  batch_id: string;
  qr_token: string;
  public_url: string;
  issued_at: string;
  expires_at?: string | null;
  is_revoked: boolean;
  batch?: HarvestBatch;
}

export interface ExtensionVisit {
  id: string;
  officer_id: string;
  farmer_id: string;
  farm_id: string;
  visit_date: string;
  latitude?: number | null;
  longitude?: number | null;
  observations: string;
  pest_disease_reports?: string | null;
  recommendations?: string | null;
  follow_up_date?: string | null;
  photo_url?: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  visit_id?: string | null;
  farm_id: string;
  farmer_id: string;
  title: string;
  instructions: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'harvest' | 'inspection' | 'visit' | 'recommendation' | 'system' | 'sync';
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}
