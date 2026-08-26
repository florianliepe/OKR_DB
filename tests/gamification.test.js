import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrivateMomentum, buildTeamLevelBoard, calculateMomentum } from '../js/gamification.js';

const now = new Date('2026-08-26T12:00:00Z');
const kr = (confidence = 'On Track', dates = ['2026-08-20', '2026-08-25']) => ({ confidence, history: dates.map((date, index) => ({ date, value: index + 1, confidence })) });

test('momentum rewards evidence, cadence, focus, risk follow-through, and context', () => {
    const result = calculateMomentum([{ keyResults: [kr('At Risk'), kr()] }], { now, hasDeepDive: true });
    assert.equal(result.score, 100);
    assert.equal(result.level.name, 'Outcome Leader');
    assert.equal(result.followedRisks, 1);
    assert.ok(result.badges.some(badge => badge.name === 'Risk navigator'));
});

test('team board is normalized and ranked by meaningful behavior', () => {
    const project = {
        name: 'Workspace', companyName: 'Group',
        cycles: [{ id: 'cycle', status: 'Active', okrSpecification: { category: 'Strategic' } }],
        teams: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
        objectives: [
            { cycleId: 'cycle', ownerId: 'a', keyResults: [kr(), kr()] },
            { cycleId: 'cycle', ownerId: 'b', keyResults: [kr('On Track', ['2026-06-01'])] }
        ]
    };
    const board = buildTeamLevelBoard(project, now);
    assert.equal(board[0].ownerName, 'Alpha');
    assert.equal(board[0].rank, 1);
    assert.ok(board[0].score > board[1].score);
});

test('private momentum only includes objectives assigned to the signed-in user', () => {
    const project = {
        cycles: [{ id: 'cycle', status: 'Active' }],
        objectives: [
            { cycleId: 'cycle', responsible: 'alex@example.com', keyResults: [kr()] },
            { cycleId: 'cycle', responsible: 'Other person', keyResults: [kr()] }
        ]
    };
    const result = buildPrivateMomentum(project, { email: 'alex@example.com' }, now);
    assert.equal(result.matched, true);
    assert.equal(result.objectiveCount, 1);
});

test('explicit activity events attribute check-ins and risk resolution to the actor', () => {
    const project = {
        cycles: [{ id: 'cycle', status: 'Active', okrSpecification: { category: 'Strategic' } }],
        activityEvents: [
            { type: 'kr_check_in', actorId: 'user-1', cycleId: 'cycle', ownerId: 'team', objectiveId: 'objective', occurredAt: '2026-08-25T10:00:00Z' },
            { type: 'risk_resolved', actorId: 'user-1', cycleId: 'cycle', ownerId: 'team', objectiveId: 'objective', occurredAt: '2026-08-25T10:01:00Z' },
            { type: 'deep_dive_completed', actorId: 'user-1', cycleId: 'cycle', ownerId: 'company', occurredAt: '2026-08-24T10:00:00Z' }
        ],
        objectives: [{ id: 'objective', cycleId: 'cycle', ownerId: 'team', responsible: '', keyResults: [kr('On Track', ['2026-08-25'])] }]
    };
    const result = buildPrivateMomentum(project, { uid: 'user-1' }, now);
    assert.equal(result.matched, true);
    assert.equal(result.recentCheckIns, 1);
    assert.equal(result.riskResolutions, 1);
    assert.ok(result.badges.some(badge => badge.name === 'Risk navigator'));
});
