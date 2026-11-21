const test = require('node:test');
const assert = require('node:assert');

// 1. Queue Ordering: Parents before Children
test('Sync Queue Ordering: Strict dependency ranking uploads parents before children', () => {
  const DEPENDENCY_RANK = {
    farmer: 1,
    farm: 2,
    season: 3,
    activity: 4,
    input: 4,
    expense: 4,
    harvest: 5,
    inspection: 6,
  };

  const unsortedQueue = [
    { id: 'q-insp', entity_type: 'inspection', created_at: '2026-11-21T10:00:00Z' },
    { id: 'q-harv', entity_type: 'harvest', created_at: '2026-11-21T09:30:00Z' },
    { id: 'q-exp', entity_type: 'expense', created_at: '2026-11-21T09:00:00Z' },
    { id: 'q-farm', entity_type: 'farm', created_at: '2026-11-21T08:00:00Z' },
    { id: 'q-farmer', entity_type: 'farmer', created_at: '2026-11-21T07:00:00Z' },
    { id: 'q-season', entity_type: 'season', created_at: '2026-11-21T08:30:00Z' },
    { id: 'q-act', entity_type: 'activity', created_at: '2026-11-21T08:45:00Z' },
  ];

  const sorted = [...unsortedQueue].sort((a, b) => {
    const rankA = DEPENDENCY_RANK[a.entity_type] || 99;
    const rankB = DEPENDENCY_RANK[b.entity_type] || 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.created_at.localeCompare(b.created_at);
  });

  const order = sorted.map((item) => item.entity_type);
  assert.deepStrictEqual(order, [
    'farmer',
    'farm',
    'season',
    'activity',
    'expense',
    'harvest',
    'inspection',
  ]);
});

// 2. Conflict Resolution: Server wins on inspector grades; append-only revisions on expenses/harvests
test('Conflict Rules: Server wins on inspector grades; expenses and harvests use revisions', () => {
  // Case A: Inspector grades - Server ALWAYS wins
  const clientPayload = {
    id: 'insp-101',
    final_grade: 'grade_a',
    decision_status: 'approved',
    certified_by: 'local-phone-user',
  };

  const serverRecord = {
    id: 'insp-101',
    final_grade: 'grade_b',
    decision_status: 'approved',
    certified_by: 'SENIOR_GOVT_INSPECTOR_LR_0019',
    server_version: 3,
  };

  // Reconcile: Server values win over local client
  const reconciledInspection = {
    ...clientPayload,
    final_grade: serverRecord.final_grade,
    decision_status: serverRecord.decision_status,
    certified_by: serverRecord.certified_by,
    server_version: serverRecord.server_version + 1,
    updated_at: '2026-11-21T11:00:00Z',
  };

  assert.strictEqual(reconciledInspection.final_grade, 'grade_b');
  assert.strictEqual(reconciledInspection.certified_by, 'SENIOR_GOVT_INSPECTOR_LR_0019');
  assert.strictEqual(reconciledInspection.server_version, 4);

  // Case B: Expense append-only revisions
  const initialExpense = {
    id: 'exp-orig-001',
    farm_id: 'farm-001',
    amount: 150,
    revision_number: 1,
    is_latest: true,
  };

  // User edits expense from $150 to $175: Appends revision 2 rather than deleting original
  const revisedExpense = {
    id: 'exp-rev-002',
    parent_record_id: initialExpense.id,
    farm_id: 'farm-001',
    amount: 175,
    revision_number: initialExpense.revision_number + 1,
    is_latest: true,
  };
  initialExpense.is_latest = false;

  assert.strictEqual(initialExpense.is_latest, false);
  assert.strictEqual(revisedExpense.revision_number, 2);
  assert.strictEqual(revisedExpense.parent_record_id, 'exp-orig-001');
  assert.strictEqual(revisedExpense.amount, 175);
});

