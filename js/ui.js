// js/ui.js

export class UI {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.modalContainer = document.getElementById('modal-container');
        this.modals = {};
        this.charts = {};
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
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
    
    showModal(id) { this._getOrInitModal(id)?.show(); }
    hideModal(id) { this._getOrInitModal(id)?.hide(); }

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
            <div class="container py-5">
                <div class="text-center mb-5">
                    <h1 class="display-4"><i class="bi bi-bullseye"></i> OKR Master</h1>
                    <p class="lead">Select an OKR Project or create a new one.</p>
                </div>
                <div class="row g-4 justify-content-center" id="project-list">
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card project-card text-center h-100 bg-body-tertiary" id="create-new-project-card">
                            <div class="card-body d-flex flex-column justify-content-center">
                                <i class="bi bi-plus-circle-dotted fs-1"></i>
                                <h5 class="card-title mt-3">Create New Project</h5>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-4">
                        <label for="import-project-input" class="card project-card text-center h-100 bg-body-tertiary" style="cursor: pointer;">
                            <div class="card-body d-flex flex-column justify-content-center">
                                <i class="bi bi-upload fs-1"></i>
                                <h5 class="card-title mt-3">Import Project</h5>
                                <input type="file" id="import-project-input" accept=".json" style="display: none;">
                            </div>
                        </label>
                    </div>
                    ${activeProjects.map(p => this.renderProjectCard(p, userId)).join('')}
                </div>
                <div class="row justify-content-center">
                    ${archivedSectionHtml}
                </div>
            </div>`;
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
                <div class="card project-card bg-dark text-white h-100" data-project-id="${project.id}">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start">
                             <h5 class="card-title mb-0">${project.name}</h5>
                             <div class="d-flex gap-2">
                                ${actionButtons}
                             </div>
                        </div>
                        <p class="card-text text-muted small flex-grow-1 mt-2">${objectives.length} objectives across ${cycles.length} cycles.</p>
                        <div class="text-end text-primary">Open Project <i class="bi bi-arrow-right-circle"></i></div>
                    </div>
                </div>
            </div>`;
    }

    renderMainLayout(project, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        this.appContainer.innerHTML = `
            <div class="container-fluid g-0">
                <div class="row g-0 vh-100">
                    <div id="sidebar-col" class="col-auto bg-dark p-3">
                        <nav id="sidebar" class="d-flex flex-column h-100">
                            <div class="d-flex align-items-center mb-3 text-white text-decoration-none">
                                <i class="bi bi-bullseye me-2 fs-4"></i><span class="fs-4 text-nowrap">${project.name}</span>
                            </div><hr>
                            <ul class="nav nav-pills flex-column mb-auto">
                                <li class="nav-item"><a href="#dashboard" class="nav-link text-white" data-view="dashboard-view"><i class="bi bi-bar-chart-line-fill me-2"></i> Dashboard</a></li>
                                <li class="nav-item"><a href="#explorer" class="nav-link text-white" data-view="explorer-view"><i class="bi bi-columns-gap me-2"></i> OKR Explorer</a></li>
                                <li class="nav-item"><a href="#workbench" class="nav-link text-white" data-view="workbench-view"><i class="bi bi-lightbulb-fill me-2"></i> Workbench</a></li>
                                <li class="nav-item"><a href="#gantt" class="nav-link text-white" data-view="gantt-view"><i class="bi bi-bar-chart-steps me-2"></i> Gantt</a></li>
                                <li class="nav-item"><a href="#risk-board" class="nav-link text-white" data-view="risk-board-view"><i class="bi bi-exclamation-triangle-fill me-2"></i> Risk Board</a></li>
                                <li class="nav-item"><a href="#reporting" class="nav-link text-white" data-view="reporting-view"><i class="bi bi-clock-history me-2"></i> Reporting</a></li>
                                <li class="nav-item"><a href="#cycles" class="nav-link text-white" data-view="cycles-view"><i class="bi bi-arrow-repeat me-2"></i> Cycle Management</a></li>
                                <li class="nav-item"><a href="#foundation" class="nav-link text-white" data-view="foundation-view"><i class="bi bi-flag-fill me-2"></i> North Star</a></li>
                            </ul><hr>
                            <div class="d-flex flex-column gap-2">
                                <button class="btn btn-sm btn-outline-secondary" id="export-project-btn"><i class="bi bi-download me-2"></i> Export Project</button>
                                <button class="btn btn-sm btn-outline-light" id="back-to-projects"><i class="bi bi-box-arrow-left me-2"></i>All Projects</button>
                                <button class="btn btn-sm btn-danger" id="logout-btn"><i class="bi bi-power me-2"></i>Logout</button>
                            </div>
                        </nav>
                    </div>
                    <div class="col p-0 d-flex flex-column main-content-col">
                        <nav class="navbar top-bar">
                            <div class="container-fluid">
                                <span class="navbar-brand mb-0 h1" id="view-title"></span>
                                <div class="d-flex align-items-center gap-2" id="nav-controls">
                                    <input class="form-control" type="search" id="search-input" placeholder="Search objectives..." style="width: 250px;">
                                    <div class="dropdown">
                                        <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" id="cycle-selector-btn" disabled></button>
                                        <ul class="dropdown-menu dropdown-menu-end" id="cycle-selector-list"></ul>
                                    </div>
                                    ${canEdit ? `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#objectiveModal" id="add-objective-btn"><i class="bi bi-plus-circle"></i> Add Objective</button>` : ''}
                                    <button class="btn btn-outline-info" data-bs-toggle="modal" data-bs-target="#shareProjectModal" id="share-project-btn"><i class="bi bi-people-fill"></i> Share</button>
                                </div>
                            </div>
                        </nav>
                        <div class="p-4 content-scroll-area">
                            <div id="dashboard-view" class="view-container" style="display:none;"></div>
                            <div id="explorer-view" class="view-container" style="display:none;"></div>
                            <div id="workbench-view" class="view-container" style="display:none;"></div>
                            <div id="gantt-view" class="view-container" style="display:none;"></div>
                            <div id="risk-board-view" class="view-container" style="display:none;"></div>
                            <div id="reporting-view" class="view-container" style="display:none;"></div>
                            <div id="cycles-view" class="view-container" style="display:none;"></div>
                            <div id="foundation-view" class="view-container" style="display:none;"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        this.modalContainer.innerHTML = `${this.renderObjectiveModal()}${this.renderKeyResultModal()}${this.renderShareProjectModal()}`;
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
        this.destroyCharts();
        document.querySelectorAll('.view-container').forEach(v => v.style.display = 'none');
        document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.style.display = 'block';
        const linkEl = document.querySelector(`[data-view="${viewId}"]`);
        if (linkEl) linkEl.classList.add('active');
        const navControls = document.getElementById('nav-controls');
        const viewTitle = document.getElementById('view-title');
        
        const viewsWithNav = ['explorer-view', 'dashboard-view', 'gantt-view', 'risk-board-view', 'reporting-view'];
        if (viewsWithNav.includes(viewId)) {
            navControls.style.display = 'flex';
            document.getElementById('search-input').style.display = viewId === 'explorer-view' ? 'block' : 'none';
            document.querySelector('#nav-controls .dropdown').style.display = 'flex';
            const addObjectiveBtn = document.getElementById('add-objective-btn');
            if (addObjectiveBtn) addObjectiveBtn.style.display = 'block';
        } else {
            navControls.style.display = 'none';
        }

        if (viewTitle) {
            const titles = {
                'dashboard-view': 'Dashboard',
                'explorer-view': 'OKR Explorer',
                'workbench-view': 'Workbench',
                'gantt-view': 'Gantt Timeline',
                'risk-board-view': 'Risk Board',
                'reporting-view': 'Reporting',
                'cycles-view': 'Cycle Management',
                'foundation-view': 'North Star (Mission & Vision)'
            };
            viewTitle.textContent = titles[viewId] || '';
        }
    }

    renderWorkbenchView(content = '', userRole) {
        const view = document.getElementById('workbench-view');
        if (!view) return;
        const canEdit = userRole === 'owner' || userRole === 'editor';
        view.innerHTML = `
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span>A real-time collaborative space for drafting ideas. ${canEdit ? 'All changes are saved automatically.' : ''}</span>
                    <span id="workbench-status" class="text-muted small">${canEdit ? 'Saved' : 'Read-only'}</span>
                </div>
                <div class="card-body p-0">
                    <textarea id="workbench-editor" class="form-control h-100 border-0" ${canEdit ? '' : 'readonly'}>${content}</textarea>
                </div>
            </div>
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
                                    <div class="card risk-card ${borderColor} bg-dark mb-2">
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

    renderReportingView(project, reportDate = null) {
        const view = document.getElementById('reporting-view');
        if (!view) return;
        let reportContentHtml = '<div class="alert alert-info">Select a date to generate a status report.</div>';
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
        view.innerHTML = `
            <div class="card dashboard-card mb-4"><div class="card-body"><h5 class="card-title">Point-in-Time Report</h5><p class="card-text text-muted">Select a date to see the status of all objectives.</p><div class="col-md-4"><input type="date" id="report-date-input" class="form-control" value="${reportDate || ''}"></div></div></div>
            <div id="report-content">${reportContentHtml}</div>`;
    }

    renderGanttView(project, onDateChangeCallback) {
        const view = document.getElementById('gantt-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>'; return; }
        const objectivesForGantt = project.objectives
            .filter(obj => obj.cycleId === activeCycle.id && obj.startDate && obj.endDate)
            .map(obj => ({
                id: obj.id, name: obj.title, start: obj.startDate, end: obj.endDate,
                progress: obj.progress, dependencies: obj.dependsOn?.join(',') || ''
            }));
        if (objectivesForGantt.length === 0) { view.innerHTML = '<div class="alert alert-info">No objectives with dates found.</div>'; return; }
        view.innerHTML = '<svg id="gantt-chart"></svg>';
        new Gantt("#gantt-chart", objectivesForGantt, {
            on_date_change: onDateChangeCallback,
            header_height: 50, column_width: 30, step: 24, view_modes: ['Day', 'Week', 'Month'],
            bar_height: 20, bar_corner_radius: 3, arrow_curve: 5, padding: 18,
            view_mode: 'Week', date_format: 'YYYY-MM-DD', language: 'en'
        });
    }

    renderDashboardView(project, filterOwnerId = 'all', filterResponsible = 'all') {
        const view = document.getElementById('dashboard-view');
        if (!view) return;
        this.destroyCharts();
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        const owners = [{ id: 'company', name: project.companyName }, ...project.teams];
        const ownerFilterOptionsHtml = owners.map(owner => `<option value="${owner.id}" ${filterOwnerId === owner.id ? 'selected' : ''}>${owner.name}</option>`).join('');
        let contentHtml;
        let responsibleFilterOptionsHtml = '';
        let objectivesInCycleForCharts = [];
        if (!activeCycle) {
            contentHtml = '<div class="alert alert-warning">No active cycle found.</div>';
        } else {
            let objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
            objectivesInCycle.forEach(obj => obj.progress = this._calculateObjectiveProgress(obj)); // Ensure progress is up-to-date
            objectivesInCycleForCharts = objectivesInCycle;
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
                            <div class="card dashboard-card"><div class="card-body"><h5 class="card-title text-muted">Overall Progress (${activeCycle.name})</h5><h2 class="display-4">${overallAverage}%</h2><div class="progress" style="height: 2rem;"><div class="progress-bar" role="progressbar" style="width: ${overallAverage}%;" aria-valuenow="${overallAverage}"></div></div></div></div>
                        </div>
                        ${progressByOwnerWidget}
                        <div class="${(filterOwnerId === 'all' && filterResponsible === 'all') ? 'col-xl-6' : 'col-12'}">
                            <div class="card dashboard-card h-100"><div class="card-body"><h5 class="card-title text-muted">Key Result Health (${krHealth.Total} total)</h5><div class="d-flex justify-content-around align-items-center text-center mt-4"><div class="health-stat"><div class="stat-value text-success">${krHealth['On Track']}</div><div class="stat-label">On Track</div></div><div class="health-stat"><div class="stat-value text-warning">${krHealth['At Risk']}</div><div class="stat-label">At Risk</div></div><div class="health-stat"><div class="stat-value text-danger">${krHealth['Off Track']}</div><div class="stat-label">Off Track</div></div></div><div class="progress mt-4" style="height: 1.5rem; font-size: 0.8rem;"><div class="progress-bar bg-success" role="progressbar" style="width: ${onTrackPercent}%" title="On Track">${Math.round(onTrackPercent)}%</div><div class="progress-bar bg-warning" role="progressbar" style="width: ${atRiskPercent}%" title="At Risk">${Math.round(atRiskPercent)}%</div><div class="progress-bar bg-danger" role="progressbar" style="width: ${offTrackPercent}%" title="Off Track">${Math.round(offTrackPercent)}%</div></div></div></div>
                        </div>
                        <div class="col-xl-6"><div class="card dashboard-card"><div class="card-body"><h5 class="card-title text-muted">KR Burndown</h5><canvas id="burndown-chart"></canvas></div></div></div>
                        <div class="col-xl-6"><div class="card dashboard-card"><div class="card-body"><h5 class="card-title text-muted">Progress Velocity (WoW)</h5><canvas id="velocity-chart"></canvas></div></div></div>
                        <div class="col-12"><div class="card dashboard-card"><div class="card-body"><h5 class="card-title text-muted">Health Trend (Last 30 Days)</h5><canvas id="health-trend-chart"></canvas></div></div></div>
                    </div>`;
            }
        }
        view.innerHTML = `<div class="row g-3 justify-content-end mb-3"><div class="col-md-4"><label for="dashboard-filter-owner" class="form-label">Filter by Owner</label><select id="dashboard-filter-owner" class="form-select"><option value="all" ${filterOwnerId === 'all' ? 'selected' : ''}>All Owners</option>${ownerFilterOptionsHtml}</select></div><div class="col-md-4"><label for="dashboard-filter-responsible" class="form-label">Filter by Responsible</label><select id="dashboard-filter-responsible" class="form-select"><option value="all" ${filterResponsible === 'all' ? 'selected' : ''}>All</option>${responsibleFilterOptionsHtml}</select></div></div>${contentHtml}`;
        if (objectivesInCycleForCharts && objectivesInCycleForCharts.length > 0) {
            this._renderHealthTrendChart(objectivesInCycleForCharts);
            this._renderVelocityChart(objectivesInCycleForCharts);
            this._renderBurndownChart(project);
        }
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
                    y: { beginAtZero: true, ticks: { color: '#adb5bd', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#adb5bd', maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: { legend: { labels: { color: '#adb5bd' } } }
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
                    y: { beginAtZero: true, ticks: { color: '#adb5bd', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: { legend: { labels: { color: '#adb5bd' } } }
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
                    y: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#adb5bd' }, grid: { display: false } }
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

    renderExplorerView(project, searchTerm = '', filterResponsible = 'all', userRole) {
        const view = document.getElementById('explorer-view');
        if (!view) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) { view.innerHTML = '<div class="alert alert-warning">No active cycle found.</div>'; return; }
        let objectivesInCycle = project.objectives.filter(o => o.cycleId === activeCycle.id);
        const responsibles = [...new Set(objectivesInCycle.map(o => o.responsible).filter(Boolean))];
        const responsibleFilterOptionsHtml = responsibles.map(r => `<option value="${r}" ${filterResponsible === r ? 'selected' : ''}>${r}</option>`).join('');
        let objectivesToRender = objectivesInCycle;
        if (filterResponsible !== 'all') objectivesToRender = objectivesToRender.filter(o => o.responsible === filterResponsible);
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
        const filterHtml = `<div class="d-flex justify-content-end mb-3"><div class="col-md-4"><label for="explorer-filter-responsible" class="form-label">Filter by Responsible</label><select id="explorer-filter-responsible" class="form-select"><option value="all">All</option>${responsibleFilterOptionsHtml}</select></div></div>`;
        if (!html && (searchTerm || filterResponsible !== 'all')) view.innerHTML = filterHtml + `<div class="text-center p-5"><h3>No results.</h3></div>`; 
        else if (!html) view.innerHTML = filterHtml + `<div class="text-center p-5 bg-body-secondary rounded"><h3>No Objectives.</h3><p>Click "Add Objective" to begin.</p></div>`; 
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
        const notesHtml = (objective.notes && objective.notes.trim() !== '') ? `<div class="obj-notes">${marked.parse(highlightedNotes)}</div>` : '';
        const dependsOnList = (objective.dependsOn || []).map(depId => allObjectivesInCycle.find(o => o.id === depId)?.title).filter(Boolean).join('<br>');
        const dependsOnTooltip = dependsOnList ? `<strong>Depends On:</strong><br>${dependsOnList}` : '';
        const dependsOnCount = objective.dependsOn?.length || 0;
        const blocksList = allObjectivesInCycle.filter(o => o.dependsOn?.includes(objective.id)).map(o => o.title).join('<br>');
        const blocksTooltip = blocksList ? `<strong>Blocks:</strong><br>${blocksList}` : '';
        const blocksCount = allObjectivesInCycle.filter(o => o.dependsOn?.includes(objective.id)).length;
        const dependsOnBadge = dependsOnCount > 0 ? `<span class="badge bg-secondary ms-2" data-bs-toggle="tooltip" data-bs-html="true" title="${dependsOnTooltip}"><i class="bi bi-arrow-down"></i> ${dependsOnCount}</span>` : '';
        const blocksBadge = blocksCount > 0 ? `<span class="badge bg-warning text-dark ms-2" data-bs-toggle="tooltip" data-bs-html="true" title="${blocksTooltip}"><i class="bi bi-arrow-up"></i> ${blocksCount}</span>` : '';
        const responsibleHtml = objective.responsible ? `<span class="responsible-person ms-2"><i class="bi bi-person-fill"></i> ${objective.responsible}</span>` : '';
        const editControls = canEdit ? `
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#objectiveModal" data-objective-id="${objective.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-obj-btn" data-objective-id="${objective.id}"><i class="bi bi-trash"></i></button>
            </div>` : '';

        return `
            <div class="card okr-card" id="${objective.id}" draggable="${canEdit}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div><h5 class="mb-0 d-inline">${highlightedTitle}</h5>${dependsOnBadge}${blocksBadge}${responsibleHtml}</div>
                    ${editControls}
                </div>
                <div class="card-body">
                    <div class="progress mb-3" style="height: 1.5rem;">
                        <div class="progress-bar" role="progressbar" style="width: ${objective.progress}%;" aria-valuenow="${objective.progress}">
                            <span class="progress-bar-label">${objective.progress}%</span>
                        </div>
                    </div>
                    ${notesHtml}
                    <div class="key-results-list">${objective.keyResults.map(kr => this.renderKeyResult(kr, objective.id, searchTerm, userRole)).join('')}</div>
                </div>
                ${canEdit ? `<div class="card-footer text-end"><button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objective.id}"><i class="bi bi-plus-circle"></i> Add Key Result</button></div>` : ''}
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
        const editControls = canEdit ? `
            <div class="kr-actions">
                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objectiveId}" data-kr-id="${kr.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-kr-btn" data-objective-id="${objectiveId}" data-kr-id="${kr.id}"><i class="bi bi-trash"></i></button>
            </div>` : '';

        return `
            <div class="kr-item">
                <div class="kr-title"><span class="badge ${badgeColor} me-2">${confidence}</span>${highlightedKrTitle}${notesIcon}</div>
                <div class="kr-progress-container">
                    ${sparklineHtml}
                    <small class="text-muted d-flex justify-content-between"><span>${kr.currentValue}</span> <span>of ${kr.targetValue}</span></small>
                    <div class="progress" style="--bs-progress-height: 0.75rem;"><div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;"></div></div>
                </div>
                ${editControls}
            </div>`;
    }

    renderCyclesView(project, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const view = document.getElementById('cycles-view');
        if (!view) return;
        view.innerHTML = `
            <div class="row g-4">
                ${canEdit ? `<div class="col-md-5">
                    <div class="card"><div class="card-header"><h4>Add New Cycle</h4></div><div class="card-body"><form id="new-cycle-form"><div class="mb-3"><label for="cycle-name" class="form-label">Name</label><input type="text" class="form-control" id="cycle-name" required></div><div class="mb-3"><label for="cycle-start-date" class="form-label">Start Date</label><input type="date" class="form-control" id="cycle-start-date" required></div><div class="mb-3"><label for="cycle-end-date" class="form-label">End Date</label><input type="date" class="form-control" id="cycle-end-date" required></div><button type="submit" class="btn btn-primary">Add Cycle</button></form></div></div>
                </div>` : ''}
                <div class="${canEdit ? 'col-md-7' : 'col-12'}">
                    <div class="card"><div class="card-header"><h4>Existing Cycles</h4></div><div class="card-body"><ul class="list-group" id="cycle-list">${project.cycles.length > 0 ? project.cycles.map(c => this.renderCycleListItem(c, project.cycles.length, canEdit)).join('') : '<li class="list-group-item">No cycles.</li>'}</ul></div></div>
                </div>
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

    renderFoundationView(project, isEditing = false, userRole) {
        const canEdit = userRole === 'owner' || userRole === 'editor';
        const view = document.getElementById('foundation-view');
        if (!view) return;
        const mission = project.foundation.mission || '';
        const vision = project.foundation.vision || '';
        
        const editButton = canEdit ? `<button class="btn btn-outline-secondary" id="edit-foundation-btn"><i class="bi bi-pencil"></i> Edit</button>` : '';

        const displayView = `<div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center"><h4><i class="bi bi-gem me-2 text-primary"></i>Mission</h4>${editButton}</div><div class="card-body"><p class="fs-5">${mission.replace(/\n/g, '<br>') || '<em>Not defined.</em>'}</p></div></div><div class="card"><div class="card-header"><h4><i class="bi bi-binoculars-fill me-2 text-primary"></i>Vision</h4></div><div class="card-body"><p class="fs-5">${vision.replace(/\n/g, '<br>') || '<em>Not defined.</em>'}</p></div></div>`;
        const editView = `<form id="foundation-form"><div class="card mb-4"><div class="card-header"><h4><i class="bi bi-gem me-2 text-primary"></i>Mission</h4></div><div class="card-body"><textarea class="form-control" id="foundation-mission" rows="4" required>${mission}</textarea></div></div><div class="card mb-4"><div class="card-header"><h4><i class="bi bi-binoculars-fill me-2 text-primary"></i>Vision</h4></div><div class="card-body"><textarea class="form-control" id="foundation-vision" rows="4" required>${vision}</textarea></div></div><div class="d-flex gap-2"><button type="submit" class="btn btn-primary">Save</button><button type="button" class="btn btn-secondary" id="cancel-edit-foundation-btn">Cancel</button></div></form>`;
        view.innerHTML = isEditing && canEdit ? editView : displayView;
    }
    
    renderNewProjectModal() { return `<div class="modal fade" id="newProjectModal" data-bs-backdrop="static" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><form id="new-project-form"><div class="modal-header"><h5 class="modal-title">New Project</h5></div><div class="modal-body"><h6>Details</h6><div class="mb-3"><label for="project-name" class="form-label">Name</label><input type="text" class="form-control" id="project-name" required></div><div class="mb-3"><label for="project-mission" class="form-label">Mission</label><textarea class="form-control" id="project-mission" rows="2" required></textarea></div><div class="mb-3"><label for="project-vision" class="form-label">Vision</label><textarea class="form-control" id="project-vision" rows="2" required></textarea></div><hr><h6>Teams</h6><p class="text-muted small">One team per line.</p><div class="mb-3"><textarea class="form-control" id="project-teams" rows="4"></textarea></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Create</button></div></form></div></div></div>`; }
    renderObjectiveModal() { return `<div class="modal fade" id="objectiveModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><form id="objective-form"><div class="modal-header"><h5 class="modal-title" id="objective-modal-title">Add Objective</h5></div><div class="modal-body"><input type="hidden" id="objective-id"><div class="mb-3"><label for="objective-title" class="form-label">Title</label><input type="text" class="form-control" id="objective-title" required></div><div class="row mb-3"><div class="col-md-6"><label for="objective-owner" class="form-label">Owner</label><select class="form-select" id="objective-owner" required></select></div><div class="col-md-6"><label for="objective-responsible" class="form-label">Responsible</label><input type="text" class="form-control" id="objective-responsible"></div></div><div class="row mb-3"><div class="col-md-6"><label for="objective-start-date" class="form-label">Start Date</label><input type="date" class="form-control" id="objective-start-date"></div><div class="col-md-6"><label for="objective-end-date" class="form-label">End Date</label><input type="date" class="form-control" id="objective-end-date"></div></div><div class="mb-3"><label for="objective-notes" class="form-label">Notes</label><textarea class="form-control" id="objective-notes" rows="5"></textarea></div><div class="mb-3"><label for="objective-depends-on" class="form-label">Depends On</label><select class="form-select" id="objective-depends-on" multiple style="height: 150px;"></select></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form></div></div></div>`; }
    renderKeyResultModal() { return `<div class="modal fade" id="keyResultModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><form id="kr-form"><div class="modal-header"><h5 class="modal-title" id="kr-modal-title">Add Key Result</h5></div><div class="modal-body"><input type="hidden" id="kr-objective-id"><input type="hidden" id="kr-id"><div class="mb-3"><label for="kr-title" class="form-label">Title</label><input type="text" class="form-control" id="kr-title" required></div><div class="row mb-3"><div class="col-md-3"><label for="kr-start-value" class="form-label">Start</label><input type="number" class="form-control" id="kr-start-value" value="0" required></div><div class="col-md-3"><label for="kr-current-value" class="form-label">Current</label><input type="number" class="form-control" id="kr-current-value" value="0" required></div><div class="col-md-3"><label for="kr-target-value" class="form-label">Target</label><input type="number" class="form-control" id="kr-target-value" required></div><div class="col-md-3"><label for="kr-confidence" class="form-label">Confidence</label><select class="form-select" id="kr-confidence" required><option>On Track</option><option>At Risk</option><option>Off Track</option></select></div></div><div class="mb-3"><label for="kr-notes" class="form-label">Notes</label><textarea class="form-control" id="kr-notes" rows="3"></textarea></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form></div></div></div>`; }
    renderShareProjectModal() { return `<div class="modal fade" id="shareProjectModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Share Project</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div id="owner-disclaimer" class="alert alert-info small">As owner, you can manage members.</div><h6>Members</h6><ul class="list-group mb-4" id="project-members-list"><li class="list-group-item">Loading...</li></ul><form id="invite-member-form"><h6>Invite New Member</h6><div class="input-group"><input type="email" id="invite-email-input" class="form-control" placeholder="user@example.com" required><select id="invite-role-select" class="form-select flex-grow-0 w-auto"><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button type="submit" class="btn btn-primary">Invite</button></div></form></div></div></div></div>`; }
}
