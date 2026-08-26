import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCycleMilestones, buildEngagementAnalytics, buildNotifications, buildTeamChallenges, buildWeeklyFocus } from '../js/engagement.js';

const now = new Date('2026-08-26T12:00:00Z');
const project = {
    companyName: 'Eraneos', foundation: { mission: 'Mission', vision: 'Vision' }, teams: [{ id: 'team', name: 'Team' }],
    cycles: [{ id: 'cycle', name: 'Q3', status: 'Active', endDate: '2026-09-02' }],
    objectives: [{ id: 'objective', cycleId: 'cycle', ownerId: 'team', responsible: 'person@example.com', title: 'Improve delivery', progress: 40, endDate: '2026-09-01', keyResults: [
        { id: 'risk', title: 'Reduce lead time', confidence: 'At Risk', history: [{ date: '2026-08-01', value: 4 }] },
        { id: 'fresh', title: 'Increase automation', confidence: 'On Track', history: [{ date: '2026-08-24', value: 60 }] }
    ] }],
    activityEvents: [{ type: 'kr_check_in', actorId: 'user', cycleId: 'cycle', ownerId: 'team', occurredAt: '2026-08-24T10:00:00Z' }]
};

test('weekly focus prioritizes exposed and stale evidence for the responsible user', () => {
    const result = buildWeeklyFocus(project, { email: 'person@example.com' }, now);
    assert.equal(result.personalized, true);
    assert.ok(result.items.slice(0, 3).some(item => item.type === 'risk'));
    assert.equal(new Set(result.items.map(item => item.keyResultId).filter(Boolean)).size, result.items.filter(item => item.keyResultId).length);
});

test('automatic team challenges expose transparent progress', () => {
    const challenges = buildTeamChallenges(project, now);
    assert.equal(challenges.length, 4);
    assert.equal(challenges.find(item => item.id === 'ownership').complete, true);
    assert.equal(challenges.find(item => item.id === 'evidence').current, 1);
});

test('cycle milestones and notifications point to the next useful ritual', () => {
    const milestones = buildCycleMilestones(project, now);
    assert.equal(milestones.find(item => item.id === 'define').complete, true);
    assert.equal(milestones.find(item => item.id === 'learn').complete, false);
    assert.ok(buildNotifications(project, { email: 'person@example.com' }, now).some(item => item.id === 'retrospective'));
});

test('engagement analytics aggregate meaningful outcomes without individual ranking', () => {
    const analytics = buildEngagementAnalytics(project, now);
    assert.equal(analytics.checkIns, 1);
    assert.equal(analytics.activeContributors, 1);
    assert.equal(analytics.staleKeyResults, 1);
    assert.equal('ranking' in analytics, false);
});
