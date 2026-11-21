export interface ProfitAndLoss {
  hasData: boolean;
  moneyIn: number;
  recordedIn: number;
  estimatedIn: number;
  estimatedCount: number;
  moneyOut: number;
  result: number;
  isProfit: boolean;
  otherCurrencyEntries: number;
}
export function profitAndLoss(input?: {
  harvests?: any[];
  expenses?: any[];
  inputs?: any[];
  activities?: any[];
  year?: number | null;
  farmIds?: string[] | null;
}): ProfitAndLoss;
