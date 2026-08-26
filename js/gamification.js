const LEVELS = Object.freeze([
    { min: 0, name: 'Explorer', icon: 'bi-compass' },
    { min: 25, name: 'Builder', icon: 'bi-bricks' },
    { min: 45, name: 'Navigator', icon: 'bi-signpost-split' },
    { min: 65, name: 'Catalyst', icon: 'bi-lightning-charge' },
    { min: 85, name: 'Outcome Leader', icon: 'bi-trophy' }
]);

function toDate(value) {
    const date = value ? new Date(String(value).includes('T') ? value : `${value}T12:00:00`) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
}

function daysBetween(later, earlier) {
    return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function latestHistory(keyResult) {
    return [...(keyResult.history || [])]
        .filter(entry => toDate(entry.date))
        .sort((a, b) => toDate(b.date) - toDate(a.date))[0] || null;
}

function hasDeepDiveContext(activeCycle) {
    const specification = activeCycle?.okrSpecification || {};
    return Boolean(specification.category || specification.outcomeThesis || specification.rationale);
}

function getLevel(score) {
    const currentIndex = LEVELS.findLastIndex(level => score >= level.min);
    const current = LEVELS[Math.max(0, currentIndex)];
    const next = LEVELS[currentIndex + 1] || null;
    return {
        ...current,
        number: currentIndex + 1,
        next,
        pointsToNext: next ? Math.max(0, next.min - score) : 0
    };
}

function calculateWeeklyStreak(history, now) {
    const weekKeys = new Set(history.map(entry => {
        const date = toDate(entry.date);
        if (!date) return null;
        const monday = new Date(date);
        const day = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - day);
        return monday.toISOString().slice(0, 10);
    }).filter(Boolean));
    let streak = 0;
    const cursor = new Date(now);
    const cursorDay = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - cursorDay);
    while (weekKeys.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
}

export function calculateMomentum(objectives = [], options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const hasDeepDive = Boolean(options.hasDeepDive);
    const keyResults = objectives.flatMap(objective => objective.keyResults || []);
    const history = keyResults.flatMap(keyResult => keyResult.history || []);
    const events = options.events || [];
    const checkInEvents = events.filter(event => event.type === 'kr_check_in' && toDate(event.occurredAt));
    const historicRecentCheckIns = history.filter(entry => {
        const date = toDate(entry.date);
        return date && daysBetween(now, date) >= 0 && daysBetween(now, date) <= 30;
    });
    const eventRecentCheckIns = checkInEvents.filter(event => {
        const date = toDate(event.occurredAt);
        return daysBetween(now, date) >= 0 && daysBetween(now, date) <= 30;
    });
    const recentCheckIns = checkInEvents.length ? eventRecentCheckIns : historicRecentCheckIns;
    const riskResolutions = events.filter(event => {
        const age = event.type === 'risk_resolved' && toDate(event.occurredAt) ? daysBetween(now, toDate(event.occurredAt)) : -1;
        return age >= 0 && age <= 30;
    }).length;
    const retrospectiveComplete = events.some(event => event.type === 'retrospective_completed');
    const recentlyUpdated = keyResults.filter(keyResult => {
        const latest = latestHistory(keyResult);
        const date = latest && toDate(latest.date);
        return date && daysBetween(now, date) >= 0 && daysBetween(now, date) <= 14;
    });
    const evidenceRich = keyResults.filter(keyResult => (keyResult.history || []).length >= 2);
    const wellFormed = objectives.filter(objective => {
        const count = objective.keyResults?.length || 0;
        return count >= 2 && count <= 5;
    });
    const risky = keyResults.filter(keyResult => ['At Risk', 'Off Track'].includes(keyResult.confidence));
    const followedRisks = risky.filter(keyResult => recentlyUpdated.includes(keyResult));

    const cadenceRatio = keyResults.length ? recentlyUpdated.length / keyResults.length : 0;
    const evidenceRatio = keyResults.length ? evidenceRich.length / keyResults.length : 0;
    const designRatio = objectives.length ? wellFormed.length / objectives.length : 0;
    const riskRatio = risky.length ? followedRisks.length / risky.length : cadenceRatio;
    const score = Math.round(
        cadenceRatio * 35 +
        evidenceRatio * 20 +
        designRatio * 20 +
        riskRatio * 15 +
        (hasDeepDive ? 10 : 0)
    );
    const level = getLevel(score);

    return {
        score,
        level,
        streak: calculateWeeklyStreak(checkInEvents.length ? checkInEvents.map(event => ({ date: event.occurredAt.slice(0, 10) })) : history, now),
        objectiveCount: objectives.length,
        keyResultCount: keyResults.length,
        recentCheckIns: recentCheckIns.length,
        freshKeyResults: recentlyUpdated.length,
        wellFormedObjectives: wellFormed.length,
        followedRisks: followedRisks.length,
        riskResolutions,
        riskCount: risky.length,
        badges: [
            hasDeepDive && { name: 'Context setter', icon: 'bi-compass', description: 'Completed an OKR Deep Dive' },
            recentCheckIns.length >= 3 && { name: 'Evidence builder', icon: 'bi-graph-up-arrow', description: 'Recorded three recent check-ins' },
            wellFormed.length > 0 && { name: 'Focus keeper', icon: 'bi-bullseye', description: 'Maintains focused OKR sets' },
            (riskResolutions > 0 || followedRisks.length > 0) && { name: 'Risk navigator', icon: 'bi-shield-check', description: riskResolutions > 0 ? 'Turned an exposed risk back on track' : 'Actively follows up exposed risks' },
            retrospectiveComplete && { name: 'Learning loop', icon: 'bi-journal-check', description: 'Captured reusable cycle learning' }
        ].filter(Boolean)
    };
}

