export interface CurrencyTotals {
  hasData: boolean;
  moneyIn: number;
  recordedIn: number;
  estimatedIn: number;
  moneyOut: number;
  result: number;
  isProfit: boolean;
}
export interface HarvestLine { id: string; farmId: string; crop: string | null; reference: string | null; date: string; quantity: number; unit: string | null; amount: number; currency: 'USD' | 'LRD'; estimated: boolean }
export interface CostLine { id: string; farmId: string; kind: 'expense' | 'input' | 'activity'; label: string; detail: string | null; date: string; amount: number; currency: 'USD' | 'LRD' }
export interface FarmTotals { farmId: string; usd: CurrencyTotals; lrd: CurrencyTotals }
export interface ProfitAndLoss extends CurrencyTotals {
  farms: FarmTotals[];
  harvestLines: HarvestLine[];
  costLines: CostLine[];
  /** top-level figures are US dollars; `lrd` holds the Liberian dollar figures */
  estimatedCount: number;
  usd: CurrencyTotals;
  lrd: CurrencyTotals;
  hasLRD: boolean;
}
export function profitAndLoss(input?: {
  harvests?: any[];
  expenses?: any[];
  inputs?: any[];
  activities?: any[];
  year?: number | null;
  farmIds?: string[] | null;
}): ProfitAndLoss;
