import {
  Farmer,
  Farm,
  Crop,
  CropVariety,
  FarmSeason,
  FarmActivity,
  HarvestBatch,
  QualityInspection,
  Cooperative,
  Profile,
  AuditLog,
  InputRecord,
  ExpenseRecord,
} from '@/types/database';

// All mock data removed to capture strictly live, real application data
export const MOCK_CROPS: Crop[] = [];
export const MOCK_COOPERATIVES: Cooperative[] = [];
export const MOCK_FARMERS: Farmer[] = [];
export const MOCK_FARMS: Farm[] = [];
export const MOCK_SEASONS: FarmSeason[] = [];
export const MOCK_HARVESTS: HarvestBatch[] = [];
export const MOCK_INSPECTIONS: QualityInspection[] = [];
export const MOCK_ACTIVITIES: FarmActivity[] = [];
export const MOCK_INPUTS: InputRecord[] = [];
export const MOCK_AUDIT_LOGS: AuditLog[] = [];
export const MOCK_PROFILES: Profile[] = [];
