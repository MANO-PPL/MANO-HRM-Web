import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOrgStatus } from '../src/modules/organisations/orgAccessPolicy.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

test('no subscription expiry: stored status is used', () => {
    assert.deepEqual(evaluateOrgStatus({ status: 'active' }), { status: 'active', isExpired: false });
    assert.deepEqual(evaluateOrgStatus({ status: 'pending_approval', subscription_expiry: null }), { status: 'pending_approval', isExpired: false });
});

test('expired but within the grace period: still active', () => {
    const org = { status: 'active', subscription_expiry: daysAgo(3), grace_period_days: 7 };
    assert.deepEqual(evaluateOrgStatus(org), { status: 'active', isExpired: false });
});

test('expired beyond the grace period: inactive', () => {
    const org = { status: 'active', subscription_expiry: daysAgo(10), grace_period_days: 7 };
    assert.deepEqual(evaluateOrgStatus(org), { status: 'inactive', isExpired: true });
    assert.equal(evaluateOrgStatus({ status: 'active', subscription_expiry: daysAgo(2) }).isExpired, true, 'no grace period');
});
