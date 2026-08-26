function parseDate(value) {
    if (!value) return null;
    const date = new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(later, earlier) {
    return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function activeCycleFor(project) {
    return (project.cycles || []).find(cycle => cycle.status === 'Active');
}

function cycleObjectives(project, cycle) {
    return cycle ? (project.objectives || []).filter(objective => objective.cycleId === cycle.id) : [];
}

function latestHistory(keyResult) {
    return [...(keyResult.history || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}

function aliasesFor(user) {
    return [user.email, user.displayName].filter(Boolean).map(value => String(value).trim().toLocaleLowerCase());
}

function isMine(objective, user) {
    const responsible = String(objective.responsible || '').trim().toLocaleLowerCase();
    return Boolean(responsible && aliasesFor(user).some(alias => responsible === alias || responsible.includes(alias) || alias.includes(responsible)));
}

export function buildWeeklyFocus(project, user = {}, now = new Date()) {
    const cycle = activeCycleFor(project);
    if (!cycle) return { cycle: null, items: [], summary: { total: 0, urgent: 0 }, nextAction: 'Activate a cycle to start a weekly focus rhythm.' };
    const objectives = cycleObjectives(project, cycle);
    const mine = objectives.filter(objective => isMine(objective, user));
    const scope = mine.length ? mine : objectives;
    const items = [];
    scope.forEach(objective => {
        const keyResults = objective.keyResults || [];
        if (!objective.responsible) items.push({ id: `owner-${objective.id}`, type: 'design', priority: 3, objectiveId: objective.id, title: objective.title, reason: 'Assign a responsible person', action: 'Complete ownership' });
        if (keyResults.length < 2 || keyResults.length > 5) items.push({ id: `design-${objective.id}`, type: 'design', priority: 3, objectiveId: objective.id, title: objective.title, reason: `${keyResults.length} Key Results defined`, action: 'Focus the outcome evidence' });
        keyResults.forEach(keyResult => {
            const latest = latestHistory(keyResult);
            const latestDate = parseDate(latest?.date);
            const age = latestDate ? daysBetween(now, latestDate) : Infinity;
            const exposed = ['At Risk', 'Off Track'].includes(keyResult.confidence);
            if (exposed) items.push({ id: `risk-${keyResult.id}`, type: 'risk', priority: keyResult.confidence === 'Off Track' ? 0 : 1, objectiveId: objective.id, keyResultId: keyResult.id, title: keyResult.title, reason: `${keyResult.confidence} · ${latestDate ? `${age} days since evidence` : 'no evidence recorded'}`, action: 'Add evidence or response' });
            else if (age > 7) items.push({ id: `stale-${keyResult.id}`, type: 'evidence', priority: age > 14 ? 1 : 2, objectiveId: objective.id, keyResultId: keyResult.id, title: keyResult.title, reason: latestDate ? `${age} days since evidence` : 'No evidence recorded', action: 'Check in with evidence' });
        });
        const endDate = parseDate(objective.endDate);
        const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;
        if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && Number(objective.progress || 0) < 80) items.push({ id: `deadline-${objective.id}`, type: 'deadline', priority: 1, objectiveId: objective.id, title: objective.title, reason: `${daysLeft} days left · ${Math.round(objective.progress || 0)}% progress`, action: 'Review delivery plan' });
    });
    items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
    const nextAction = items[0]?.action || (mine.length ? 'Keep the weekly evidence rhythm going.' : 'Assign yourself as responsible for an Objective to personalize this list.');
    return { cycle, personalized: mine.length > 0, items, nextAction, summary: { total: items.length, urgent: items.filter(item => item.priority <= 1).length } };
}

export function buildTeamChallenges(project, now = new Date()) {
    const cycle = activeCycleFor(project);
    const objectives = cycleObjectives(project, cycle);
    const keyResults = objectives.flatMap(objective => objective.keyResults || []);
    const fresh = keyResults.filter(keyResult => {
        const date = parseDate(latestHistory(keyResult)?.date);
        return date && daysBetween(now, date) >= 0 && daysBetween(now, date) <= 7;
    }).length;
    const exposed = keyResults.filter(keyResult => ['At Risk', 'Off Track'].includes(keyResult.confidence));
    const followed = exposed.filter(keyResult => {
        const date = parseDate(latestHistory(keyResult)?.date);
        return date && daysBetween(now, date) >= 0 && daysBetween(now, date) <= 7;
    }).length;
    const owned = objectives.filter(objective => objective.responsible).length;
    const focused = objectives.filter(objective => (objective.keyResults || []).length >= 2 && objective.keyResults.length <= 5).length;
    const challenge = (id, title, detail, current, target) => ({ id, title, detail, current, target, percent: target ? Math.min(100, Math.round(current / target * 100)) : 100, complete: target === 0 || current >= target });
    return [
        challenge('evidence', 'Fresh evidence week', 'Update every Key Result with current evidence.', fresh, keyResults.length),
        challenge('risk', 'Risks have responses', 'Every exposed risk has a current evidence response.', followed, exposed.length),
        challenge('ownership', 'Clear ownership', 'Every Objective has a responsible person.', owned, objectives.length),
        challenge('focus', 'Focused design', 'Keep each Objective to two–five measurable Key Results.', focused, objectives.length)
    ];
}

export function buildCycleMilestones(project, now = new Date()) {
    const cycle = activeCycleFor(project);
    const objectives = cycleObjectives(project, cycle);
    const keyResults = objectives.flatMap(objective => objective.keyResults || []);
    const defineDone = objectives.length > 0 && objectives.every(objective => objective.responsible && (objective.keyResults || []).length >= 2);
    const alignDone = defineDone && Boolean(project.foundation?.mission) && Boolean(project.foundation?.vision);
    const executeDone = alignDone && keyResults.length > 0 && keyResults.every(keyResult => {
        const date = parseDate(latestHistory(keyResult)?.date);
        const age = date ? daysBetween(now, date) : -1;
        return age >= 0 && age <= 14;
    });
    const reviewDone = executeDone && objectives.every(objective => Number(objective.progress || 0) >= 80);
    const learnDone = reviewDone && Boolean(cycle?.retrospective?.completedAt);
    const definitions = [['define','Define','Focused, owned OKRs',defineDone],['align','Align','Direction and ownership connected',alignDone],['execute','Execute','Evidence is current',executeDone],['review','Review','Outcomes reviewed',reviewDone],['learn','Learn','Retrospective captured',learnDone]];
    const firstIncomplete = definitions.findIndex(([, , , complete]) => !complete);
    return definitions.map(([id, title, detail, complete], index) => ({ id, title, detail, complete, current: !complete && index === firstIncomplete }));
}

export function buildLearningFeed(project, limit = 12) {
    const cycle = activeCycleFor(project);
    const ownerNames = new Map([['company', project.companyName || project.name], ...(project.teams || []).map(team => [team.id, team.name])]);
    const objectiveNames = new Map((project.objectives || []).map(objective => [objective.id, objective.title]));
    const labels = {
        risk_resolved: ['bi-shield-check','Risk moved back on track'],
        deep_dive_completed: ['bi-compass','OKR context completed'],
        retrospective_completed: ['bi-journal-check','Cycle learning captured'],
        objective_completed: ['bi-flag','Objective reached its target'],
        comment_added: ['bi-chat-left-text','A learning note was shared']
    };
    return (project.activityEvents || []).filter(event => event.cycleId === cycle?.id && labels[event.type]).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, limit).map(event => ({
        ...event, icon: labels[event.type][0], title: labels[event.type][1], ownerName: ownerNames.get(event.ownerId) || 'Workspace', objectiveTitle: objectiveNames.get(event.objectiveId) || '', occurredAt: parseDate(event.occurredAt)
    }));
}

export function buildEngagementAnalytics(project, now = new Date()) {
    const cycle = activeCycleFor(project);
    const events = (project.activityEvents || []).filter(event => event.cycleId === cycle?.id);
    const objectives = cycleObjectives(project, cycle);
    const keyResults = objectives.flatMap(objective => objective.keyResults || []);
    const recentEvents = events.filter(event => {
        const date = parseDate(event.occurredAt);
        return date && daysBetween(now, date) >= 0 && daysBetween(now, date) <= 30;
    });
    const stale = keyResults.filter(keyResult => {
        const date = parseDate(latestHistory(keyResult)?.date);
        return !date || daysBetween(now, date) > 14;
    }).length;
    const resolved = recentEvents.filter(event => event.type === 'risk_resolved').length;
    const checkIns = recentEvents.filter(event => event.type === 'kr_check_in').length;
    const activeContributors = new Set(recentEvents.map(event => event.actorId).filter(Boolean)).size;
    return { checkIns, resolvedRisks: resolved, staleKeyResults: stale, activeContributors, retrospectiveComplete: Boolean(cycle?.retrospective?.completedAt), cycleId: cycle?.id || null };
}

export function buildNotifications(project, user = {}, now = new Date()) {
    const focus = buildWeeklyFocus(project, user, now);
    const challenges = buildTeamChallenges(project, now);
    const notifications = [];
    if (focus.summary.urgent) notifications.push({ id: 'urgent-focus', tone: 'warning', icon: 'bi-exclamation-circle', title: `${focus.summary.urgent} urgent focus item${focus.summary.urgent === 1 ? '' : 's'}`, detail: focus.nextAction, href: '#weekly-focus' });
    const incomplete = challenges.filter(challenge => !challenge.complete);
    if (incomplete.length) notifications.push({ id: 'team-challenges', tone: 'info', icon: 'bi-people', title: `${incomplete.length} team challenge${incomplete.length === 1 ? '' : 's'} in progress`, detail: incomplete[0].title, href: '#weekly-focus' });
    const cycle = activeCycleFor(project);
    const endDate = parseDate(cycle?.endDate);
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && !cycle?.retrospective?.completedAt) notifications.push({ id: 'retrospective', tone: 'info', icon: 'bi-journal-text', title: 'Prepare the cycle retrospective', detail: `${daysLeft} days remain in ${cycle.name}.`, href: '#cycles' });
    return notifications;
}
