import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectContext, parseChatResponse } from '../js/chat-service.js';

test('parses a standard n8n output response', () => {
    assert.deepEqual(parseChatResponse({ output: 'Focus on the customer outcome.' }), {
        message: 'Focus on the customer outcome.', actions: []
    });
});

test('extracts a supported OKR action and removes it from display text', () => {
    const response = parseChatResponse({ output: 'Here is a measurable draft.\n\n```okr_action\n{"type":"create_objective","label":"Review draft","payload":{"title":"Improve retention","ownerId":"company"}}\n```' });
    assert.equal(response.message, 'Here is a measurable draft.');
    assert.equal(response.actions.length, 1);
    assert.equal(response.actions[0].type, 'create_objective');
    assert.equal(response.actions[0].payload.ownerId, 'company');
});

test('ignores unsupported action types', () => {
    const response = parseChatResponse('```okr_action\n{"type":"delete_objective","payload":{"id":"obj-1"}}\n```');
    assert.deepEqual(response.actions, []);
});

test('accepts an agent-derived OKR set specification action', () => {
    const response = parseChatResponse('```okr_action\n{"type":"define_okr_set","payload":{"cycleId":"q1","specification":{"category":"Strategic"}}}\n```');
    assert.equal(response.actions[0].type, 'define_okr_set');
    assert.equal(response.actions[0].payload.specification.category, 'Strategic');
});

test('builds bounded context for the active cycle', () => {
    const context = buildProjectContext({
        name: 'Transformation', companyName: 'Eraneos',
        cycles: [{ id: 'q1', name: 'Q1', status: 'Active', okrSpecification: { category: 'Strategic', level: 'Group' } }, { id: 'q2', name: 'Q2', status: 'Draft' }],
        teams: [{ id: 'team-a', name: 'Team A' }],
        objectives: [
            { id: 'obj-1', cycleId: 'q1', title: 'Active objective', keyResults: [] },
            { id: 'obj-2', cycleId: 'q2', title: 'Draft objective', keyResults: [] }
        ]
    });
    assert.equal(context.activeCycle.id, 'q1');
    assert.equal(context.activeCycle.okrSpecification.category, 'Strategic');
    assert.deepEqual(context.objectives.map(objective => objective.id), ['obj-1']);
});
