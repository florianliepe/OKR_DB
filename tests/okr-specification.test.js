import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOkrSpecification, normalizeOkrSpecification, resolveObjectiveSpecification } from '../js/okr-specification.js';

test('normalizes agent-derived specification values', () => {
    const result = normalizeOkrSpecification({
        category: 'Strategic', level: 'Team', commitment: 'Aspirational',
        context: { industry: ' Consulting ', services: 'AI, Transformation\nAI', stakeholders: ['Board', ' Delivery '] }
    });
    assert.equal(result.context.industry, 'Consulting');
    assert.deepEqual(result.context.services, ['AI', 'Transformation']);
    assert.deepEqual(result.context.stakeholders, ['Board', 'Delivery']);
});

test('inherits the set specification and applies objective overrides', () => {
    const result = resolveObjectiveSpecification(
        { category: 'Strategic', level: 'Group', commitment: 'Committed', context: { industry: 'Consulting', services: ['AI'] } },
        { level: 'Team', context: { services: ['Data'] } }
    );
    assert.equal(result.category, 'Strategic');
    assert.equal(result.level, 'Team');
    assert.deepEqual(result.context.services, ['Data']);
    assert.equal(result.context.industry, 'Consulting');
    assert.equal(result.overrides.level, true);
    assert.equal(result.overrides.category, false);
});

test('detects whether a usable specification exists', () => {
    assert.equal(hasOkrSpecification({}), false);
    assert.equal(hasOkrSpecification({ context: { industry: 'Transportation' } }), true);
});