export function buildTeamLevelBoard(project, now = new Date()) {
    const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active');
    if (!activeCycle) return [];
    const hasDeepDive = hasDeepDiveContext(activeCycle);
    const owners = [{ id: 'company', name: project.companyName || project.name }, ...(project.teams || [])];
    const cycleEvents = (project.activityEvents || []).filter(event => event.cycleId === activeCycle.id);
    const entries = owners.map(owner => {
        const objectives = (project.objectives || []).filter(objective => objective.cycleId === activeCycle.id && objective.ownerId === owner.id);
        if (!objectives.length) return null;
        const events = cycleEvents.filter(event => event.ownerId === owner.id);
        const ownerHasDeepDive = events.some(event => event.type === 'deep_dive_completed') || (!cycleEvents.length && owner.id === 'company' && hasDeepDive);
        return { ownerId: owner.id, ownerName: owner.name, ...calculateMomentum(objectives, { now, hasDeepDive: ownerHasDeepDive, events }) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || b.recentCheckIns - a.recentCheckIns || a.ownerName.localeCompare(b.ownerName));
    let previousScore = null;
    let previousRank = 0;
    return entries.map((entry, index) => {
        const rank = entry.score === previousScore ? previousRank : index + 1;
        previousScore = entry.score;
        previousRank = rank;
        return { ...entry, rank };
    });
}

export function buildPrivateMomentum(project, user = {}, now = new Date()) {
    const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active');
    if (!activeCycle) return null;
    const aliases = [user.email, user.displayName].filter(Boolean).map(value => value.trim().toLocaleLowerCase());
    const actorEvents = (project.activityEvents || []).filter(event => event.cycleId === activeCycle.id && event.actorId === user.uid);
    const objectives = (project.objectives || []).filter(objective => {
        if (objective.cycleId !== activeCycle.id) return false;
        const responsible = String(objective.responsible || '').trim().toLocaleLowerCase();
        return responsible && aliases.some(alias => responsible === alias || responsible.includes(alias) || alias.includes(responsible));
    });
    const actorHasDeepDive = actorEvents.some(event => event.type === 'deep_dive_completed') || (!(project.activityEvents || []).length && hasDeepDiveContext(activeCycle));
    return {
        matched: objectives.length > 0 || actorEvents.length > 0,
        ...calculateMomentum(objectives, { now, hasDeepDive: actorHasDeepDive, events: actorEvents })
    };
}

export { LEVELS };
