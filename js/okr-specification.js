export const OKR_CATEGORIES = Object.freeze(['Strategic', 'Operational Improvement', 'Learning & Development', 'Fun']);
export const OKR_LEVELS = Object.freeze(['Group', 'Country', 'Team', 'Individual']);
export const OKR_COMMITMENTS = Object.freeze(['Committed', 'Aspirational', 'Stretched']);

const ARRAY_FIELDS = ['services', 'stakeholders'];
const INSIGHT_FIELDS = ['assumptions', 'tensions', 'successSignals', 'perspectives'];

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/) : [];
    return [...new Set(values.map(cleanText).filter(Boolean))];
}

function allowed(value, options) {
    return options.includes(value) ? value : '';
}

export function normalizeOkrSpecification(specification = {}) {
    const context = specification.context || {};
    return {
        category: allowed(specification.category, OKR_CATEGORIES),
        level: allowed(specification.level, OKR_LEVELS),
        commitment: allowed(specification.commitment, OKR_COMMITMENTS),
        context: {
            industry: cleanText(context.industry),
            services: cleanList(context.services),
            geography: cleanText(context.geography),
            businessUnit: cleanText(context.businessUnit),
            stakeholders: cleanList(context.stakeholders),
            timeHorizon: cleanText(context.timeHorizon)
        },
        outcomeThesis: cleanText(specification.outcomeThesis),
        rationale: cleanText(specification.rationale),
        assumptions: cleanList(specification.assumptions),
        tensions: cleanList(specification.tensions),
        successSignals: cleanList(specification.successSignals),
        perspectives: cleanList(specification.perspectives),
        derivedAt: cleanText(specification.derivedAt),
        source: cleanText(specification.source) || 'agent'
    };
}

export function resolveObjectiveSpecification(setSpecification, objectiveSpecification = {}) {
    const inherited = normalizeOkrSpecification(setSpecification);
    const override = normalizeOkrSpecification(objectiveSpecification);
    const effective = {
        ...inherited,
        category: override.category || inherited.category,
        level: override.level || inherited.level,
        commitment: override.commitment || inherited.commitment,
        context: { ...inherited.context },
        outcomeThesis: override.outcomeThesis || inherited.outcomeThesis,
        rationale: override.rationale || inherited.rationale,
        source: override.source || inherited.source
    };
    ARRAY_FIELDS.forEach(field => {
        effective.context[field] = override.context[field].length ? override.context[field] : inherited.context[field];
    });
    ['industry', 'geography', 'businessUnit', 'timeHorizon'].forEach(field => {
        effective.context[field] = override.context[field] || inherited.context[field];
    });
    INSIGHT_FIELDS.forEach(field => {
        effective[field] = override[field].length ? override[field] : inherited[field];
    });
    effective.overrides = {
        category: Boolean(override.category),
        level: Boolean(override.level),
        commitment: Boolean(override.commitment),
        context: Object.values(override.context).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value)),
        insights: INSIGHT_FIELDS.some(field => override[field].length > 0) || Boolean(override.outcomeThesis || override.rationale)
    };
    return effective;
}

export function hasOkrSpecification(specification) {
    const normalized = normalizeOkrSpecification(specification);
    return Boolean(
        normalized.category || normalized.level || normalized.commitment ||
        normalized.outcomeThesis || normalized.rationale ||
        Object.values(normalized.context).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value))
    );
}