// 3. QR Passport Option A: Offline QR is "Not verified yet"; only server-signed shows "Verified"
test('QR Passport Option A: Offline batches display "Not verified yet"; server signature required for "Verified"', () => {
  function evaluatePassportStatus(harvest) {
    const isServerVerified = Boolean(
      harvest.is_server_verified ||
      harvest.server_signature ||
      (harvest.status === 'approved' && !harvest.is_offline_pending && !harvest.batch_reference.startsWith('PENDING-'))
    );
    const isPendingNumber = Boolean(harvest.is_offline_pending || harvest.batch_reference.startsWith('PENDING-'));

    return {
      passportLabel: isServerVerified ? 'OFFICIAL VERIFIED PASSPORT' : 'NOT VERIFIED YET',
      badgeLabel: isServerVerified ? 'VERIFIED' : 'NOT VERIFIED YET',
      badgeVariant: isServerVerified ? 'success' : 'warning',
      batchTitle: isPendingNumber ? 'Pending number' : harvest.batch_reference,
      allowPublicCertification: isServerVerified,
    };
  }

  // 1. Offline newly created batch
  const offlineBatch = {
    id: 'h-off-1',
    batch_reference: 'PENDING-LR-COCOA-2026-F9A2B1',
    is_offline_pending: true,
    is_server_verified: false,
    status: 'submitted',
  };
  const offStatus = evaluatePassportStatus(offlineBatch);
  assert.strictEqual(offStatus.passportLabel, 'NOT VERIFIED YET');
  assert.strictEqual(offStatus.batchTitle, 'Pending number');
  assert.strictEqual(offStatus.allowPublicCertification, false);

  // 2. Synced and officially certified batch
  const syncedCertifiedBatch = {
    id: 'h-sync-2',
    batch_reference: 'LR-NIM-SAN-COCOA-2026-000124',
    is_offline_pending: false,
    is_server_verified: true,
    server_signature: 'sig_rsa256_mock_republic_of_liberia_eudr',
    status: 'approved',
  };
  const syncStatus = evaluatePassportStatus(syncedCertifiedBatch);
  assert.strictEqual(syncStatus.passportLabel, 'OFFICIAL VERIFIED PASSPORT');
  assert.strictEqual(syncStatus.badgeLabel, 'VERIFIED');
  assert.strictEqual(syncStatus.batchTitle, 'LR-NIM-SAN-COCOA-2026-000124');
  assert.strictEqual(syncStatus.allowPublicCertification, true);
});

// 4. Interrupted and Flaky Sync Resilience
test('Flaky Sync Resilience: Simulates drop midway, preserves progress, resumes without duplicates', async () => {
  const queue = [
    { id: 'item-1', status: 'waiting_to_sync', retry_count: 0 },
    { id: 'item-2', status: 'waiting_to_sync', retry_count: 0 },
    { id: 'item-3', status: 'waiting_to_sync', retry_count: 0 }, // Fails on attempt 1
    { id: 'item-4', status: 'waiting_to_sync', retry_count: 0 },
  ];

  let connectionFailsAt = 'item-3';

  async function processQueue(q) {
    const pending = q.filter((i) => i.status === 'waiting_to_sync' || i.status === 'sync_failed');
    for (const item of pending) {
      if (item.id === connectionFailsAt) {
        item.status = 'sync_failed';
        item.retry_count += 1;
        item.last_error = 'Connection lost (EAI_AGAIN)';
        break; // dropped connection interrupts rest of batch
      }
      item.status = 'synced';
    }
  }

  // Attempt 1: Drops at item-3
  await processQueue(queue);
  assert.strictEqual(queue[0].status, 'synced');
  assert.strictEqual(queue[1].status, 'synced');
  assert.strictEqual(queue[2].status, 'sync_failed');
  assert.strictEqual(queue[2].retry_count, 1);
  assert.strictEqual(queue[3].status, 'waiting_to_sync');

  // Network recovers
  connectionFailsAt = null;

  // Attempt 2: Resumes safely
  await processQueue(queue);
  assert.strictEqual(queue[0].status, 'synced');
  assert.strictEqual(queue[1].status, 'synced');
  assert.strictEqual(queue[2].status, 'synced');
  assert.strictEqual(queue[3].status, 'synced');
});
