const { test, describe } = require('node:test');
const assert = require('node:assert');

/**
 * Tests for Farm Registration Date/Year and Real Farm Profit & Loss (P&L) Calculations
 * User Requirement:
 * - Capture and display date and year farm was registered/established
 * - Real profit data: when a farm spends $500 as expenses and harvests $600,
 *   the farmer sees their real net profit (+$100 USD) and profitability breakdown.
 */

describe('Farm Registration Date & Financial Profit Calculations', () => {
  describe('Farm Registration Date and Year Tracking', () => {
    test('captures registration_date and extracts registration year', () => {
      const mockFarm = {
        id: 'farm-001',
        name: 'Gbehley Central Farm',
        farmer_id: 'farmer-101',
        size: 5.5,
        size_unit: 'acres',
        farming_type: 'crops',
        registration_date: '2026-11-20',
        created_at: '2026-11-20T12:00:00.000Z',
      };

      assert.strictEqual(mockFarm.registration_date, '2026-11-20');
      const year = mockFarm.registration_date.split('-')[0];
      assert.strictEqual(year, '2026');
    });

    test('falls back gracefully to created_at year if registration_date is omitted', () => {
      const legacyFarm = {
        id: 'farm-002',
        name: 'Nimba Heritage Plot',
        farmer_id: 'farmer-102',
        size: 3.0,
        size_unit: 'acres',
        farming_type: 'livestock',
        registration_date: null,
        created_at: '2024-05-14T08:30:00.000Z',
      };

      const displayYear = (legacyFarm.registration_date || legacyFarm.created_at || '2026').split('-')[0];
      assert.strictEqual(displayYear, '2024');
    });
  });

  describe('Real Farm Profit & Loss (P&L) Calculation', () => {
    // Helper function matching app/farm/[id].tsx and app/reports/index.tsx logic
    function calculateFarmFinancials({ harvests, inputs, activities, expenses }) {
      // 1. Gross Harvest Revenue
      const harvestRevenue = harvests.reduce((acc, h) => {
        if (h.total_value && Number(h.total_value) > 0) {
          return acc + Number(h.total_value);
        }
        const isLivestock =
          h.animal_type ||
          (h.unit || '').toLowerCase().includes('head') ||
          (h.unit || '').toLowerCase().includes('animal');
        const rate = isLivestock ? 50 : 0.45;
        return acc + (Number(h.quantity) || 0) * rate;
      }, 0);

      // 2. Direct Inputs Cost
      const totalInputsCost = inputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);

      // 3. Labor & Activities Cost
      const totalActivitiesCost = activities.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);

      // 4. Operating Expenses
      const totalDirectExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      const totalExpenses = totalInputsCost + totalActivitiesCost + totalDirectExpenses;
      const netProfit = harvestRevenue - totalExpenses;
      const profitMargin = harvestRevenue > 0 ? (netProfit / harvestRevenue) * 100 : 0;

      return {
        harvestRevenue,
        totalInputsCost,
        totalActivitiesCost,
        totalDirectExpenses,
        totalExpenses,
        netProfit,
        profitMargin,
        isProfitable: netProfit >= 0,
      };
    }

    test('calculates exact +$100 USD profit when farm spends $500 expenses and harvests $600', () => {
      // Farm spends $500 total in expenses:
      // $200 inputs + $150 activities + $150 direct operating expenses
      const mockInputs = [
        { id: 'inp-1', farm_id: 'farm-001', cost: 120 },
        { id: 'inp-2', farm_id: 'farm-001', cost: 80 },
      ]; // $200

      const mockActivities = [
        { id: 'act-1', farm_id: 'farm-001', cost: 150 },
      ]; // $150

      const mockExpenses = [
        { id: 'exp-1', farm_id: 'farm-001', amount: 150, currency: 'USD' },
      ]; // $150

      // Total Expenses = 200 + 150 + 150 = $500 USD

      // Farmer harvested and sold for $600 total_value
      const mockHarvests = [
        {
          id: 'harv-1',
          farm_id: 'farm-001',
          quantity: 25,
          unit: 'heads',
          total_value: 600, // $600 USD gross revenue
          unit_price: 24,   // $24/head
        },
      ];

      const result = calculateFarmFinancials({
        harvests: mockHarvests,
        inputs: mockInputs,
        activities: mockActivities,
        expenses: mockExpenses,
      });

      assert.strictEqual(result.harvestRevenue, 600);
      assert.strictEqual(result.totalExpenses, 500);
      assert.strictEqual(result.netProfit, 100);
      assert.strictEqual(result.isProfitable, true);
      assert.ok(Math.abs(result.profitMargin - 16.666) < 0.1);
      assert.strictEqual(result.totalInputsCost, 200);
      assert.strictEqual(result.totalActivitiesCost, 150);
      assert.strictEqual(result.totalDirectExpenses, 150);
    });

    test('calculates net deficit when expenses exceed harvest revenue', () => {
      // Farm spends $500 and only gets $300 revenue
      const mockInputs = [{ id: 'inp-1', cost: 300 }];
      const mockActivities = [{ id: 'act-1', cost: 200 }];
      const mockExpenses = [];
      const mockHarvests = [{ id: 'harv-1', quantity: 500, unit: 'kg', total_value: 300 }];

      const result = calculateFarmFinancials({
        harvests: mockHarvests,
        inputs: mockInputs,
        activities: mockActivities,
        expenses: mockExpenses,
      });

      assert.strictEqual(result.harvestRevenue, 300);
      assert.strictEqual(result.totalExpenses, 500);
      assert.strictEqual(result.netProfit, -200);
      assert.strictEqual(result.isProfitable, false);
      assert.ok(Math.abs(result.profitMargin - (-66.666)) < 0.1);
    });

    test('falls back to commodity rates ($50/head livestock, $0.45/kg crops) when total_value is omitted', () => {
      const mockHarvests = [
        { id: 'harv-1', quantity: 10, unit: 'heads', total_value: null }, // 10 * $50 = $500
        { id: 'harv-2', quantity: 1000, unit: 'kg', total_value: null },  // 1000 * $0.45 = $450
      ];

      const result = calculateFarmFinancials({
        harvests: mockHarvests,
        inputs: [],
        activities: [],
        expenses: [],
      });

      assert.strictEqual(result.harvestRevenue, 950);
      assert.strictEqual(result.totalExpenses, 0);
      assert.strictEqual(result.netProfit, 950);
    });
  });
});
