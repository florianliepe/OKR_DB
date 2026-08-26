import { hasOkrSpecification, normalizeOkrSpecification, OKR_CATEGORIES, OKR_COMMITMENTS, OKR_LEVELS, resolveObjectiveSpecification } from './okr-specification.js';
import { buildPrivateMomentum, buildTeamLevelBoard } from './gamification.js';
import { buildCycleMilestones, buildEngagementAnalytics, buildLearningFeed, buildNotifications, buildTeamChallenges, buildWeeklyFocus } from './engagement.js';

export class UI {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.modalContainer = document.getElementById('modal-container');
        this.modals = {};
        this.modalReturnFocus = {};
    }

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toastId = `toast-${Date.now()}`;
        const toastColorClasses = { success: 'bg-success text-white', danger: 'bg-danger text-white', warning: 'bg-warning text-dark', info: 'bg-info text-white' };
        const toastClass = toastColorClasses[type] || 'bg-secondary text-white';
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center ${toastClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>`;
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        toast.show();
    }

    _highlightText(text, searchTerm) {
        if (!searchTerm || !text) return text;
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return text.replace(regex, `<mark>$1</mark>`);
    }

    _getOrInitModal(id) {
        if (!this.modals[id]) {
            const modalEl = document.getElementById(id);
            if (modalEl) this.modals[id] = new bootstrap.Modal(modalEl);
        }
        return this.modals[id];
    }
    
    showModal(id) {
        const modalElement = document.getElementById(id);
        if (modalElement && !modalElement.classList.contains('show')) {
            this.modalReturnFocus[id] = document.activeElement;
            modalElement.addEventListener('hidden.bs.modal', () => {
                const target = this.modalReturnFocus[id];
                if (target?.isConnected) target.focus();
                delete this.modalReturnFocus[id];
            }, { once: true });
        }
        this._getOrInitModal(id)?.show();
    }
    hideModal(id) { this._getOrInitModal(id)?.hide(); }

    openCommandPalette() {
        const input = document.getElementById('command-palette-input');
        if (input) input.value = '';
        this.filterCommandPalette('');
        this.showModal('commandPaletteModal');
        setTimeout(() => input?.focus(), 180);
    }

    filterCommandPalette(query = '') {
        const normalized = query.trim().toLocaleLowerCase();
        document.querySelectorAll('.command-item').forEach(item => {
            item.hidden = Boolean(normalized && !item.dataset.search.includes(normalized));
        });
        document.querySelectorAll('.command-group').forEach(group => {
            group.hidden = !group.querySelector('.command-item:not([hidden])');
        });
    }

    setManageNavigation(expanded) {
        const toggle = document.getElementById('manage-nav-toggle');
        const items = document.getElementById('manage-nav-items');
        if (!toggle || !items) return;
        toggle.setAttribute('aria-expanded', String(expanded));
        items.hidden = !expanded;
    }

    renderNotificationCenter(project, user = {}, preferences = {}) {
        const panel = document.getElementById('notification-panel');
        const counter = document.getElementById('notification-count');
        if (!panel || !counter) return;
        const escape = value => this._escapeHtml(value || '');
        const enabled = preferences?.inAppNotifications !== false;
        const notifications = enabled ? buildNotifications(project, user) : [];
        counter.textContent = String(notifications.length);
        counter.hidden = notifications.length === 0;
        panel.innerHTML = `<header><div><p class="eyebrow">In-app only</p><h2>Notifications</h2></div><button type="button" class="btn-close" id="notification-close" aria-label="Close notifications"></button></header>
            ${preferences?.weeklySummary !== false ? `<section class="notification-summary"><i class="bi bi-calendar-check"></i><div><strong>Weekly summary</strong><p>${notifications.length ? `${notifications.length} useful prompt${notifications.length === 1 ? '' : 's'} for this week.` : 'Your current cycle has no urgent prompts.'}</p></div></section>` : ''}
            <div class="notification-list">${enabled ? (notifications.length ? notifications.map(item => `<a href="${item.href}" class="notification-item notification-item--${item.tone}"><i class="bi ${item.icon}"></i><span><strong>${escape(item.title)}</strong><small>${escape(item.detail)}</small></span><i class="bi bi-arrow-right"></i></a>`).join('') : '<div class="notification-empty"><i class="bi bi-check2-circle"></i><strong>You are caught up</strong><small>New prompts appear only when a meaningful action is due.</small></div>') : '<div class="notification-empty"><i class="bi bi-bell-slash"></i><strong>Notifications are paused</strong><small>Change your preference in Settings.</small></div>'}</div>
            <footer><a href="#settings">Notification preferences</a></footer>`;
    }

    toggleNotificationCenter(force) {
        const panel = document.getElementById('notification-panel');
        const trigger = document.getElementById('notification-trigger');
        if (!panel || !trigger) return;
        const open = force ?? panel.hidden;
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        if (open) panel.querySelector('.btn-close')?.focus();
        else trigger.focus();
    }

    renderWeeklyFocusView(project, user = {}) {
        const view = document.getElementById('weekly-focus-view');
        if (!view) return;
        const escape = value => this._escapeHtml(value || '');
        const focus = buildWeeklyFocus(project, user);
        const challenges = buildTeamChallenges(project);
        const milestones = buildCycleMilestones(project);
        const learning = buildLearningFeed(project, 8);
        if (!focus.cycle) {
            view.innerHTML = '<section class="purpose-empty"><i class="bi bi-calendar-plus"></i><h2>Start a weekly rhythm</h2><p>Activate a cycle to receive evidence-based focus prompts.</p><a href="#cycles" class="btn btn-primary">Manage cycles</a></section>';
            return;
        }
        const focusIcon = { risk: 'bi-exclamation-triangle', evidence: 'bi-graph-up', deadline: 'bi-calendar-event', design: 'bi-bullseye' };
        view.innerHTML = `<div class="view-intro"><div><p class="eyebrow">${escape(focus.cycle.name)} · private focus</p><h2>Your useful week</h2><p>${focus.personalized ? 'Prioritized from the Objectives assigned to you.' : 'Workspace signals are shown until an Objective is assigned to you.'}</p></div><span class="view-intro__meta">${focus.summary.urgent} urgent · ${focus.summary.total} total</span></div>
            <section class="focus-hero"><div><p class="eyebrow">Best next move</p><h3>${escape(focus.nextAction)}</h3></div><a href="#explorer" class="btn btn-primary">Open Objectives</a></section>
            <div class="engagement-grid"><section class="focus-queue"><header><div><p class="eyebrow">Private action queue</p><h3>Work requiring attention</h3></div></header>${focus.items.length ? focus.items.slice(0, 12).map(item => `<button type="button" class="focus-item open-okr-detail" data-objective-id="${item.objectiveId}" data-kr-id="${item.keyResultId || ''}"><i class="bi ${focusIcon[item.type]}"></i><span><strong>${escape(item.title)}</strong><small>${escape(item.reason)}</small></span><em>${escape(item.action)}</em><i class="bi bi-arrow-right"></i></button>`).join('') : '<div class="focus-clear"><i class="bi bi-check2-circle"></i><strong>No work is being hidden</strong><p>Your evidence, ownership, risks, and deadlines are current.</p></div>'}</section>
                <section class="challenge-board"><header><p class="eyebrow">Automatic team challenges</p><h3>Improve together</h3><p>Shared practice—not individual competition.</p></header>${challenges.map(challenge => `<article><div><strong>${escape(challenge.title)}</strong><small>${escape(challenge.detail)}</small></div><span>${challenge.current}/${challenge.target}</span><div class="challenge-progress"><i style="width:${challenge.percent}%"></i></div>${challenge.complete ? '<b><i class="bi bi-check2"></i> Complete</b>' : ''}</article>`).join('')}</section></div>
            <section class="cycle-path"><header><p class="eyebrow">Cycle milestones</p><h3>Define → align → execute → review → learn</h3></header><div>${milestones.map((milestone, index) => `<article class="${milestone.complete ? 'is-complete' : ''} ${milestone.current ? 'is-current' : ''}"><span>${milestone.complete ? '<i class="bi bi-check2"></i>' : index + 1}</span><strong>${milestone.title}</strong><small>${milestone.detail}</small></article>`).join('')}</div></section>
            <section class="learning-feed"><header><div><p class="eyebrow">Team learning feed</p><h3>Useful progress worth sharing</h3></div><a href="#cycles">Add retrospective</a></header>${learning.length ? learning.map(item => `<article><i class="bi ${item.icon}"></i><span><strong>${escape(item.title)}</strong><small>${escape(item.ownerName)}${item.objectiveTitle ? ` · ${escape(item.objectiveTitle)}` : ''}</small></span><time>${item.occurredAt ? item.occurredAt.toLocaleDateString() : ''}</time></article>`).join('') : '<div class="focus-clear"><i class="bi bi-journal-plus"></i><strong>Learning appears after meaningful outcomes</strong><p>Resolve a risk, complete context, reach an Objective, comment, or capture a retrospective.</p></div>'}</section>`;
    }

    openOkrDetail(project, objectiveId, keyResultId = '', userRole = 'viewer') {
        const objective = (project.objectives || []).find(item => item.id === objectiveId);
        const keyResult = objective?.keyResults?.find(item => item.id === keyResultId);
        const target = document.getElementById('okr-detail-content');
        if (!objective || !target) return;
        const escape = value => this._escapeHtml(value || '');
        const canEdit = ['owner', 'editor'].includes(userRole);
        const activeCycle = project.cycles?.find(cycle => cycle.id === objective.cycleId);
        const specification = resolveObjectiveSpecification(activeCycle?.okrSpecification, objective.specification);
        const dependencyNames = (objective.dependsOn || []).map(id => project.objectives?.find(item => item.id === id)?.title).filter(Boolean);
        const activeEvents = (project.activityEvents || []).filter(event => event.objectiveId === objective.id && (!keyResult || !event.keyResultId || event.keyResultId === keyResult.id)).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 12);
        const eventLabels = { kr_check_in: 'Evidence updated', risk_resolved: 'Risk moved back on track', objective_created: 'Objective created', key_result_created: 'Key Result created', objective_completed: 'Objective reached target', comment_added: 'Learning note added' };
        const comments = objective.comments || [];
        target.dataset.objectiveId = objective.id;
        target.innerHTML = `<header class="detail-hero"><div><p class="eyebrow">${keyResult ? 'Key Result' : 'Objective'} detail</p><h2>${escape(keyResult?.title || objective.title)}</h2><p>${escape(objective.responsible || 'No responsible person')} · ${Math.round(keyResult?.progress ?? objective.progress ?? 0)}% progress</p></div>${canEdit ? `<button type="button" class="btn btn-outline-primary ${keyResult ? 'detail-edit-kr' : 'detail-edit-objective'}" data-objective-id="${objective.id}" data-kr-id="${keyResult?.id || ''}">Edit</button>` : ''}</header>
            <nav class="detail-facts" aria-label="Outcome summary"><span><small>Health</small><strong>${escape(keyResult?.confidence || this._objectiveHealth(objective))}</strong></span><span><small>Owner</small><strong>${escape(this._ownerName(project, objective.ownerId))}</strong></span><span><small>Due</small><strong>${escape(objective.endDate || 'Not set')}</strong></span><span><small>Evidence</small><strong>${keyResult ? `${keyResult.currentValue} / ${keyResult.targetValue}` : `${objective.keyResults?.length || 0} KRs`}</strong></span></nav>
            <section class="detail-section"><h3>Context and measurement</h3><p>${escape(keyResult?.notes || objective.notes || 'No supporting context has been captured yet.')}</p></section>
            <section class="detail-section"><h3>Classification and dependencies</h3><div class="detail-chips"><span>${escape(specification.category || 'Category not inferred')}</span><span>${escape(specification.level || 'Level not inferred')}</span><span>${escape(specification.commitment || 'Commitment not inferred')}</span></div><p>${dependencyNames.length ? `Depends on: ${escape(dependencyNames.join(' · '))}` : 'No upstream dependencies recorded.'}</p></section>
            ${!keyResult ? `<section class="detail-section"><h3>Key Results</h3><div class="detail-kr-list">${(objective.keyResults || []).length ? objective.keyResults.map(item => `<button type="button" class="open-okr-detail" data-objective-id="${objective.id}" data-kr-id="${item.id}"><span><strong>${escape(item.title)}</strong><small>${escape(item.confidence || 'On Track')}</small></span><b>${Math.round(item.progress || 0)}%</b></button>`).join('') : '<p class="empty-copy">No Key Results defined.</p>'}</div></section>` : ''}
            <section class="detail-section"><h3>Activity</h3><ol class="detail-activity">${activeEvents.length ? activeEvents.map(event => `<li><i></i><span><strong>${escape(eventLabels[event.type] || 'Outcome updated')}</strong><small>${escape(new Date(event.occurredAt).toLocaleString())}</small></span></li>`).join('') : '<li><span class="empty-copy">No activity recorded yet.</span></li>'}</ol></section>
            <section class="detail-section"><h3>Learning notes</h3><div class="detail-comments">${comments.length ? comments.map(comment => `<article><p>${escape(comment.text)}</p><small>${escape(new Date(comment.createdAt).toLocaleString())}</small></article>`).join('') : '<p class="empty-copy">Share a decision, assumption, or reusable lesson.</p>'}</div>${canEdit ? `<form id="objective-comment-form"><input type="hidden" id="comment-objective-id" value="${objective.id}"><label class="form-label" for="objective-comment-text">Add a learning note</label><div class="input-group"><input class="form-control" id="objective-comment-text" maxlength="500" required><button class="btn btn-primary" type="submit">Share</button></div></form>` : ''}</section>`;
        this.showModal('okrDetailModal');
    }

    _ownerName(project, ownerId) {
        if (ownerId === 'company') return project.companyName || project.name;
        return project.teams?.find(team => team.id === ownerId)?.name || 'Unassigned';
    }

    _objectiveHealth(objective) {
        const confidences = (objective.keyResults || []).map(item => item.confidence);
        return confidences.includes('Off Track') ? 'Off Track' : confidences.includes('At Risk') ? 'At Risk' : 'On Track';
    }

    _escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    openObjectiveDraft(payload, project) {
        const form = document.getElementById('objective-form');
        if (!form || !project) return;
        form.reset();
        document.getElementById('objective-id').value = '';
        document.getElementById('objective-modal-title').textContent = 'Review objective draft';
        const owners = [{ id: 'company', name: project.companyName }, ...(project.teams || [])];
        const ownerSelect = document.getElementById('objective-owner');
        ownerSelect.innerHTML = owners.map(owner => `<option value="${owner.id}">${owner.name}</option>`).join('');
        ownerSelect.value = owners.some(owner => owner.id === payload.ownerId) ? payload.ownerId : 'company';
        const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active');
        const dependsOnSelect = document.getElementById('objective-depends-on');
        dependsOnSelect.innerHTML = (project.objectives || []).filter(objective => objective.cycleId === activeCycle?.id).map(objective => `<option value="${objective.id}">${objective.title}</option>`).join('');
        document.getElementById('objective-title').value = payload.title || '';
        document.getElementById('objective-notes').value = payload.notes || '';
        document.getElementById('objective-responsible').value = payload.responsible || '';
        document.getElementById('objective-start-date').value = payload.startDate || '';
        document.getElementById('objective-end-date').value = payload.endDate || '';
        form.dataset.specification = JSON.stringify(payload.specification || {});
        this.showModal('objectiveModal');
    }

    openKeyResultDraft(payload, project) {
        const form = document.getElementById('kr-form');
        const objective = (project?.objectives || []).find(item => item.id === payload.objectiveId);
        if (!form || !objective) {
            this.showToast('The suggested objective is no longer available.', 'warning');
            return;
        }
        form.reset();
        document.getElementById('kr-modal-title').textContent = 'Review key result draft';
        document.getElementById('kr-objective-id').value = objective.id;
        document.getElementById('kr-id').value = '';
        document.getElementById('kr-title').value = payload.title || '';
        document.getElementById('kr-start-value').value = payload.startValue ?? 0;
        document.getElementById('kr-current-value').value = payload.currentValue ?? 0;
        document.getElementById('kr-target-value').value = payload.targetValue ?? '';
        document.getElementById('kr-confidence').value = ['On Track', 'At Risk', 'Off Track'].includes(payload.confidence) ? payload.confidence : 'On Track';
        document.getElementById('kr-notes').value = payload.notes || '';
        this.showModal('keyResultModal');
    }

    openOkrSetDraft(payload, project) {
        const form = document.getElementById('okr-specification-form');
        const activeCycle = (project?.cycles || []).find(cycle => cycle.status === 'Active');
        if (!form || !activeCycle) {
            this.showToast('An active cycle is required before defining an OKR set.', 'warning');
            return;
        }
        const specification = normalizeOkrSpecification(payload.specification || payload);
        form.reset();
        document.getElementById('okr-spec-cycle-id').value = payload.cycleId || activeCycle.id;
        document.getElementById('okr-spec-category').value = specification.category;
        document.getElementById('okr-spec-level').value = specification.level;
        document.getElementById('okr-spec-commitment').value = specification.commitment;
        document.getElementById('okr-spec-industry').value = specification.context.industry;
        document.getElementById('okr-spec-services').value = specification.context.services.join('\n');
        document.getElementById('okr-spec-geography').value = specification.context.geography;
        document.getElementById('okr-spec-business-unit').value = specification.context.businessUnit;
        document.getElementById('okr-spec-stakeholders').value = specification.context.stakeholders.join('\n');
        document.getElementById('okr-spec-time-horizon').value = specification.context.timeHorizon;
        document.getElementById('okr-spec-outcome-thesis').value = specification.outcomeThesis;
        document.getElementById('okr-spec-rationale').value = specification.rationale;
        document.getElementById('okr-spec-assumptions').value = specification.assumptions.join('\n');
        document.getElementById('okr-spec-tensions').value = specification.tensions.join('\n');
        document.getElementById('okr-spec-success-signals').value = specification.successSignals.join('\n');
        document.getElementById('okr-spec-perspectives').value = specification.perspectives.join('\n');
        this.showModal('okrSpecificationModal');
    }

    _createSparklineSVG(history) {
        if (!history || history.length < 2) return '<div class="sparkline-placeholder"></div>';
        const width = 100, height = 20, strokeWidth = 2;
        const values = history.map(h => Number(h.value));
        const minY = Math.min(...values), maxY = Math.max(...values);
        const range = maxY - minY;
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = height - strokeWidth - (range === 0 ? (height - 2 * strokeWidth) / 2 : ((val - minY) / range) * (height - 2 * strokeWidth));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
        return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
    }

    renderProjectSwitcher(projects, userId) {
        const activeProjects = projects.filter(p => !p.isArchived);
        const archivedProjects = projects.filter(p => p.isArchived);
        const archivedSectionHtml = archivedProjects.length > 0 ? `
            <div class="col-12 text-center mt-5">
                <button class="btn btn-outline-secondary" id="toggle-archived-btn">
                    Show ${archivedProjects.length} Archived Project(s)
                </button>
            </div>
            <div id="archived-projects-container" class="col-12" style="display: none;">
                <hr class="my-5">
                <h4 class="text-center text-muted mb-4">Archived Projects</h4>
                <div class="row g-4 justify-content-center">
                    ${archivedProjects.map(p => this.renderProjectCard(p, userId)).join('')}
                </div>
            </div>
        ` : '';
        this.appContainer.innerHTML = `
            <main class="project-switcher">
                <a class="brand-lockup mb-5" href="https://www.eraneos.com/" aria-label="Eraneos home">
                    <span class="brand-wordmark">eraneos<span class="brand-mark"></span></span>
                    <span class="brand-product">OKR Cockpit</span>
                </a>
                <header class="project-switcher__header">
                    <div>
                        <p class="eyebrow mb-2">Strategy execution</p>
                        <h1>Choose where to focus next.</h1>
                    </div>
                    <p class="project-switcher__intro mb-0">Open an existing workspace or start a new OKR cycle with a shared view of outcomes, ownership, and delivery health.</p>
                </header>
                <div class="row g-4 justify-content-center" id="project-list">
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card project-card project-card--action h-100" id="create-new-project-card" role="button" tabindex="0">
                            <div class="card-body d-flex flex-column justify-content-between p-4">
                                <i class="bi bi-plus-lg fs-3 text-primary"></i>
                                <div><p class="eyebrow mb-2">New workspace</p><h2 class="card-title mb-0">Create an OKR project</h2></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-4">
                        <label for="import-project-input" class="card project-card project-card--action h-100">
                            <div class="card-body d-flex flex-column justify-content-between p-4">
                                <i class="bi bi-upload fs-3 text-primary"></i>
                                <div><p class="eyebrow mb-2">Restore</p><h2 class="card-title mb-0">Import a project backup</h2></div>
                                <input type="file" id="import-project-input" accept=".json" style="display: none;">
                            </div>
                        </label>
                    </div>
                    ${activeProjects.map(p => this.renderProjectCard(p, userId)).join('')}
                </div>
                <div class="row justify-content-center">
                    ${archivedSectionHtml}
                </div>
            </main>`;
        this.modalContainer.innerHTML = this.renderNewProjectModal();
    }

    renderProjectCard(project, userId) {
        const objectives = project.objectives || [];
        const cycles = project.cycles || [];
        const isOwner = project.members && project.members[userId] === 'owner';

        const ownerButtons = isOwner ? `
            <button class="btn btn-sm btn-outline-warning archive-project-btn" data-project-id="${project.id}" title="Archive"><i class="bi bi-archive"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-project-btn" data-project-id="${project.id}" data-project-name="${project.name}" title="Delete"><i class="bi bi-trash"></i></button>
        ` : '';
        
        const unarchiveButton = isOwner ? `<button class="btn btn-sm btn-outline-secondary unarchive-project-btn" data-project-id="${project.id}" title="Unarchive"><i class="bi bi-box-arrow-up"></i></button>` : '';

        const actionButtons = project.isArchived 
            ? unarchiveButton
            : `<button class="btn btn-sm btn-outline-secondary clone-project-btn" data-project-id="${project.id}" title="Clone"><i class="bi bi-copy"></i></button>
               ${ownerButtons}`;
        
        return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card project-card h-100" data-project-id="${project.id}">
                    <div class="card-body d-flex flex-column p-4">
                        <div class="d-flex justify-content-between align-items-start">
                             <h5 class="card-title mb-0">${project.name}</h5>
                             <div class="d-flex gap-2">
                                ${actionButtons}
                             </div>
                        </div>
                        <p class="project-card__meta flex-grow-1 mt-3">${objectives.length} objectives · ${cycles.length} cycles</p>
                        <button type="button" class="project-card__link btn p-0 align-self-start">Open cockpit <i class="bi bi-arrow-right ms-1"></i></button>
                    </div>
                </div>
            </div>`;
    }

    renderMainLayout(project, userRole, user = {}) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const isOwner = userRole === 'owner';
        this.modals = {};
        this.modalReturnFocus = {};
        this.appContainer.innerHTML = `
            <a class="skip-link" href="#main-workspace">Skip to main content</a>
            <div class="container-fluid g-0" id="app-shell">
                <div class="row g-0 vh-100">
                    <aside id="sidebar-col" class="col-auto">
                        <nav id="sidebar" class="d-flex flex-column h-100">
                            <a class="sidebar-brand text-decoration-none" href="https://www.eraneos.com/" aria-label="Eraneos home">
                                <span class="brand-wordmark">eraneos<span class="brand-mark"></span></span>
                                <span class="brand-product">OKR Cockpit</span>
                            </a>
                            <div class="sidebar-project"><span class="sidebar-project__label">Current workspace</span><span id="sidebar-project-name">${project.name}</span></div>
                            <ul class="nav nav-pills flex-column mb-auto">
                                <li><span class="nav-section-label">Focus</span></li>
                                <li class="nav-item"><a href="#dashboard" class="nav-link text-white" data-view="dashboard-view"><i class="bi bi-grid-1x2-fill me-2"></i> Overview</a></li>
                                <li class="nav-item"><a href="#weekly-focus" class="nav-link text-white" data-view="weekly-focus-view"><i class="bi bi-check2-square me-2"></i> Weekly Focus</a></li>
                                <li class="nav-item"><a href="#explorer" class="nav-link text-white" data-view="explorer-view"><i class="bi bi-bullseye me-2"></i> Objectives</a></li>
                                <li class="nav-item"><a href="#momentum" class="nav-link text-white" data-view="momentum-view"><i class="bi bi-lightning-charge-fill me-2"></i> Momentum</a></li>
                                <li class="nav-item"><a href="#cascade" class="nav-link text-white" data-view="cascade-view"><i class="bi bi-diagram-3-fill me-2"></i> Alignment</a></li>
                                <li><span class="nav-section-label">Plan & learn</span></li>
                                <li class="nav-item"><a href="#gantt" class="nav-link text-white" data-view="gantt-view"><i class="bi bi-calendar3 me-2"></i> Timeline</a></li>
                                <li class="nav-item"><a href="#risk-board" class="nav-link text-white" data-view="risk-board-view"><i class="bi bi-exclamation-triangle-fill me-2"></i> Risks</a></li>
                                <li class="nav-item"><a href="#deep-dive" class="nav-link text-white" data-view="deep-dive-view"><i class="bi bi-compass me-2"></i> Deep Dive</a></li>
                                <li class="nav-item"><a href="#workbench" class="nav-link text-white" data-view="workbench-view"><i class="bi bi-lightbulb-fill me-2"></i> Workbench</a></li>
                                <li><button type="button" class="nav-section-toggle" id="manage-nav-toggle" aria-expanded="false" aria-controls="manage-nav-items"><span>Manage</span><i class="bi bi-chevron-down"></i></button></li>
                                <li><div id="manage-nav-items" hidden>
                                    <a href="#cycles" class="nav-link text-white" data-view="cycles-view"><i class="bi bi-arrow-repeat me-2"></i> Cycles</a>
                                    ${isOwner ? `<a href="#settings" class="nav-link text-white" data-view="settings-view"><i class="bi bi-gear-fill me-2"></i> Settings</a>` : ''}
                                </div></li>
                            </ul>
                            <div class="sidebar-actions d-flex flex-column gap-2 pt-3">
                                <button class="btn btn-sm" id="export-project-btn"><i class="bi bi-download me-2"></i> Export project</button>
                                <button class="btn btn-sm" id="back-to-projects"><i class="bi bi-grid me-2"></i> All workspaces</button>
                                <button class="btn btn-sm btn-logout" id="logout-btn"><i class="bi bi-box-arrow-right me-2"></i> Sign out</button>
                            </div>
                        </nav>
                    </aside>
                    <button class="sidebar-backdrop" id="sidebar-backdrop" type="button" aria-label="Close navigation" hidden></button>
                    <div class="col p-0 d-flex flex-column main-content-col">
                        <nav class="navbar top-bar">
                            <div class="container-fluid">
                                <div class="d-flex align-items-center gap-2">
                                    <button type="button" class="btn btn-outline-secondary mobile-nav-toggle" id="sidebar-toggle" aria-label="Open navigation" aria-expanded="false"><i class="bi bi-list"></i></button>
                                    <span class="navbar-brand mb-0 h1" id="view-title"></span>
                                </div>
                                <button type="button" class="command-trigger" id="command-palette-trigger" aria-label="Open command palette"><i class="bi bi-search"></i><span>Search or jump to…</span><kbd>Ctrl K</kbd></button>
                                <button type="button" class="notification-trigger" id="notification-trigger" aria-label="Open notifications" aria-expanded="false"><i class="bi bi-bell"></i><span id="notification-count" hidden>0</span></button>
                                <div class="d-flex align-items-center gap-2" id="nav-controls">
                                    <input class="form-control" type="search" id="search-input" placeholder="Search objectives…" aria-label="Search objectives" style="width: 250px;">
                                    <div class="dropdown">
                                        <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" id="cycle-selector-btn" disabled></button>
                                        <ul class="dropdown-menu dropdown-menu-end" id="cycle-selector-list"></ul>
                                    </div>
                                    ${canEdit ? `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#objectiveModal" id="add-objective-btn"><i class="bi bi-plus-lg"></i> New objective</button>` : ''}
                                    <div class="dropdown"><button class="btn btn-outline-info" type="button" data-bs-toggle="dropdown" aria-label="Workspace actions"><i class="bi bi-three-dots"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button class="dropdown-item" data-bs-toggle="modal" data-bs-target="#shareProjectModal" id="share-project-btn"><i class="bi bi-people me-2"></i>Share workspace</button></li><li><button class="dropdown-item" type="button" id="topbar-export-project"><i class="bi bi-download me-2"></i>Export backup</button></li></ul></div>
                                </div>
                            </div>
                        </nav>
                        <main class="p-4 content-scroll-area" id="main-workspace" tabindex="-1">
                            <div id="dashboard-view" class="view-container" style="display:none;"></div>
                            <div id="weekly-focus-view" class="view-container" style="display:none;"></div>
                            <div id="momentum-view" class="view-container" style="display:none;"></div>
                            <div id="deep-dive-view" class="view-container" style="display:none;"></div>
                            <div id="explorer-view" class="view-container" style="display:none;"></div>
                            <div id="cascade-view" class="view-container" style="display:none;"></div>
                            <div id="workbench-view" class="view-container" style="display:none;"></div>
                            <div id="gantt-view" class="view-container" style="display:none;"></div>
                            <div id="risk-board-view" class="view-container" style="display:none;"></div>
                            <div id="cycles-view" class="view-container" style="display:none;"></div>
                            <div id="settings-view" class="view-container" style="display:none;"></div>
                        </main>
                    </div>
                </div>
                <button type="button" class="chat-launcher" id="okr-chat-launcher" aria-controls="okr-chat-panel" aria-expanded="false"><i class="bi bi-stars"></i><span>Ask OKR Coach</span></button>
                <section class="chat-panel" id="okr-chat-panel" aria-label="OKR Coach chat" hidden>
                    <header class="chat-panel__header">
                        <div><h2 class="chat-panel__title"><i class="bi bi-stars me-2"></i>OKR Coach</h2><p class="chat-panel__subtitle">Context-aware guidance for this workspace</p></div>
                        <div class="d-flex gap-1"><button type="button" class="btn" id="okr-chat-new" aria-label="Start a new chat" title="New chat"><i class="bi bi-arrow-clockwise"></i></button><button type="button" class="btn" id="okr-chat-close" aria-label="Close chat"><i class="bi bi-x-lg"></i></button></div>
                    </header>
                    <div class="chat-panel__messages" id="okr-chat-messages" aria-live="polite"></div>
                    <form class="chat-panel__form" id="okr-chat-form">
                        <div class="chat-panel__composer"><textarea class="form-control" id="okr-chat-input" rows="1" maxlength="4000" placeholder="Ask about your OKRs…" aria-label="Message OKR Coach" required></textarea><button class="btn btn-primary" id="okr-chat-submit" type="submit" aria-label="Send message"><i class="bi bi-arrow-up"></i></button></div>
                        <p class="chat-panel__privacy">Relevant project context is shared with the configured Eraneos n8n workflow.</p>
                    </form>
                </section>
                <aside class="notification-panel" id="notification-panel" aria-label="In-app notifications" aria-live="polite" hidden></aside>
            </div>`;
        this.modalContainer.innerHTML = `${this.renderObjectiveModal()}${this.renderKeyResultModal()}${this.renderOkrSpecificationModal()}${this.renderShareProjectModal()}${this.renderCommandPaletteModal(canEdit, isOwner, project)}${this.renderOkrDetailDrawer()}`;
        this.renderNotificationCenter(project, user, project.memberPreferences?.[user.uid]);
    }

    populateShareModal(members, isOwner) {
        const memberList = document.getElementById('project-members-list');
        const inviteForm = document.getElementById('invite-member-form');
        const ownerDisclaimer = document.getElementById('owner-disclaimer');

        if (!memberList) return;

        if (!isOwner) {
            memberList.innerHTML = members.map(member => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fw-bold">${member.email}</span><br>
                        <small class="text-capitalize text-muted">${member.role}</small>
                    </div>
                </li>
            `).join('');
            if(inviteForm) inviteForm.style.display = 'none';
            if(ownerDisclaimer) ownerDisclaimer.style.display = 'none';
        } else {
             memberList.innerHTML = members.map(member => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fw-bold">${member.email}</span><br>
                        <small class="text-capitalize text-muted">${member.role}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm member-role-select" data-uid="${member.uid}" ${member.role === 'owner' ? 'disabled' : ''}>
                            <option value="editor" ${member.role === 'editor' ? 'selected' : ''}>Editor</option>
                            <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                        </select>
                        <button class="btn btn-sm btn-outline-danger remove-member-btn" data-uid="${member.uid}" ${member.role === 'owner' ? 'disabled' : ''}><i class="bi bi-trash"></i></button>
                    </div>
                </li>
            `).join('');
            if(inviteForm) inviteForm.style.display = 'block';
            if(ownerDisclaimer) ownerDisclaimer.style.display = 'block';
        }
    }

    showView(viewId) {
        document.querySelectorAll('.view-container').forEach(v => v.style.display = 'none');
        document.querySelectorAll('#sidebar .nav-link').forEach(link => { link.classList.remove('active'); link.removeAttribute('aria-current'); });
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.style.display = 'block';
        const linkEl = document.querySelector(`[data-view="${viewId}"]`);
        if (linkEl) { linkEl.classList.add('active'); linkEl.setAttribute('aria-current', 'page'); }
        const isManageView = ['cycles-view', 'settings-view'].includes(viewId);
        this.setManageNavigation(isManageView || localStorage.getItem('okrManageExpanded') === 'true');
        const navControls = document.getElementById('nav-controls');
        const viewTitle = document.getElementById('view-title');
        
        const viewsWithNav = ['explorer-view', 'dashboard-view', 'gantt-view', 'risk-board-view'];
        if (viewsWithNav.includes(viewId)) {
            navControls.classList.remove('d-none');
            navControls.style.display = 'flex';
            document.getElementById('search-input').style.display = viewId === 'explorer-view' ? 'block' : 'none';
            document.querySelector('#nav-controls .dropdown').style.display = 'flex';
            const addObjectiveBtn = document.getElementById('add-objective-btn');
            if (addObjectiveBtn) addObjectiveBtn.style.display = 'block';
        } else {
            navControls.classList.add('d-none');
            navControls.style.display = 'none';
        }

        if (viewTitle) {
            const titles = {
                'dashboard-view': 'Overview',
                'weekly-focus-view': 'Weekly Focus',
                'momentum-view': 'Momentum',
                'deep-dive-view': 'Deep Dive',
                'explorer-view': 'Objectives',
                'cascade-view': 'Alignment',
                'workbench-view': 'Workbench',
                'gantt-view': 'Timeline',
                'risk-board-view': 'Risks',
                'cycles-view': 'Cycles',
                'settings-view': 'Project Settings'
            };
            viewTitle.textContent = titles[viewId] || '';
        }
    }

    renderWorkbenchView(items = [], userRole) {
        const view = document.getElementById('workbench-view');
        if (!view) return;
        const canEdit = userRole === 'owner' || userRole === 'editor';
    
        const itemsHtml = items.map(item => `
            <div class="card wb-item-card ${item.type === 'kr' ? 'wb-item-kr' : ''}" id="${item.id}" draggable="${canEdit}">
                <div class="card-body d-flex align-items-center gap-3">
                    <i class="bi ${item.type === 'objective' ? 'bi-bullseye' : 'bi-check2-circle'} text-muted"></i>
                    <span class="wb-item-text">${item.text}</span>
                    <textarea class="form-control d-none" rows="2">${item.text}</textarea>
                    ${canEdit ? `
                    <div class="wb-item-actions d-flex gap-2">
                        <button class="btn btn-sm btn-outline-secondary wb-edit-btn" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger wb-delete-btn" title="Delete"><i class="bi bi-trash"></i></button>
                        <button class="btn btn-sm btn-success d-none wb-save-btn" title="Save"><i class="bi bi-check-lg"></i></button>
                        <button class="btn btn-sm btn-secondary d-none wb-cancel-btn" title="Cancel"><i class="bi bi-x-lg"></i></button>
                    </div>` : ''}
                </div>
            </div>
        `).join('');
    
        view.innerHTML = `
            <div id="workbench-controls" class="mb-3">
                <h5>Ideation Workbench</h5>
                <p class="text-muted">A collaborative space to draft and organize potential OKRs before committing them to a cycle.</p>
                ${canEdit ? `
                <div class="d-flex gap-2">
                    <button id="add-wb-objective" class="btn btn-primary"><i class="bi bi-plus-circle"></i> Add Draft Objective</button>
                    <button id="add-wb-kr" class="btn btn-outline-info"><i class="bi bi-plus-circle"></i> Add Draft KR</button>
                </div>` : ''}
            </div>
            <div id="workbench-items-container" class="d-flex flex-column gap-2">${itemsHtml}</div>
        `;
    }

    renderRiskBoardView(project) {
        const view = document.getElementById('risk-board-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) {
            view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>';
            return;
        }
        const objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
        const atRiskKrsByObjective = objectivesInCycle.map(obj => {
            const riskyKrs = obj.keyResults.filter(kr => kr.confidence === 'At Risk' || kr.confidence === 'Off Track');
            return {
                objective: obj,
                riskyKrs: riskyKrs
            };
        }).filter(group => group.riskyKrs.length > 0);
        if (atRiskKrsByObjective.length === 0) {
            view.innerHTML = '<div class="alert alert-success text-center"><i class="bi bi-check-circle-fill fs-2"></i><h4 class="alert-heading mt-2">All Clear!</h4><p>There are no Key Results currently "At Risk" or "Off Track".</p></div>';
            return;
        }
        view.innerHTML = atRiskKrsByObjective.map(group => {
            return `
                <div class="card okr-card mb-4">
                    <div class="card-header">
                        <h5 class="mb-0">
                            <a href="#explorer" class="text-decoration-none">${group.objective.title}</a>
                            <small class="text-muted ms-2">(${project.teams.find(t => t.id === group.objective.ownerId)?.name || project.companyName})</small>
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="key-results-list">
                            ${group.riskyKrs.map(kr => {
                                const borderColor = kr.confidence === 'At Risk' ? 'border-warning' : 'border-danger';
                                return `
                                    <div class="card risk-card ${borderColor} mb-2">
                                        <div class="card-body">
                                            ${this.renderKeyResult(kr, group.objective.id, null, 'viewer')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderHistoricalSnapshot(project, reportDate = null) {
        const target = document.getElementById('report-content');
        if (!target) return;
        let reportContentHtml = '<p class="empty-copy mb-0">Choose a date to reconstruct attainment from Key Result history.</p>';
        if (reportDate) {
            const activeCycle = project.cycles.find(c => c.status === 'Active');
            if (activeCycle) {
                const objectivesInCycle = JSON.parse(JSON.stringify(project.objectives.filter(o => o.cycleId === activeCycle.id)));
                objectivesInCycle.forEach(obj => {
                    obj.keyResults.forEach(kr => {
                        const relevantHistory = kr.history.filter(h => h.date <= reportDate).sort((a, b) => new Date(b.date) - new Date(a.date));
                        if (relevantHistory.length > 0) kr.currentValue = relevantHistory[0].value;
                        else kr.currentValue = kr.startValue;
                    });
                    obj.progress = this._calculateObjectiveProgress(obj);
                });
                if (objectivesInCycle.length > 0) {
                    const totalProgress = objectivesInCycle.reduce((sum, obj) => sum + obj.progress, 0);
                    const overallAverage = Math.round(totalProgress / objectivesInCycle.length);
                    reportContentHtml = `
                        <div class="card dashboard-card">
                            <div class="card-body">
                                <h5 class="card-title text-muted">Overall Progress as of ${reportDate}</h5>
                                <h2 class="display-4">${overallAverage}%</h2>
                                <div class="progress" style="height: 2rem;"><div class="progress-bar" role="progressbar" style="width: ${overallAverage}%;"></div></div>
                            </div>
                        </div>`;
                } else reportContentHtml = `<div class="alert alert-info">No objectives found.</div>`;
            } else reportContentHtml = '<div class="alert alert-warning">No active cycle found.</div>';
        }
        target.innerHTML = reportContentHtml;
    }

    renderGanttView(project) {
        const view = document.getElementById('gantt-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>'; return; }
        const objectives = project.objectives.filter(objective => objective.cycleId === activeCycle.id && objective.startDate && objective.endDate);
        if (!objectives.length) { view.innerHTML = '<div class="alert alert-info">Add start and end dates to an Objective to place it on the Timeline.</div>'; return; }
        const escape = value => this._escapeHtml(value || '');
        const toTime = value => new Date(`${value}T12:00:00`).getTime();
        const datedValues = objectives.flatMap(objective => [objective.startDate, objective.endDate]).filter(Boolean);
        const rangeStart = Math.min(toTime(activeCycle.startDate || datedValues[0]), ...datedValues.map(toTime));
        const rangeEnd = Math.max(toTime(activeCycle.endDate || datedValues.at(-1)), ...datedValues.map(toTime));
        const duration = Math.max(86400000, rangeEnd - rangeStart);
        const position = value => Math.max(0, Math.min(100, ((toTime(value) - rangeStart) / duration) * 100));
        const width = (start, end) => Math.max(2, position(end) - position(start));
        const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const monthTicks = [];
        const tickCursor = new Date(rangeStart);
        tickCursor.setDate(1);
        while (tickCursor.getTime() <= rangeEnd) {
            monthTicks.push({ label: tickCursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), left: position(tickCursor.toISOString().slice(0, 10)) });
            tickCursor.setMonth(tickCursor.getMonth() + 1);
        }
        const rows = objectives.flatMap(objective => {
            const objectiveRow = {
                type: 'objective', title: objective.title, start: objective.startDate, end: objective.endDate,
                progress: Math.round(objective.progress || 0), owner: project.teams.find(team => team.id === objective.ownerId)?.name || project.companyName
            };
            const keyResultRows = (objective.keyResults || []).map(keyResult => ({
                type: 'key-result', title: keyResult.title, start: objective.startDate, end: objective.endDate,
                progress: Math.round(keyResult.progress || 0), owner: objective.title
            }));
            return [objectiveRow, ...keyResultRows];
        });
        view.innerHTML = `
            <div class="view-intro"><div><p class="eyebrow">Active cycle · ${escape(activeCycle.name)}</p><h2>Outcome timeline</h2><p>Objective and Key Result names stay visible. Hover or focus a row to inspect its dates and progress.</p></div><span class="view-intro__meta">${objectives.length} objective${objectives.length === 1 ? '' : 's'} · ${rows.length - objectives.length} key result${rows.length - objectives.length === 1 ? '' : 's'}</span></div>
            <div class="timeline-shell" role="table" aria-label="Objective and Key Result timeline">
                <div class="timeline-header" role="row"><div class="timeline-name-head" role="columnheader">Outcome</div><div class="timeline-axis" role="columnheader">${monthTicks.map(tick => `<span style="left:${tick.left}%">${escape(tick.label)}</span>`).join('')}</div></div>
                ${rows.map(row => {
                    const details = `${row.type === 'objective' ? 'Objective' : 'Key Result'} · ${dateLabel(row.start)}–${dateLabel(row.end)} · ${row.progress}% progress`;
                    return `<div class="timeline-row timeline-row--${row.type}" role="row" tabindex="0" aria-label="${escape(row.title)}. ${escape(details)}" title="${escape(details)}">
                        <div class="timeline-name" role="cell"><span class="timeline-kind">${row.type === 'objective' ? 'O' : 'KR'}</span><span><strong>${escape(row.title)}</strong><small>${escape(row.owner)}</small></span></div>
                        <div class="timeline-track" role="cell">${monthTicks.map(tick => `<i class="timeline-gridline" style="left:${tick.left}%"></i>`).join('')}<span class="timeline-bar" style="left:${position(row.start)}%;width:${width(row.start, row.end)}%;--timeline-progress:${Math.max(0, Math.min(100, row.progress))}%"><span>${escape(row.title)}</span></span></div>
                    </div>`;
                }).join('')}
            </div>`;
    }

    renderMomentumView(project, user = {}) {
        const view = document.getElementById('momentum-view');
        if (!view) return;
        const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">Activate a cycle to build momentum.</div>'; return; }
        const escape = value => this._escapeHtml(value || '');
        const personal = buildPrivateMomentum(project, user);
        const board = buildTeamLevelBoard(project);
        const nextAction = personal?.matched
            ? personal.freshKeyResults < personal.keyResultCount ? 'Update one Key Result with current evidence.'
                : personal.wellFormedObjectives < personal.objectiveCount ? 'Focus an Objective to two–five measurable Key Results.'
                    : personal.riskCount > personal.followedRisks ? 'Add evidence to an exposed risk.'
                        : 'Keep the weekly evidence rhythm going.'
            : 'Assign your name or email as an Objective’s responsible person to start private momentum.';
        const personalCard = personal?.matched ? `
            <section class="momentum-personal" aria-labelledby="my-momentum-title">
                <div><p class="eyebrow">Visible only to you</p><h2 id="my-momentum-title">My momentum</h2><p>Level ${personal.level.number} · ${escape(personal.level.name)}</p></div>
                <div class="momentum-score"><strong>${personal.score}</strong><span>/ 100</span></div>
                <div class="momentum-progress"><span style="width:${personal.score}%"></span></div>
                <div class="momentum-next"><i class="bi bi-arrow-up-right"></i><span><small>Best next move</small><strong>${escape(nextAction)}</strong></span></div>
                <div class="momentum-stats"><span><strong>${personal.streak}</strong> week streak</span><span><strong>${personal.recentCheckIns}</strong> recent check-ins</span><span>${personal.keyResultCount ? `<strong>${personal.freshKeyResults}/${personal.keyResultCount}</strong> fresh KRs` : '<strong>0</strong> KRs defined'}</span></div>
            </section>` : `
            <section class="momentum-personal momentum-personal--empty"><div><p class="eyebrow">Visible only to you</p><h2 id="my-momentum-title">Start your momentum</h2><p>${escape(nextAction)}</p></div><i class="bi bi-person-check"></i></section>`;
        const badges = personal?.badges || [];
        view.innerHTML = `
            <div class="view-intro"><div><p class="eyebrow">Meaningful participation</p><h2>Momentum, not points</h2><p>Levels reflect evidence habits, focused design, risk follow-through, and context—not logins or permanently green status.</p></div><a href="#explorer" class="btn btn-outline-primary">Update an outcome</a></div>
            ${personalCard}
            <div class="momentum-grid">
                <section class="card momentum-card"><div class="card-body"><p class="eyebrow">Private achievements</p><h3>Milestones earned</h3><div class="badge-grid">${badges.length ? badges.map(badge => `<article class="momentum-badge"><i class="bi ${badge.icon}"></i><span><strong>${escape(badge.name)}</strong><small>${escape(badge.description)}</small></span></article>`).join('') : '<p class="empty-copy">Your first badge appears after a Deep Dive, regular evidence, focused design, or risk follow-through.</p>'}</div></div></section>
                <section class="card momentum-card"><div class="card-body"><p class="eyebrow">How levels work</p><h3>Transparent score</h3><dl class="score-legend"><div><dt>35%</dt><dd>Evidence freshness</dd></div><div><dt>20%</dt><dd>Evidence depth</dd></div><div><dt>20%</dt><dd>Focused design</dd></div><div><dt>15%</dt><dd>Risk follow-through</dd></div><div><dt>10%</dt><dd>Deep Dive context</dd></div></dl></div></section>
            </div>
            <section class="level-board" aria-labelledby="level-board-title"><header><div><p class="eyebrow">Visible team competition</p><h2 id="level-board-title">Team level board</h2><p>Scores are normalized, so larger teams do not win through volume alone.</p></div><span class="level-board__cycle">${escape(activeCycle.name)}</span></header>
                <div class="level-board__rows">${board.length ? board.map(entry => `<article class="level-row ${entry.rank === 1 ? 'is-leading' : ''}"><span class="level-rank">${entry.rank}</span><span class="level-icon"><i class="bi ${entry.level.icon}"></i></span><span class="level-team"><strong>${escape(entry.ownerName)}</strong><small>Level ${entry.level.number} · ${escape(entry.level.name)}</small></span><span class="level-signals"><span>${entry.streak}w streak</span><span>${entry.keyResultCount ? `${entry.freshKeyResults}/${entry.keyResultCount} fresh KRs` : 'No KRs yet'}</span></span><span class="level-score">${entry.score}</span></article>`).join('') : '<p class="empty-copy">Add Objectives to the active cycle to start the board.</p>'}</div>
                <footer><i class="bi bi-info-circle"></i> Use levels for coaching and shared learning—not individual performance evaluation.</footer>
            </section>`;
    }

    _renderAttentionFeed(project, activeCycle) {
        const escape = value => this._escapeHtml(value || '');
        const objectives = (project.objectives || []).filter(objective => objective.cycleId === activeCycle.id);
        const now = new Date();
        const items = [];
        const counters = { risks: 0, stale: 0, design: 0, deadlines: 0 };
        objectives.forEach(objective => {
            const keyResults = objective.keyResults || [];
            if (keyResults.length < 2) {
                counters.design += 1;
                items.push({ tone: 'focus', icon: 'bi-bullseye', title: objective.title, detail: `${keyResults.length} Key Result${keyResults.length === 1 ? '' : 's'} · add evidence of the outcome`, href: '#explorer' });
            }
            if (!objective.responsible) {
                counters.design += 1;
                items.push({ tone: 'focus', icon: 'bi-person-exclamation', title: objective.title, detail: 'No responsible person assigned', href: '#explorer' });
            }
            keyResults.forEach(keyResult => {
                const exposed = ['At Risk', 'Off Track'].includes(keyResult.confidence);
                if (exposed) {
                    counters.risks += 1;
                    items.push({ tone: keyResult.confidence === 'Off Track' ? 'critical' : 'warning', icon: 'bi-exclamation-triangle', title: keyResult.title, detail: `${keyResult.confidence} · ${objective.title}`, href: '#risk-board' });
                }
                const latest = [...(keyResult.history || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
                const latestDate = latest?.date ? new Date(`${latest.date}T12:00:00`) : null;
                const age = latestDate && !Number.isNaN(latestDate.getTime()) ? Math.floor((now - latestDate) / 86400000) : Infinity;
                if (age > 14) {
                    counters.stale += 1;
                    if (!exposed) items.push({ tone: 'stale', icon: 'bi-clock-history', title: keyResult.title, detail: latestDate ? `No evidence update for ${age} days` : 'No evidence update recorded', href: '#explorer' });
                }
            });
            if (objective.endDate) {
                const endDate = new Date(`${objective.endDate}T12:00:00`);
                const daysLeft = Math.ceil((endDate - now) / 86400000);
                if (daysLeft >= 0 && daysLeft <= 14 && Number(objective.progress || 0) < 80) {
                    counters.deadlines += 1;
                    items.push({ tone: 'deadline', icon: 'bi-calendar-event', title: objective.title, detail: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left · ${Math.round(objective.progress || 0)}% progress`, href: '#gantt' });
                }
            }
        });
        const priority = { critical: 0, warning: 1, deadline: 2, stale: 3, focus: 4 };
        items.sort((a, b) => priority[a.tone] - priority[b.tone]);
        return `<section class="attention-surface" aria-labelledby="attention-title"><header><div><p class="eyebrow">Decision feed</p><h2 id="attention-title">Attention now</h2><p>Start with exceptions and missing evidence—not another status report.</p></div><span>${items.length} signal${items.length === 1 ? '' : 's'}</span></header>
            <div class="attention-metrics"><a href="#risk-board"><strong>${counters.risks}</strong><span>Exposed risks</span></a><a href="#explorer"><strong>${counters.stale}</strong><span>Stale KRs</span></a><a href="#explorer"><strong>${counters.design}</strong><span>Design gaps</span></a><a href="#gantt"><strong>${counters.deadlines}</strong><span>Near deadlines</span></a></div>
            <div class="attention-list">${items.length ? items.slice(0, 8).map(item => `<a class="attention-item attention-item--${item.tone}" href="${item.href}"><i class="bi ${item.icon}"></i><span><strong>${escape(item.title)}</strong><small>${escape(item.detail)}</small></span><i class="bi bi-arrow-right"></i></a>`).join('') : '<div class="attention-clear"><i class="bi bi-check2-circle"></i><span><strong>No immediate exceptions</strong><small>Keep the evidence rhythm current.</small></span></div>'}</div>
            ${items.length > 8 ? `<footer>${items.length - 8} additional signals are available in Objectives and Risks.</footer>` : ''}</section>`;
    }

    renderDashboardView(project, filterOwnerId = 'all', filterResponsible = 'all') {
        const view = document.getElementById('dashboard-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        const owners = [{ id: 'company', name: project.companyName }, ...project.teams];
        const ownerFilterOptionsHtml = owners.map(owner => `<option value="${owner.id}" ${filterOwnerId === owner.id ? 'selected' : ''}>${owner.name}</option>`).join('');
        let contentHtml;
        let responsibleFilterOptionsHtml = '';
        if (!activeCycle) {
            contentHtml = '<div class="alert alert-warning">No active cycle found.</div>';
        } else {
            let objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
            objectivesInCycle.forEach(obj => obj.progress = this._calculateObjectiveProgress(obj)); // Ensure progress is up-to-date
            const responsibles = [...new Set(objectivesInCycle.map(o => o.responsible).filter(Boolean))];
            responsibleFilterOptionsHtml = responsibles.map(r => `<option value="${r}" ${filterResponsible === r ? 'selected' : ''}>${r}</option>`).join('');
            if (filterOwnerId !== 'all') objectivesInCycle = objectivesInCycle.filter(o => o.ownerId === filterOwnerId);
            if (filterResponsible !== 'all') objectivesInCycle = objectivesInCycle.filter(o => o.responsible === filterResponsible);
            if (objectivesInCycle.length === 0) {
                contentHtml = '<div class="alert alert-info">No objectives match the current filter.</div>';
            } else {
                const totalProgress = objectivesInCycle.reduce((sum, obj) => sum + obj.progress, 0);
                const overallAverage = Math.round(totalProgress / objectivesInCycle.length);
                const allKrs = objectivesInCycle.flatMap(o => o.keyResults);
                const krHealth = {
                    'On Track': allKrs.filter(kr => (kr.confidence || 'On Track') === 'On Track').length,
                    'At Risk': allKrs.filter(kr => kr.confidence === 'At Risk').length,
                    'Off Track': allKrs.filter(kr => kr.confidence === 'Off Track').length,
                    'Total': allKrs.length
                };
                const onTrackPercent = krHealth.Total > 0 ? (krHealth['On Track'] / krHealth.Total * 100) : 0;
                const atRiskPercent = krHealth.Total > 0 ? (krHealth['At Risk'] / krHealth.Total * 100) : 0;
                const offTrackPercent = krHealth.Total > 0 ? (krHealth['Off Track'] / krHealth.Total * 100) : 0;
                const now = new Date();
                const historyAge = keyResult => {
                    const latest = [...(keyResult.history || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
                    return latest?.date ? Math.floor((now - new Date(`${latest.date}T12:00:00`)) / 86400000) : Infinity;
                };
                const freshThisWeek = allKrs.filter(keyResult => historyAge(keyResult) <= 7).length;
                const staleEvidence = allKrs.filter(keyResult => historyAge(keyResult) > 14).length;
                const resolvedThisMonth = (project.activityEvents || []).filter(event => {
                    const age = (now - new Date(event.occurredAt)) / 86400000;
                    return event.type === 'risk_resolved' && event.cycleId === activeCycle.id && age >= 0 && age <= 30;
                }).length;
                const progressByOwner = owners.map(owner => {
                    const ownerObjectives = project.objectives.filter(o => o.cycleId === activeCycle.id && o.ownerId === owner.id);
                    if (ownerObjectives.length === 0) return null;
                    const ownerTotalProgress = ownerObjectives.reduce((sum, obj) => sum + obj.progress, 0);
                    return { name: owner.name, progress: Math.round(ownerTotalProgress / ownerObjectives.length) };
                }).filter(Boolean);
                const progressByOwnerWidget = (filterOwnerId === 'all' && filterResponsible === 'all') ? `
                    <div class="col-xl-6">
                        <div class="card dashboard-card h-100"><div class="card-body"><h5 class="card-title text-muted">Progress by Owner</h5><ul class="list-group list-group-flush">${progressByOwner.map(owner => `<li class="list-group-item bg-transparent"><div class="d-flex justify-content-between"><span>${owner.name}</span><strong>${owner.progress}%</strong></div><div class="progress mt-1" style="height: 0.5rem;"><div class="progress-bar bg-secondary" role="progressbar" style="width: ${owner.progress}%;"></div></div></li>`).join('')}</ul></div></div>
                    </div>` : '';

                contentHtml = `
                    <div class="row g-4">
                        <div class="col-12">
                            <div class="card dashboard-card dashboard-card--hero"><div class="card-body p-4"><h5 class="card-title">Overall progress · ${activeCycle.name}</h5><div class="d-flex justify-content-between align-items-end mb-3"><div><h2 class="display-4 mb-1">${overallAverage}%</h2><p class="mb-0 text-white-50 small">Average objective attainment</p></div><i class="bi bi-arrow-up-right fs-3 text-white-50"></i></div><div class="progress" style="height: .65rem;"><div class="progress-bar" role="progressbar" style="width: ${overallAverage}%;" aria-valuenow="${overallAverage}" aria-valuemin="0" aria-valuemax="100"></div></div></div></div>
                        </div>
                        ${progressByOwnerWidget}
                        <div class="${(filterOwnerId === 'all' && filterResponsible === 'all') ? 'col-xl-6' : 'col-12'}">
                            <div class="card dashboard-card h-100"><div class="card-body"><h5 class="card-title text-muted">Key Result Health (${krHealth.Total} total)</h5><div class="d-flex justify-content-around align-items-center text-center mt-4"><div class="health-stat"><div class="stat-value text-success">${krHealth['On Track']}</div><div class="stat-label">On Track</div></div><div class="health-stat"><div class="stat-value text-warning">${krHealth['At Risk']}</div><div class="stat-label">At Risk</div></div><div class="health-stat"><div class="stat-value text-danger">${krHealth['Off Track']}</div><div class="stat-label">Off Track</div></div></div><div class="progress mt-4" style="height: 1.5rem; font-size: 0.8rem;"><div class="progress-bar bg-success" role="progressbar" style="width: ${onTrackPercent}%" title="On Track">${Math.round(onTrackPercent)}%</div><div class="progress-bar bg-warning" role="progressbar" style="width: ${atRiskPercent}%" title="At Risk">${Math.round(atRiskPercent)}%</div><div class="progress-bar bg-danger" role="progressbar" style="width: ${offTrackPercent}%" title="Off Track">${Math.round(offTrackPercent)}%</div></div></div></div>
                        </div>
                        <div class="col-12"><section class="decision-summary" aria-labelledby="decision-summary-title"><header><p class="eyebrow">Evidence and movement</p><h2 id="decision-summary-title">What changed?</h2></header><div><article><strong>${freshThisWeek}/${krHealth.Total}</strong><span>KRs with evidence this week</span><a href="#weekly-focus">Complete the weekly rhythm</a></article><article><strong>${staleEvidence}</strong><span>KRs stale for more than 14 days</span><a href="#explorer">Review missing evidence</a></article><article><strong>${resolvedThisMonth}</strong><span>Risks moved back on track this month</span><a href="#weekly-focus">See team learning</a></article></div></section></div>
                    </div>`;
            }
        }
        const specificationReady = hasOkrSpecification(activeCycle?.okrSpecification);
        const deepDiveBanner = activeCycle ? `<a href="#deep-dive" class="deep-dive-banner"><span class="deep-dive-banner__icon"><i class="bi bi-compass"></i></span><span><strong>OKR Deep Dive</strong><small>${specificationReady ? 'Explore the agent-derived context, classification, and inheritance map.' : 'Run the circular interview to derive this set’s strategic specification.'}</small></span><i class="bi bi-arrow-right ms-auto"></i></a>` : '';
        const attentionFeed = activeCycle ? this._renderAttentionFeed(project, activeCycle) : '';
        const historicSnapshot = activeCycle ? `<details class="cockpit-disclosure"><summary><span><strong>Historical snapshot</strong><small>Reconstruct attainment from saved Key Result evidence.</small></span><i class="bi bi-chevron-down"></i></summary><div class="cockpit-disclosure__body"><label for="report-date-input" class="form-label">Snapshot date</label><input type="date" id="report-date-input" class="form-control"><div id="report-content" class="mt-3"><p class="empty-copy mb-0">Choose a date to reconstruct attainment from Key Result history.</p></div></div></details>` : '';
        view.innerHTML = `${attentionFeed}<div class="dashboard-toolbar"><span>Scope the supporting metrics</span><div><select id="dashboard-filter-owner" class="form-select" aria-label="Filter by owner"><option value="all" ${filterOwnerId === 'all' ? 'selected' : ''}>All owners</option>${ownerFilterOptionsHtml}</select><select id="dashboard-filter-responsible" class="form-select" aria-label="Filter by responsible person"><option value="all" ${filterResponsible === 'all' ? 'selected' : ''}>All responsible people</option>${responsibleFilterOptionsHtml}</select></div></div>${deepDiveBanner}${contentHtml}${historicSnapshot}`;
        // The Overview intentionally favors decision summaries over decorative charts.
    }

    renderDeepDiveView(project, userRole) {
        const view = document.getElementById('deep-dive-view');
        if (!view) return;
        const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active');
        if (!activeCycle) {
            view.innerHTML = '<div class="alert alert-warning">Activate an OKR cycle before creating a Deep Dive specification.</div>';
            return;
        }
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const specification = normalizeOkrSpecification(activeCycle.okrSpecification);
        const hasSpecification = hasOkrSpecification(specification);
        const escape = value => this._escapeHtml(value);
        const renderValue = value => {
            const values = Array.isArray(value) ? value : [value];
            const populated = values.filter(Boolean);
            return populated.length ? populated.map(item => `<span class="deep-dive-chip">${escape(item)}</span>`).join('') : '<span class="deep-dive-empty">Not inferred yet</span>';
        };
        const renderList = values => values?.length
            ? `<ul class="deep-dive-list">${values.map(value => `<li>${escape(value)}</li>`).join('')}</ul>`
            : '<p class="deep-dive-empty mb-0">No evidence captured yet.</p>';

        if (!hasSpecification) {
            view.innerHTML = `
                <section class="deep-dive-empty-state">
                    <div class="deep-dive-empty-state__icon"><i class="bi bi-compass"></i></div>
                    <p class="eyebrow mb-2">Agent-derived specification</p>
                    <h2>Reveal the system behind this OKR set.</h2>
                    <p>Start a guided 5–7 question interview. The coach will explore stakeholder perspectives, interactions, differences, consequences, and preferred futures before deriving the set specification.</p>
                    <button type="button" class="btn btn-primary open-okr-coach-btn"><i class="bi bi-stars me-1"></i> Start Deep Dive interview</button>
                </section>`;
            return;
        }

        const objectives = (project.objectives || []).filter(objective => objective.cycleId === activeCycle.id);
        const objectiveCards = objectives.map(objective => {
            const effective = resolveObjectiveSpecification(specification, objective.specification);
            const overrideCount = Object.values(effective.overrides).filter(Boolean).length;
            return `
                <article class="deep-dive-objective">
                    <header class="d-flex justify-content-between gap-3 align-items-start">
                        <div><p class="eyebrow mb-1">Objective</p><h3>${escape(objective.title)}</h3></div>
                        <span class="deep-dive-inheritance ${overrideCount ? 'is-overridden' : ''}">${overrideCount ? `${overrideCount} override${overrideCount === 1 ? '' : 's'}` : 'Inherited from set'}</span>
                    </header>
                    <div class="deep-dive-taxonomy deep-dive-taxonomy--compact">
                        <div><span>Category</span><strong>${escape(effective.category || 'Not inferred')}</strong>${effective.overrides.category ? '<small>Objective override</small>' : '<small>Inherited</small>'}</div>
                        <div><span>Level</span><strong>${escape(effective.level || 'Not inferred')}</strong>${effective.overrides.level ? '<small>Objective override</small>' : '<small>Inherited</small>'}</div>
                        <div><span>Commitment</span><strong>${escape(effective.commitment || 'Not inferred')}</strong>${effective.overrides.commitment ? '<small>Objective override</small>' : '<small>Inherited</small>'}</div>
                    </div>
                    <div class="deep-dive-kr-summary"><span>${objective.keyResults?.length || 0} key results</span><span>${Math.round(objective.progress || 0)}% progress</span><span>${escape(objective.responsible || 'No responsible person')}</span></div>
                </article>`;
        }).join('');

        view.innerHTML = `
            <section class="deep-dive-hero">
                <div>
                    <p class="eyebrow mb-2">${escape(activeCycle.name)} · agent-derived</p>
                    <h2>${escape(specification.outcomeThesis || 'OKR set specification')}</h2>
                    <p>${escape(specification.rationale || 'The coach derived this specification from the circular interview and available dashboard context.')}</p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-outline-light open-okr-coach-btn"><i class="bi bi-stars me-1"></i> Continue interview</button>
                    ${canEdit ? '<button type="button" class="btn btn-primary review-okr-spec-btn"><i class="bi bi-pencil me-1"></i> Review specification</button>' : ''}
                </div>
            </section>

            <section class="deep-dive-taxonomy" aria-label="OKR classification">
                <div><span>Category</span><strong>${escape(specification.category || 'Not inferred')}</strong><small>Strategic intent</small></div>
                <div><span>Level</span><strong>${escape(specification.level || 'Not inferred')}</strong><small>Organizational scope</small></div>
                <div><span>Commitment</span><strong>${escape(specification.commitment || 'Not inferred')}</strong><small>Ambition contract</small></div>
            </section>

            <div class="row g-4 mt-0">
                <div class="col-xl-7">
                    <section class="card deep-dive-section h-100"><div class="card-body p-4">
                        <p class="eyebrow">Operating context</p>
                        <div class="deep-dive-context-grid">
                            <div><span>Industry</span>${renderValue(specification.context.industry)}</div>
                            <div><span>Services / offering</span>${renderValue(specification.context.services)}</div>
                            <div><span>Geography</span>${renderValue(specification.context.geography)}</div>
                            <div><span>Business unit</span>${renderValue(specification.context.businessUnit)}</div>
                            <div><span>Stakeholders</span>${renderValue(specification.context.stakeholders)}</div>
                            <div><span>Time horizon</span>${renderValue(specification.context.timeHorizon)}</div>
                        </div>
                    </div></section>
                </div>
                <div class="col-xl-5">
                    <section class="card deep-dive-section h-100"><div class="card-body p-4">
                        <p class="eyebrow">Systemic perspectives</p>
                        ${renderList(specification.perspectives)}
                    </div></section>
                </div>
                <div class="col-lg-4"><section class="card deep-dive-section h-100"><div class="card-body p-4"><p class="eyebrow">Assumptions</p>${renderList(specification.assumptions)}</div></section></div>
                <div class="col-lg-4"><section class="card deep-dive-section h-100"><div class="card-body p-4"><p class="eyebrow">Productive tensions</p>${renderList(specification.tensions)}</div></section></div>
                <div class="col-lg-4"><section class="card deep-dive-section h-100"><div class="card-body p-4"><p class="eyebrow">Success signals</p>${renderList(specification.successSignals)}</div></section></div>
            </div>

            <section class="mt-5">
                <div class="d-flex justify-content-between align-items-end gap-3 mb-3"><div><p class="eyebrow mb-1">Inheritance map</p><h2 class="h3 mb-0">Objectives in this set</h2></div><span class="text-muted small">Set defaults flow down unless the agent specifies an override.</span></div>
                <div class="deep-dive-objectives">${objectiveCards || '<div class="card"><div class="card-body text-muted">No Objectives exist in this cycle yet.</div></div>'}</div>
            </section>`;
    }

    _calculateObjectiveProgress(objective) {
        if (!objective.keyResults || objective.keyResults.length === 0) return 0;
        const total = objective.keyResults.reduce((sum, kr) => {
            const start = Number(kr.startValue), target = Number(kr.targetValue), current = Number(kr.currentValue);
            if (target === start) return sum + 100;
            const progress = Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100));
            kr.progress = progress;
            return sum + progress;
        }, 0);
        return Math.round(total / objective.keyResults.length);
    }
    
    _renderBurndownChart(project) {
        const ctx = document.getElementById('burndown-chart')?.getContext('2d');
        if (!ctx) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle || !activeCycle.startDate || !activeCycle.endDate) {
            ctx.canvas.parentElement.innerHTML = '<div class="text-center text-muted p-3">Cycle start and end dates must be set.</div>';
            return;
        }

        const allKrs = project.objectives.filter(o => o.cycleId === activeCycle.id).flatMap(o => o.keyResults);
        const startDate = new Date(activeCycle.startDate + 'T00:00:00');
        const endDate = new Date(activeCycle.endDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const labels = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            labels.push(d.toISOString().split('T')[0]);
        }

        const totalKrsOnTrackStart = allKrs.filter(kr => {
            const firstHistory = kr.history?.filter(h => h.date <= activeCycle.startDate).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            return firstHistory?.confidence === 'On Track';
        }).length;

        const idealData = [];
        const daysInCycle = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (daysInCycle > 0) {
            for (let i = 0; i <= daysInCycle; i++) {
                idealData.push(totalKrsOnTrackStart - (totalKrsOnTrackStart / daysInCycle) * i);
            }
        }

        const actualData = [];
        for (const day of labels) {
            const currentDay = new Date(day + 'T00:00:00');
            if(currentDay > today) {
                actualData.push(null);
                continue;
            }
            let onTrackCount = 0;
            for (const kr of allKrs) {
                const relevantHistory = kr.history?.filter(h => h.date <= day).sort((a,b) => new Date(b.date) - new Date(a.date));
                if (relevantHistory && relevantHistory.length > 0 && relevantHistory[0].confidence === 'On Track') {
                    onTrackCount++;
                }
            }
            actualData.push(onTrackCount);
        }

        this.charts.burndown = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => new Date(l+'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})),
                datasets: [{
                    label: 'Actual On Track KRs', data: actualData, borderColor: 'rgba(54, 162, 235, 1)', tension: 0.1, spanGaps: true
                },{
                    label: 'Ideal Burndown', data: idealData, borderColor: 'rgba(255, 99, 132, 0.5)', borderDash: [5, 5], fill: false
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#6f6965', stepSize: 1 }, grid: { color: 'rgba(32,32,32,0.08)' } },
                    x: { ticks: { color: '#6f6965', maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(32,32,32,0.08)' } }
                },
                plugins: { legend: { labels: { color: '#6f6965' } } }
            }
        });
    }

    _renderHealthTrendChart(objectives) {
        const ctx = document.getElementById('health-trend-chart')?.getContext('2d');
        if (!ctx) return;
        const labels = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today); date.setDate(date.getDate() - i); labels.push(date.toISOString().split('T')[0]);
        }
        const dailyCounts = {};
        labels.forEach(label => { dailyCounts[label] = { 'On Track': 0, 'At Risk': 0, 'Off Track': 0 }; });
        const allKrs = objectives.flatMap(o => o.keyResults);
        allKrs.forEach(kr => {
            if (!kr.history || kr.history.length === 0) return;
            const sortedHistory = [...kr.history].sort((a, b) => new Date(a.date) - new Date(b.date));
            let historyIndex = 0;
            for (const label of labels) {
                while (historyIndex < sortedHistory.length - 1 && sortedHistory[historyIndex + 1].date <= label) historyIndex++;
                const currentConfidence = sortedHistory[historyIndex].confidence || 'On Track';
                 if (new Date(sortedHistory[0].date) <= new Date(label)) dailyCounts[label][currentConfidence]++;
            }
        });
        const datasets = {
            'On Track': { data: [], color: 'rgba(25, 135, 84, 0.7)' },
            'At Risk': { data: [], color: 'rgba(255, 193, 7, 0.7)' },
            'Off Track': { data: [], color: 'rgba(220, 53, 69, 0.7)' }
        };
        labels.forEach(label => {
            datasets['On Track'].data.push(dailyCounts[label]['On Track']);
            datasets['At Risk'].data.push(dailyCounts[label]['At Risk']);
            datasets['Off Track'].data.push(dailyCounts[label]['Off Track']);
        });
        this.charts.healthTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => new Date(l).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})),
                datasets: Object.keys(datasets).map(key => ({
                    label: key, data: datasets[key].data, borderColor: datasets[key].color,
                    backgroundColor: datasets[key].color, tension: 0.1, fill: false
                }))
            },
            options: {
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#6f6965', stepSize: 1 }, grid: { color: 'rgba(32,32,32,0.08)' } },
                    x: { ticks: { color: '#6f6965' }, grid: { color: 'rgba(32,32,32,0.08)' } }
                },
                plugins: { legend: { labels: { color: '#6f6965' } } }
            }
        });
    }

    _calculateHistoricProgress(objectives, reportDate) {
        if (!objectives || objectives.length === 0) return 0;
        let totalProgress = 0;
        objectives.forEach(obj => {
            let tempObj = JSON.parse(JSON.stringify(obj));
            tempObj.keyResults.forEach(kr => {
                if(kr.history && kr.history.length > 0) {
                    const relevantHistory = kr.history.filter(h => h.date <= reportDate).sort((a, b) => new Date(b.date) - new Date(a.date));
                    if (relevantHistory.length > 0) kr.currentValue = Number(relevantHistory[0].value);
                    else kr.currentValue = Number(kr.startValue);
                }
            });
            tempObj.progress = this._calculateObjectiveProgress(tempObj);
            totalProgress += tempObj.progress;
        });
        return Math.round(totalProgress / objectives.length);
    }
    
    _renderVelocityChart(objectives) {
        const ctx = document.getElementById('velocity-chart')?.getContext('2d');
        if (!ctx) return;
        const weeklyProgress = [];
        const labels = [];
        const today = new Date();
        for (let i = 4; i >= 0; i--) {
            const date = new Date(today); date.setDate(date.getDate() - (i * 7));
            const dateString = date.toISOString().split('T')[0];
            weeklyProgress.push(this._calculateHistoricProgress(objectives, dateString));
            if (i < 4) labels.push(`Week of ${new Date(date.setDate(date.getDate() - 6)).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`);
        }
        const velocities = [];
        for (let i = 1; i < weeklyProgress.length; i++) velocities.push(weeklyProgress[i] - weeklyProgress[i-1]);
        this.charts.velocity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Weekly Progress Change (%)', data: velocities,
                    backgroundColor: velocities.map(v => v >= 0 ? 'rgba(25, 135, 84, 0.7)' : 'rgba(220, 53, 69, 0.7)')
                }]
            },
            options: {
                scales: {
                    y: { ticks: { color: '#6f6965' }, grid: { color: 'rgba(32,32,32,0.08)' } },
                    x: { ticks: { color: '#6f6965' }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    renderNavControls(project) {
        const cycleSelectorList = document.getElementById('cycle-selector-list');
        const cycleSelectorBtn = document.getElementById('cycle-selector-btn');
        const addObjectiveBtn = document.getElementById('add-objective-btn');
        if (!cycleSelectorBtn || !cycleSelectorList) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active') || project.cycles[0];
        if (activeCycle) {
            cycleSelectorBtn.textContent = activeCycle.name;
            cycleSelectorBtn.disabled = false;
            if (addObjectiveBtn) addObjectiveBtn.disabled = false;
        } else {
            cycleSelectorBtn.textContent = 'No Cycles';
            cycleSelectorBtn.disabled = true;
            if (addObjectiveBtn) addObjectiveBtn.disabled = true;
        }
        cycleSelectorList.innerHTML = project.cycles.map(cycle => `<li><a class="dropdown-item ${cycle.id === activeCycle?.id ? 'active' : ''}" href="#" data-cycle-id="${cycle.id}">${cycle.name}</a></li>`).join('');
    }

    renderExplorerView(project, searchTerm = '', filterResponsible = 'all', userRole, user = {}, savedView = 'all') {
        const view = document.getElementById('explorer-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>'; return; }
        let objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
        const responsibles = [...new Set(objectivesInCycle.map(o => o.responsible).filter(Boolean))];
        const responsibleFilterOptionsHtml = responsibles.map(r => `<option value="${r}" ${filterResponsible === r ? 'selected' : ''}>${r}</option>`).join('');
        let objectivesToRender = objectivesInCycle;
        if (filterResponsible !== 'all') objectivesToRender = objectivesToRender.filter(o => o.responsible === filterResponsible);
        const aliases = [user.email, user.displayName].filter(Boolean).map(value => value.toLocaleLowerCase());
        const latestAge = keyResult => {
            const latest = [...(keyResult.history || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
            return latest?.date ? Math.floor((Date.now() - new Date(`${latest.date}T12:00:00`).getTime()) / 86400000) : Infinity;
        };
        if (savedView === 'mine') objectivesToRender = objectivesToRender.filter(objective => aliases.some(alias => String(objective.responsible || '').toLocaleLowerCase().includes(alias)));
        if (savedView === 'needs-evidence') objectivesToRender = objectivesToRender.filter(objective => (objective.keyResults || []).some(keyResult => latestAge(keyResult) > 14));
        if (savedView === 'risks') objectivesToRender = objectivesToRender.filter(objective => (objective.keyResults || []).some(keyResult => ['At Risk', 'Off Track'].includes(keyResult.confidence)));
        if (savedView === 'ending') objectivesToRender = objectivesToRender.filter(objective => {
            if (!objective.endDate) return false;
            const daysLeft = Math.ceil((new Date(`${objective.endDate}T12:00:00`).getTime() - Date.now()) / 86400000);
            return daysLeft >= 0 && daysLeft <= 14;
        });
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            objectivesToRender = objectivesToRender.filter(o => o.title.toLowerCase().includes(lowercasedTerm) || (o.notes && o.notes.toLowerCase().includes(lowercasedTerm)) || o.keyResults.some(kr => kr.title.toLowerCase().includes(lowercasedTerm)));
        }
        const companyObjectives = objectivesToRender.filter(o => o.ownerId === 'company');
        let html = this.renderObjectiveGroup(project.companyName, companyObjectives, project, objectivesInCycle, searchTerm, userRole);
        project.teams.forEach(team => {
            const teamObjectives = objectivesToRender.filter(o => o.ownerId === team.id);
            html += this.renderObjectiveGroup(team.name, teamObjectives, project, objectivesInCycle, searchTerm, userRole);
        });
        const savedViews = [['all','All Objectives'],['mine','My OKRs'],['needs-evidence','Needs evidence'],['risks','At risk'],['ending','Ending soon']];
        const filterHtml = `<div class="explorer-toolbar"><div><label class="visually-hidden" for="explorer-saved-view">Saved view</label><select id="explorer-saved-view" class="form-select">${savedViews.map(([value,label]) => `<option value="${value}" ${savedView === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><details class="compact-filter"><summary><i class="bi bi-funnel"></i> Filters${filterResponsible !== 'all' ? '<span>1</span>' : ''}</summary><div><label for="explorer-filter-responsible" class="form-label">Responsible</label><select id="explorer-filter-responsible" class="form-select"><option value="all">All people</option>${responsibleFilterOptionsHtml}</select></div></details></div>`;
        if (!html && (searchTerm || filterResponsible !== 'all' || savedView !== 'all')) view.innerHTML = filterHtml + `<section class="purpose-empty"><i class="bi bi-search"></i><h2>No matching outcomes</h2><p>Try another saved view or clear the active filter.</p><button type="button" class="btn btn-outline-primary" id="clear-explorer-filters">Show all Objectives</button></section>`;
        else if (!html) view.innerHTML = filterHtml + `<section class="purpose-empty"><i class="bi bi-bullseye"></i><h2>Define the first outcome</h2><p>Objectives turn the active cycle into a small set of measurable priorities.</p>${(userRole !== 'viewer') ? '<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#objectiveModal">Create an Objective</button>' : ''}</section>`;
        else view.innerHTML = filterHtml + html; 
    }

    renderObjectiveGroup(groupName, objectives, project, allObjectivesInCycle, searchTerm, userRole) {
        if (objectives.length === 0) return '';
        return `
            <div class="mb-5">
                <h2 class="team-header">${groupName}</h2>
                <div class="objective-list d-flex flex-column gap-3" data-owner-id="${objectives[0]?.ownerId || ''}">
                    ${objectives.map(obj => this.renderOkrCard(obj, project, allObjectivesInCycle, searchTerm, userRole)).join('')}
                </div>
            </div>`;
    }

    renderOkrCard(objective, project, allObjectivesInCycle, searchTerm, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const highlightedTitle = this._highlightText(objective.title, searchTerm);
        const highlightedNotes = this._highlightText(objective.notes, searchTerm);
        const parsedNotes = objective.notes && globalThis.DOMPurify ? DOMPurify.sanitize(marked.parse(highlightedNotes)) : '';
        const notesHtml = parsedNotes ? `<div class="obj-notes">${parsedNotes}</div>` : '';
        const dependsOnList = (objective.dependsOn || []).map(depId => allObjectivesInCycle.find(o => o.id === depId)?.title).filter(Boolean).join('<br>');
        const dependsOnTooltip = dependsOnList ? `<strong>Depends On:</strong><br>${dependsOnList}` : '';
        const dependsOnCount = objective.dependsOn?.length || 0;
        const blocksList = allObjectivesInCycle.filter(o => o.dependsOn?.includes(objective.id)).map(o => o.title).join('<br>');
        const blocksTooltip = blocksList ? `<strong>Blocks:</strong><br>${blocksList}` : '';
        const blocksCount = allObjectivesInCycle.filter(o => o.dependsOn?.includes(objective.id)).length;
        const dependsOnBadge = dependsOnCount > 0 ? `<span class="badge bg-secondary ms-2" data-bs-toggle="tooltip" data-bs-html="true" title="${dependsOnTooltip}"><i class="bi bi-arrow-down"></i> ${dependsOnCount}</span>` : '';
        const blocksBadge = blocksCount > 0 ? `<span class="badge bg-warning text-dark ms-2" data-bs-toggle="tooltip" data-bs-html="true" title="${blocksTooltip}"><i class="bi bi-arrow-up"></i> ${blocksCount}</span>` : '';
        const responsibleHtml = objective.responsible ? `<span class="responsible-person ms-2"><i class="bi bi-person-fill"></i> ${objective.responsible}</span>` : '';
        const health = this._objectiveHealth(objective);
        const editControls = canEdit ? `<div class="dropdown"><button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown" aria-label="More actions for ${this._escapeHtml(objective.title)}"><i class="bi bi-three-dots"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button class="dropdown-item" data-bs-toggle="modal" data-bs-target="#objectiveModal" data-objective-id="${objective.id}"><i class="bi bi-pencil me-2"></i>Edit Objective</button></li><li><button class="dropdown-item" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objective.id}"><i class="bi bi-plus-circle me-2"></i>Add Key Result</button></li><li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger delete-obj-btn" data-objective-id="${objective.id}"><i class="bi bi-trash me-2"></i>Delete Objective</button></li></ul></div>` : '';

        return `
            <div class="card okr-card" id="${objective.id}" draggable="${canEdit}">
                <div class="card-header okr-card__header">
                    <button type="button" class="okr-card__title open-okr-detail" data-objective-id="${objective.id}"><span class="okr-card__health okr-card__health--${health.toLocaleLowerCase().replaceAll(' ','-')}">${health}</span><h3>${highlightedTitle}</h3><small>${responsibleHtml || '<span class="responsible-person">No responsible person</span>'}</small></button>
                    ${editControls}
                </div>
                <div class="card-body">
                    <div class="okr-card__progress"><span>Objective progress</span><strong>${objective.progress}%</strong></div><div class="progress mb-3" style="height: .45rem;">
                        <div class="progress-bar" role="progressbar" style="width: ${objective.progress}%;" aria-valuenow="${objective.progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Objective progress">
                        </div>
                    </div>
                    <div class="okr-card__signals">${dependsOnBadge}${blocksBadge}<span>${objective.keyResults?.length || 0} Key Results</span>${objective.endDate ? `<span>Due ${objective.endDate}</span>` : ''}</div>
                    <div class="key-results-list">${objective.keyResults.map(kr => this.renderKeyResult(kr, objective.id, searchTerm, userRole)).join('')}</div>
                </div>
            </div>`;
    }

    renderKeyResult(kr, objectiveId, searchTerm, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const highlightedKrTitle = this._highlightText(kr.title, searchTerm);
        const progress = kr.progress || 0;
        const confidence = kr.confidence || 'On Track';
        const confidenceColors = { 'On Track': 'bg-success', 'At Risk': 'bg-warning', 'Off Track': 'bg-danger' };
        const badgeColor = confidenceColors[confidence];
        const sparklineHtml = this._createSparklineSVG(kr.history);
        const notesIcon = (kr.notes && kr.notes.trim() !== '') ? `<i class="bi bi-sticky text-muted ms-2" data-bs-toggle="tooltip" title="${kr.notes}"></i>` : '';
        const editControls = canEdit ? `<button class="btn btn-sm btn-link text-muted" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objectiveId}" data-kr-id="${kr.id}" aria-label="Edit ${this._escapeHtml(kr.title)}"><i class="bi bi-pencil"></i></button>` : '';

        return `
            <div class="kr-item">
                <button type="button" class="kr-title open-okr-detail" data-objective-id="${objectiveId}" data-kr-id="${kr.id}"><span class="badge ${badgeColor} me-2">${confidence}</span><span>${highlightedKrTitle}${notesIcon}</span></button>
                <div class="kr-progress-container">
                    ${sparklineHtml}
                    <small class="text-muted d-flex justify-content-between"><span>${kr.currentValue}</span> <span>of ${kr.targetValue}</span></small>
                    <div class="progress" style="--bs-progress-height: 0.75rem;"><div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Key Result progress"></div></div>
                </div>
                ${editControls}
            </div>`;
    }

    renderCyclesView(project, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const view = document.getElementById('cycles-view');
        if (!view) return;
        const activeCycle = project.cycles.find(cycle => cycle.status === 'Active');
        const retrospective = activeCycle?.retrospective || {};
        const escape = value => this._escapeHtml(value || '');
        view.innerHTML = `
            <div class="row g-4">
                ${canEdit ? `<div class="col-md-5">
                    <div class="card"><div class="card-header"><h4>Add New Cycle</h4></div><div class="card-body"><form id="new-cycle-form"><div class="mb-3"><label for="cycle-name" class="form-label">Name</label><input type="text" class="form-control" id="cycle-name" required></div><div class="mb-3"><label for="cycle-start-date" class="form-label">Start Date</label><input type="date" class="form-control" id="cycle-start-date" required></div><div class="mb-3"><label for="cycle-end-date" class="form-label">End Date</label><input type="date" class="form-control" id="cycle-end-date" required></div><button type="submit" class="btn btn-primary">Add Cycle</button></form></div></div>
                </div>` : ''}
                <div class="${canEdit ? 'col-md-7' : 'col-12'}">
                    <div class="card"><div class="card-header"><h4>Existing Cycles</h4></div><div class="card-body"><ul class="list-group" id="cycle-list">${project.cycles.length > 0 ? project.cycles.map(c => this.renderCycleListItem(c, project.cycles.length, canEdit)).join('') : '<li class="list-group-item">No cycles.</li>'}</ul></div></div>
                </div>
                ${activeCycle ? `<div class="col-12"><section class="card retrospective-card"><div class="card-body p-4"><div class="view-intro"><div><p class="eyebrow">Review → learn</p><h2>Guided retrospective</h2><p>Capture decisions and reusable lessons—not a performance score.</p></div>${retrospective.completedAt ? '<span class="retrospective-earned"><i class="bi bi-journal-check"></i> Learning loop earned</span>' : ''}</div>${canEdit ? `<form id="retrospective-form"><input type="hidden" id="retrospective-cycle-id" value="${activeCycle.id}"><div class="mb-3"><label class="form-label" for="retrospective-summary">What changed because of this cycle?</label><textarea class="form-control" id="retrospective-summary" rows="3" required placeholder="Outcome, decision, or invalidated assumption…">${escape(retrospective.summary)}</textarea></div><div class="mb-3"><label class="form-label" for="retrospective-lessons">What should the next cycle reuse?</label><textarea class="form-control" id="retrospective-lessons" rows="5" placeholder="One lesson per line">${escape((retrospective.lessons || []).join('\n'))}</textarea></div><button class="btn btn-primary" type="submit">${retrospective.completedAt ? 'Update learning' : 'Complete learning loop'}</button></form>` : `<p>${escape(retrospective.summary || 'No retrospective has been captured yet.')}</p>`}</div></section></div>` : ''}
            </div>`;
    }
    
    renderCycleListItem(cycle, totalCycles, canEdit) {
        const isActive = cycle.status === 'Active';
        const deleteDisabled = isActive || totalCycles <= 1;
        const editControls = canEdit ? `
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success set-active-cycle-btn" data-cycle-id="${cycle.id}" ${isActive ? 'disabled' : ''}>Set Active</button>
                <button class="btn btn-sm btn-outline-danger delete-cycle-btn" data-cycle-id="${cycle.id}" ${deleteDisabled ? 'disabled' : ''} title="${deleteDisabled ? 'Cannot delete' : 'Delete'}"><i class="bi bi-trash"></i></button>
            </div>` : '';

        return `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div><h6 class="mb-0">${cycle.name} ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}</h6><small class="text-muted">${cycle.startDate} to ${cycle.endDate}</small></div>
                ${editControls}
            </li>`;
    }

    renderSettingsView(project, preferences = {}) {
        const view = document.getElementById('settings-view');
        if (!view) return;
    
        const mission = project.foundation.mission || '';
        const vision = project.foundation.vision || '';
        const analytics = buildEngagementAnalytics(project);
    
        const teamsHtml = project.teams.map(team => `
            <li class="list-group-item d-flex justify-content-between align-items-center" data-team-id="${team.id}">
                <span class="team-name">${team.name}</span>
                <input type="text" class="form-control form-control-sm d-none edit-team-name-input" value="${team.name}">
                <div class="team-actions">
                    <button class="btn btn-sm btn-outline-secondary edit-team-btn"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-team-btn"><i class="bi bi-trash"></i></button>
                    <button class="btn btn-sm btn-success d-none save-team-btn"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-secondary d-none cancel-edit-team-btn"><i class="bi bi-x-lg"></i></button>
                </div>
            </li>
        `).join('');
    
        view.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card h-100">
                        <div class="card-header"><h4><i class="bi bi-info-circle-fill me-2"></i>Project Details</h4></div>
                        <div class="card-body">
                            <form id="project-details-form">
                                <div class="mb-3">
                                    <label for="settings-project-name" class="form-label">Project Name</label>
                                    <input type="text" class="form-control" id="settings-project-name" value="${project.name}" required>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Project Name</button>
                            </form>
                        </div>
                    </div>
                </div>
    
                <div class="col-lg-6">
                    <div class="card h-100">
                        <div class="card-header"><h4><i class="bi bi-flag-fill me-2"></i>North Star</h4></div>
                        <div class="card-body">
                            <form id="foundation-form">
                                <div class="mb-3">
                                    <label for="foundation-mission" class="form-label">Mission Statement</label>
                                    <textarea class="form-control" id="foundation-mission" rows="3" required>${mission}</textarea>
                                </div>
                                <div class="mb-3">
                                    <label for="foundation-vision" class="form-label">Vision Statement</label>
                                    <textarea class="form-control" id="foundation-vision" rows="3" required>${vision}</textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Foundation</button>
                            </form>
                        </div>
                    </div>
                </div>
    
                <div class="col-12">
                    <div class="card">
                        <div class="card-header"><h4><i class="bi bi-people-fill me-2"></i>Team Management</h4></div>
                        <div class="card-body">
                            <ul class="list-group mb-3" id="team-list">${teamsHtml}</ul>
                            <form id="add-team-form" class="d-flex gap-2">
                                <input type="text" id="add-team-name" class="form-control" placeholder="New team name" required>
                                <button type="submit" class="btn btn-primary">Add Team</button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6"><div class="card h-100"><div class="card-header"><h4><i class="bi bi-bell me-2"></i>In-app engagement</h4></div><div class="card-body"><p class="text-muted small">These preferences affect only your cockpit experience. No email is sent.</p><form id="engagement-preferences-form"><div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="preference-notifications" ${preferences.inAppNotifications !== false ? 'checked' : ''}><label class="form-check-label" for="preference-notifications">Useful action notifications</label></div><div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="preference-weekly-summary" ${preferences.weeklySummary !== false ? 'checked' : ''}><label class="form-check-label" for="preference-weekly-summary">Weekly in-app summary</label></div><div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" id="preference-celebrations" ${preferences.celebrations !== false ? 'checked' : ''}><label class="form-check-label" for="preference-celebrations">Subtle milestone celebrations</label></div><button class="btn btn-primary" type="submit">Save preferences</button></form></div></div></div>
                <div class="col-lg-6"><div class="card h-100"><div class="card-header"><h4><i class="bi bi-activity me-2"></i>Engagement health</h4></div><div class="card-body"><p class="text-muted small">Privacy-safe cycle aggregates. No individual ranking or session-time tracking.</p><div class="analytics-grid"><div><strong>${analytics.checkIns}</strong><span>Evidence updates</span></div><div><strong>${analytics.resolvedRisks}</strong><span>Risks resolved</span></div><div><strong>${analytics.staleKeyResults}</strong><span>Stale KRs</span></div><div><strong>${analytics.activeContributors}</strong><span>Active contributors</span></div></div></div></div></div>
            </div>
        `;
    }    

    renderCascadeView(project) {
        const view = document.getElementById('cascade-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>'; return; }
        const escape = value => this._escapeHtml(value || '');
        const objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
        const owners = [{ id: 'company', name: project.companyName || project.name, icon: 'bi-buildings' }, ...(project.teams || []).map(team => ({ ...team, icon: 'bi-people' }))];
        const objectiveLookup = new Map(objectivesInCycle.map(objective => [objective.id, objective]));
        const ownerGroups = owners.map(owner => ({
            ...owner,
            objectives: objectivesInCycle.filter(objective => objective.ownerId === owner.id)
        })).filter(owner => owner.objectives.length);
        view.innerHTML = `
            <div class="view-intro"><div><p class="eyebrow">${escape(activeCycle.name)}</p><h2>Strategy to outcomes</h2><p>A readable map of direction, ownership, Objectives, and explicit dependencies.</p></div><span class="view-intro__meta">${objectivesInCycle.length} aligned objectives</span></div>
            <section class="alignment-foundation" aria-label="Strategic direction">
                <article><span><i class="bi bi-flag"></i> Mission</span><p>${escape(project.foundation?.mission || 'No mission defined yet.')}</p></article>
                <article><span><i class="bi bi-eye"></i> Vision</span><p>${escape(project.foundation?.vision || 'No vision defined yet.')}</p></article>
            </section>
            <div class="alignment-flow-label" aria-hidden="true"><span>Direction</span><i class="bi bi-arrow-down"></i><span>Owners & outcomes</span></div>
            <section class="alignment-groups" aria-label="Owners and aligned Objectives">
                ${ownerGroups.length ? ownerGroups.map(owner => `<article class="alignment-owner"><header><span class="alignment-owner__icon"><i class="bi ${owner.icon}"></i></span><div><small>Owner</small><h3>${escape(owner.name)}</h3></div><span class="alignment-owner__count">${owner.objectives.length}</span></header><div class="alignment-objectives">${owner.objectives.map(objective => {
                    const dependencies = (objective.dependsOn || []).map(id => objectiveLookup.get(id)).filter(Boolean);
                    return `<div class="alignment-objective"><div class="alignment-objective__top"><span class="alignment-objective__mark">O</span><h4>${escape(objective.title)}</h4><strong>${Math.round(objective.progress || 0)}%</strong></div><div class="alignment-objective__progress"><span style="width:${Math.max(0, Math.min(100, objective.progress || 0))}%"></span></div><p>${objective.keyResults?.length || 0} key results${objective.responsible ? ` · ${escape(objective.responsible)}` : ''}</p>${dependencies.length ? `<div class="alignment-dependencies"><small>Depends on</small>${dependencies.map(dependency => `<a href="#explorer" title="Open Objectives">${escape(dependency.title)}</a>`).join('')}</div>` : ''}</div>`;
                }).join('')}</div></article>`).join('') : '<div class="alert alert-info">Add Objectives to the active cycle to build the alignment map.</div>'}
            </section>`;
    }

    renderNewProjectModal() { return `<div class="modal fade" id="newProjectModal" data-bs-backdrop="static" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><form id="new-project-form"><div class="modal-header"><h5 class="modal-title">New Project</h5></div><div class="modal-body"><h6>Details</h6><div class="mb-3"><label for="project-name" class="form-label">Name</label><input type="text" class="form-control" id="project-name" required></div><div class="mb-3"><label for="project-mission" class="form-label">Mission</label><textarea class="form-control" id="project-mission" rows="2" required></textarea></div><div class="mb-3"><label for="project-vision" class="form-label">Vision</label><textarea class="form-control" id="project-vision" rows="2" required></textarea></div><hr><h6>Teams</h6><p class="text-muted small">One team per line.</p><div class="mb-3"><textarea class="form-control" id="project-teams" rows="4"></textarea></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Create</button></div></form></div></div></div>`; }
    renderObjectiveModal() { return `<div class="modal fade drawer-modal" id="objectiveModal" tabindex="-1"><div class="modal-dialog drawer-dialog modal-dialog-scrollable"><div class="modal-content"><form id="objective-form"><div class="modal-header"><div><p class="eyebrow mb-1">Outcome definition</p><h5 class="modal-title" id="objective-modal-title">Add Objective</h5></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><input type="hidden" id="objective-id"><div class="mb-3"><label for="objective-title" class="form-label">Title</label><input type="text" class="form-control" id="objective-title" required></div><div class="row g-3 mb-3"><div class="col-md-6"><label for="objective-owner" class="form-label">Owner</label><select class="form-select" id="objective-owner" required></select></div><div class="col-md-6"><label for="objective-responsible" class="form-label">Responsible</label><input type="text" class="form-control" id="objective-responsible"></div></div><div class="row g-3 mb-3"><div class="col-md-6"><label for="objective-start-date" class="form-label">Start date</label><input type="date" class="form-control" id="objective-start-date"></div><div class="col-md-6"><label for="objective-end-date" class="form-label">End date</label><input type="date" class="form-control" id="objective-end-date"></div></div><div class="mb-3"><label for="objective-notes" class="form-label">Context and assumptions</label><textarea class="form-control" id="objective-notes" rows="5"></textarea></div><div class="mb-3"><label for="objective-depends-on" class="form-label">Dependencies</label><select class="form-select" id="objective-depends-on" multiple style="height: 150px;"></select><div class="form-text">Use Ctrl/Cmd to select multiple Objectives.</div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Objective</button></div></form></div></div></div>`; }
    renderKeyResultModal() { return `<div class="modal fade drawer-modal" id="keyResultModal" tabindex="-1"><div class="modal-dialog drawer-dialog modal-dialog-scrollable"><div class="modal-content"><form id="kr-form"><div class="modal-header"><div><p class="eyebrow mb-1">Measurable evidence</p><h5 class="modal-title" id="kr-modal-title">Add Key Result</h5></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><input type="hidden" id="kr-objective-id"><input type="hidden" id="kr-id"><div class="mb-3"><label for="kr-title" class="form-label">Key Result</label><input type="text" class="form-control" id="kr-title" required></div><div class="row g-3 mb-3"><div class="col-4"><label for="kr-start-value" class="form-label">Start</label><input type="number" class="form-control" id="kr-start-value" value="0" required></div><div class="col-4"><label for="kr-current-value" class="form-label">Current</label><input type="number" class="form-control" id="kr-current-value" value="0" required></div><div class="col-4"><label for="kr-target-value" class="form-label">Target</label><input type="number" class="form-control" id="kr-target-value" required></div></div><div class="mb-3"><label for="kr-confidence" class="form-label">Confidence</label><select class="form-select" id="kr-confidence" required><option>On Track</option><option>At Risk</option><option>Off Track</option></select></div><div class="mb-3"><label for="kr-notes" class="form-label">Measurement definition and evidence source</label><textarea class="form-control" id="kr-notes" rows="5"></textarea></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Key Result</button></div></form></div></div></div>`; }
    renderOkrSpecificationModal() {
        const options = (values, placeholder) => `<option value="">${placeholder}</option>${values.map(value => `<option value="${value}">${value}</option>`).join('')}`;
        return `<div class="modal fade" id="okrSpecificationModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><form id="okr-specification-form"><div class="modal-header"><div><p class="eyebrow mb-1">Agent-derived metadata</p><h5 class="modal-title">Review OKR set specification</h5></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><input type="hidden" id="okr-spec-cycle-id"><div class="alert alert-info small">This specification was inferred from the circular interview. Review it before saving; Objectives inherit these values unless an explicit override exists.</div><h6 class="mb-3">Classification</h6><div class="row g-3 mb-4"><div class="col-md-4"><label class="form-label" for="okr-spec-category">Category</label><select class="form-select" id="okr-spec-category">${options(OKR_CATEGORIES, 'Not inferred')}</select></div><div class="col-md-4"><label class="form-label" for="okr-spec-level">Level</label><select class="form-select" id="okr-spec-level">${options(OKR_LEVELS, 'Not inferred')}</select></div><div class="col-md-4"><label class="form-label" for="okr-spec-commitment">Commitment</label><select class="form-select" id="okr-spec-commitment">${options(OKR_COMMITMENTS, 'Not inferred')}</select></div></div><h6 class="mb-3">Operating context</h6><div class="row g-3 mb-4"><div class="col-md-6"><label class="form-label" for="okr-spec-industry">Industry</label><input class="form-control" id="okr-spec-industry"></div><div class="col-md-6"><label class="form-label" for="okr-spec-geography">Country / region</label><input class="form-control" id="okr-spec-geography"></div><div class="col-md-6"><label class="form-label" for="okr-spec-business-unit">Business unit</label><input class="form-control" id="okr-spec-business-unit"></div><div class="col-md-6"><label class="form-label" for="okr-spec-time-horizon">Time horizon</label><input class="form-control" id="okr-spec-time-horizon"></div><div class="col-md-6"><label class="form-label" for="okr-spec-services">Services / offering</label><textarea class="form-control" id="okr-spec-services" rows="3" placeholder="One per line"></textarea></div><div class="col-md-6"><label class="form-label" for="okr-spec-stakeholders">Stakeholders</label><textarea class="form-control" id="okr-spec-stakeholders" rows="3" placeholder="One per line"></textarea></div></div><h6 class="mb-3">Systemic synthesis</h6><div class="mb-3"><label class="form-label" for="okr-spec-outcome-thesis">Outcome thesis</label><textarea class="form-control" id="okr-spec-outcome-thesis" rows="2"></textarea></div><div class="mb-3"><label class="form-label" for="okr-spec-rationale">Rationale</label><textarea class="form-control" id="okr-spec-rationale" rows="3"></textarea></div><div class="row g-3"><div class="col-md-6"><label class="form-label" for="okr-spec-perspectives">Stakeholder perspectives</label><textarea class="form-control" id="okr-spec-perspectives" rows="4" placeholder="One insight per line"></textarea></div><div class="col-md-6"><label class="form-label" for="okr-spec-tensions">Productive tensions</label><textarea class="form-control" id="okr-spec-tensions" rows="4" placeholder="One tension per line"></textarea></div><div class="col-md-6"><label class="form-label" for="okr-spec-assumptions">Assumptions</label><textarea class="form-control" id="okr-spec-assumptions" rows="4" placeholder="One assumption per line"></textarea></div><div class="col-md-6"><label class="form-label" for="okr-spec-success-signals">Success signals</label><textarea class="form-control" id="okr-spec-success-signals" rows="4" placeholder="One signal per line"></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save specification</button></div></form></div></div></div>`;
    }
    renderOkrDetailDrawer() {
        return `<div class="modal fade drawer-modal" id="okrDetailModal" tabindex="-1" aria-labelledby="okr-detail-title"><div class="modal-dialog drawer-dialog modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><div><p class="eyebrow mb-1">Contextual workspace</p><h5 class="modal-title" id="okr-detail-title">Outcome details</h5></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body" id="okr-detail-content"></div></div></div></div>`;
    }
    renderCommandPaletteModal(canEdit, isOwner, project) {
        const escape = value => this._escapeHtml(value || '');
        const command = (action, icon, title, hint, search, target = '') => `<button type="button" class="command-item" data-command="${action}" data-target="${escape(target)}" data-search="${escape(search.toLocaleLowerCase())}"><i class="bi ${icon}"></i><span><strong>${escape(title)}</strong><small>${escape(hint)}</small></span><i class="bi bi-arrow-return-left"></i></button>`;
        const activeCycle = project.cycles?.find(cycle => cycle.status === 'Active');
        const objectives = (project.objectives || []).filter(objective => objective.cycleId === activeCycle?.id);
        const itemCommands = objectives.flatMap(objective => [command('open-item','bi-bullseye',objective.title,`${this._ownerName(project, objective.ownerId)} · Objective`,`objective ${objective.title}`,`${objective.id}|`), ...(objective.keyResults || []).map(keyResult => command('open-item','bi-graph-up',keyResult.title,`Key Result · ${objective.title}`,`key result ${keyResult.title} ${objective.title}`,`${objective.id}|${keyResult.id}`))]).join('');
        return `<div class="modal fade command-palette-modal" id="commandPaletteModal" tabindex="-1" aria-labelledby="command-palette-title"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="command-search"><i class="bi bi-search"></i><input id="command-palette-input" type="search" placeholder="Search views, Objectives, and actions…" autocomplete="off" aria-label="Search commands"><kbd>Esc</kbd></div><div class="command-results"><section class="command-group"><h2 id="command-palette-title">Navigate</h2>${command('navigate','bi-grid-1x2','Overview','Attention and supporting metrics','overview dashboard attention','#dashboard')}${command('navigate','bi-check2-square','Weekly Focus','Private next actions and team challenges','weekly focus next action','#weekly-focus')}${command('navigate','bi-bullseye','Objectives','Review and update outcomes','objectives explorer okr','#explorer')}${command('navigate','bi-lightning-charge','Momentum','Private progress and team levels','momentum levels badges','#momentum')}${command('navigate','bi-diagram-3','Alignment','Direction, owners, and dependencies','alignment cascade dependencies','#cascade')}${command('navigate','bi-calendar3','Timeline','Named Objective and KR schedule','timeline gantt dates','#gantt')}${command('navigate','bi-exclamation-triangle','Risks','Exposed Key Results','risks confidence','#risk-board')}${command('navigate','bi-compass','Deep Dive','Systemic OKR context','deep dive context','#deep-dive')}${command('navigate','bi-lightbulb','Workbench','Shape early ideas','workbench ideas','#workbench')}${command('navigate','bi-arrow-repeat','Cycles','Manage planning cycles','cycles manage','#cycles')}${isOwner ? command('navigate','bi-gear','Settings','Workspace configuration','settings manage','#settings') : ''}</section><section class="command-group"><h2>Outcomes</h2>${itemCommands || '<p class="command-empty">No Objectives in the active cycle.</p>'}</section><section class="command-group"><h2>Act</h2>${canEdit ? command('new-objective','bi-plus-circle','New Objective','Open the Objective drawer','new add create objective') : ''}${command('coach','bi-stars','Ask OKR Coach','Open contextual guidance','coach chat ask ai')}${command('share','bi-people','Share workspace','Manage members and access','share members access')}</section></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> browse</span><span><kbd>Enter</kbd> select</span></footer></div></div></div>`;
    }
    renderShareProjectModal() { return `<div class="modal fade" id="shareProjectModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Share Project</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div id="owner-disclaimer" class="alert alert-info small">As owner, you can manage members.</div><h6>Members</h6><ul class="list-group mb-4" id="project-members-list"><li class="list-group-item">Loading...</li></ul><form id="invite-member-form"><h6>Invite New Member</h6><div class="input-group"><input type="email" id="invite-email-input" class="form-control" placeholder="user@example.com" required><select id="invite-role-select" class="form-select flex-grow-0 w-auto"><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button type="submit" class="btn btn-primary">Invite</button></div></form></div></div></div></div>`; }
}
