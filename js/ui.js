class UI {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.modalContainer = document.getElementById('modal-container');
        this.modals = {};
    }

    _getOrInitModal(id) {
        if (!this.modals[id]) {
            const modalEl = document.getElementById(id);
            if (modalEl) {
                this.modals[id] = new bootstrap.Modal(modalEl);
            }
        }
        return this.modals[id];
    }
    
    showModal(id) { this._getOrInitModal(id)?.show(); }
    hideModal(id) { this._getOrInitModal(id)?.hide(); }

    renderProjectSwitcher(projects) {
        this.appContainer.innerHTML = `
            <div class="container vh-100 d-flex flex-column justify-content-center">
                <div class="text-center mb-5">
                    <h1 class="display-4"><i class="bi bi-bullseye"></i> OKR Master</h1>
                    <p class="lead">Select an OKR Project or create a new one.</p>
                </div>
                <div class="row g-4 justify-content-center" id="project-list">
                    ${projects.map(p => this.renderProjectCard(p)).join('')}
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card project-card text-center h-100 bg-body-tertiary" id="create-new-project-card">
                            <div class="card-body d-flex flex-column justify-content-center">
                                <i class="bi bi-plus-circle-dotted fs-1"></i>
                                <h5 class="card-title mt-3">Create New Project</h5>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        this.modalContainer.innerHTML = this.renderNewProjectModal();
    }

    renderProjectCard(project) {
        const objectives = project.objectives || [];
        const cycles = project.cycles || [];
        return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card project-card bg-dark text-white h-100" data-project-id="${project.id}">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start">
                             <h5 class="card-title mb-0">${project.name}</h5>
                             <button class="btn btn-sm btn-outline-danger delete-project-btn" data-project-id="${project.id}" data-project-name="${project.name}"><i class="bi bi-trash"></i></button>
                        </div>
                        <p class="card-text text-muted small flex-grow-1 mt-2">${objectives.length} objectives across ${cycles.length} cycles.</p>
                        <div class="text-end text-primary">Open Project <i class="bi bi-arrow-right-circle"></i></div>
                    </div>
                </div>
            </div>`;
    }

    renderMainLayout(project) {
        this.appContainer.innerHTML = `
            <div class="container-fluid g-0">
                <div class="row g-0 vh-100">
                    <div id="sidebar-col" class="col-auto bg-dark p-3">
                        <nav id="sidebar" class="d-flex flex-column h-100">
                            <div class="d-flex align-items-center mb-3 text-white text-decoration-none">
                                <i class="bi bi-bullseye me-2 fs-4"></i><span class="fs-4 text-nowrap">${project.name}</span>
                            </div><hr>
                            <ul class="nav nav-pills flex-column mb-auto">
                                <li class="nav-item"><a href="#explorer" class="nav-link text-white active" data-view="explorer-view"><i class="bi bi-columns-gap me-2"></i> OKR Explorer</a></li>
                                <li><a href="#cycles" class="nav-link text-white" data-view="cycles-view"><i class="bi bi-arrow-repeat me-2"></i> Cycle Management</a></li>
                                <li><a href="#foundation" class="nav-link text-white" data-view="foundation-view"><i class="bi bi-flag-fill me-2"></i> North Star</a></li>
                            </ul><hr>
                            <div class="d-flex flex-column gap-2">
                                <button class="btn btn-sm btn-outline-light" id="back-to-projects"><i class="bi bi-box-arrow-left me-2"></i>All Projects</button>
                                <!-- Import/Export can be re-enabled later
                                <label for="import-excel" class="btn btn-outline-secondary btn-sm" style="cursor: pointer;"><i class="bi bi-upload me-2"></i> Import from Excel</label>
                                <input type="file" id="import-excel" accept=".xlsx, .xls" style="display: none;"><a class="btn btn-outline-secondary btn-sm" href="#" id="export-excel-btn"><i class="bi bi-download me-2"></i> Export to Excel</a>
                                -->
                            </div>
                        </nav>
                    </div>
                    <div class="col p-0 d-flex flex-column main-content-col">
                        <nav class="navbar top-bar">
                            <div class="container-fluid"><span class="navbar-brand mb-0 h1" id="view-title"></span>
                                <div class="d-flex align-items-center gap-2" id="nav-controls">
                                    <input class="form-control" type="search" id="search-input" placeholder="Search objectives..." style="width: 250px;">
                                    <div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" id="cycle-selector-btn" disabled></button>
                                        <ul class="dropdown-menu dropdown-menu-end" id="cycle-selector-list"></ul>
                                    </div>
                                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#objectiveModal" id="add-objective-btn" disabled><i class="bi bi-plus-circle"></i> Add Objective</button>
                                </div>
                            </div>
                        </nav>
                        <div class="p-4 content-scroll-area">
                            <div id="explorer-view" class="view-container"></div>
                            <div id="cycles-view" class="view-container" style="display:none;"></div>
                            <div id="foundation-view" class="view-container" style="display:none;"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        this.modalContainer.innerHTML = `${this.renderObjectiveModal()}${this.renderKeyResultModal()}`;
    }

    showView(viewId) {
        document.querySelectorAll('.view-container').forEach(v => v.style.display = 'none');
        document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
        
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.style.display = 'block';
        
        const linkEl = document.querySelector(`[data-view="${viewId}"]`);
        if (linkEl) linkEl.classList.add('active');
        
        const navControls = document.getElementById('nav-controls');
        const viewTitle = document.getElementById('view-title');
        
        if (navControls) navControls.style.display = viewId === 'explorer-view' ? 'flex' : 'none';
        
        if (viewTitle) {
            if (viewId === 'explorer-view') viewTitle.textContent = 'OKR Explorer';
            if (viewId === 'cycles-view') viewTitle.textContent = 'Cycle Management';
            if (viewId === 'foundation-view') viewTitle.textContent = 'North Star (Mission & Vision)';
        }
    }

    renderNavControls(project) {
        const cycleSelectorList = document.getElementById('cycle-selector-list');
        const cycleSelectorBtn = document.getElementById('cycle-selector-btn');
        const addObjectiveBtn = document.getElementById('add-objective-btn');

        if (!cycleSelectorBtn || !cycleSelectorList || !addObjectiveBtn) return;
        
        const activeCycle = project.cycles.find(c => c.status === 'Active') || project.cycles[0];
        
        if (activeCycle) {
            cycleSelectorBtn.textContent = activeCycle.name;
            cycleSelectorBtn.disabled = false;
            addObjectiveBtn.disabled = false;
        } else {
            cycleSelectorBtn.textContent = 'No Cycles';
            cycleSelectorBtn.disabled = true;
            addObjectiveBtn.disabled = true;
        }
        
        cycleSelectorList.innerHTML = project.cycles.map(cycle => `<li><a class="dropdown-item ${cycle.id === activeCycle?.id ? 'active' : ''}" href="#" data-cycle-id="${cycle.id}">${cycle.name}</a></li>`).join('');
    }

    renderExplorerView(project, searchTerm = '') {
        const view = document.getElementById('explorer-view');
        if (!view) return;
        
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) {
            view.innerHTML = '<div class="alert alert-warning">No active cycle found. Please go to "Cycle Management" to set an active cycle.</div>';
            return;
        }
        
        let objectives = project.objectives.filter(o => o.cycleId === activeCycle.id);
        
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            objectives = objectives.filter(o => 
                o.title.toLowerCase().includes(lowercasedTerm) || 
                (o.notes && o.notes.toLowerCase().includes(lowercasedTerm)) ||
                o.keyResults.some(kr => kr.title.toLowerCase().includes(lowercasedTerm))
            );
        }

        const companyObjectives = objectives.filter(o => o.ownerId === 'company');
        let html = this.renderObjectiveGroup(project.companyName, companyObjectives, project);
        
        project.teams.forEach(team => {
            const teamObjectives = objectives.filter(o => o.ownerId === team.id);
            html += this.renderObjectiveGroup(team.name, teamObjectives, project);
        });
        
        if (!html && searchTerm) {
            view.innerHTML = `<div class="text-center p-5"><h3>No results for "${searchTerm}".</h3></div>`;
        } else if (!html) {
            view.innerHTML = '<div class="text-center p-5 bg-body-secondary rounded"><h3>No Objectives for this Cycle</h3><p>Click "Add Objective" to begin.</p></div>';
        } else {
            view.innerHTML = html;
        }
    }

    renderObjectiveGroup(groupName, objectives, project) {
        if (objectives.length === 0) return '';
        return `
            <div class="mb-5">
                <h2 class="team-header">${groupName}</h2>
                <div class="d-flex flex-column gap-3">
                    ${objectives.map(obj => this.renderOkrCard(obj, project)).join('')}
                </div>
            </div>`;
    }

    renderOkrCard(objective, project) {
        const notesHtml = (objective.notes && objective.notes.trim() !== '') 
            ? `<div class="obj-notes">${marked.parse(objective.notes)}</div>` 
            : '';

        return `
        <div class="card okr-card" id="obj-${objective.id}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">${objective.title}</h5>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary edit-obj-btn" data-bs-toggle="modal" data-bs-target="#objectiveModal" data-objective-id="${objective.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-obj-btn" data-objective-id="${objective.id}"><i class="bi bi-trash"></i></button>
                </div>
            </div>
            <div class="card-body">
                <div class="progress mb-3" style="height: 1.5rem;">
                    <div class="progress-bar" role="progressbar" style="width: ${objective.progress}%;" aria-valuenow="${objective.progress}" aria-valuemin="0" aria-valuemax="100">
                        <span class="progress-bar-label">${objective.progress}%</span>
                    </div>
                </div>
                ${notesHtml}
                <div class="key-results-list">
                    ${objective.keyResults.map(kr => this.renderKeyResult(kr, objective.id)).join('')}
                </div>
            </div>
            <div class="card-footer text-end">
                <button class="btn btn-sm btn-primary add-kr-btn" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objective.id}"><i class="bi bi-plus-circle"></i> Add Key Result</button>
            </div>
        </div>`;
    }

    renderKeyResult(kr, objectiveId) {
        const progress = kr.progress || 0;
        return `
        <div class="kr-item">
            <div class="kr-title">${kr.title}</div>
            <div class="kr-progress-container">
                <small class="text-muted d-flex justify-content-between"><span>${kr.currentValue}</span> <span>of ${kr.targetValue}</span></small>
                <div class="progress" style="--bs-progress-height: 0.75rem;">
                    <div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
            <div class="kr-actions">
                <button class="btn btn-sm btn-outline-secondary edit-kr-btn" data-bs-toggle="modal" data-bs-target="#keyResultModal" data-objective-id="${objectiveId}" data-kr-id="${kr.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-kr-btn" data-objective-id="${objectiveId}" data-kr-id="${kr.id}"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
    }

    renderCyclesView(project) {
        const view = document.getElementById('cycles-view');
        if (!view) return;
        view.innerHTML = `
        <div class="row g-4">
            <div class="col-md-5">
                <div class="card">
                    <div class="card-header"><h4>Add New Cycle</h4></div>
                    <div class="card-body">
                        <form id="new-cycle-form">
                            <div class="mb-3"><label for="cycle-name" class="form-label">Cycle Name</label><input type="text" class="form-control" id="cycle-name" placeholder="e.g., Q1 2024" required></div>
                            <div class="mb-3"><label for="cycle-start-date" class="form-label">Start Date</label><input type="date" class="form-control" id="cycle-start-date" required></div>
                            <div class="mb-3"><label for="cycle-end-date" class="form-label">End Date</label><input type="date" class="form-control" id="cycle-end-date" required></div>
                            <button type="submit" class="btn btn-primary">Add Cycle</button>
                        </form>
                    </div>
                </div>
            </div>
            <div class="col-md-7">
                <div class="card">
                    <div class="card-header"><h4>Existing Cycles</h4></div>
                    <div class="card-body">
                        <ul class="list-group" id="cycle-list">
                            ${project.cycles.length > 0 ? project.cycles.map(c => this.renderCycleListItem(c, project.cycles.length)).join('') : '<li class="list-group-item">No cycles created yet.</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        </div>`;
    }
    
    renderCycleListItem(cycle, totalCycles) {
        const isActive = cycle.status === 'Active';
        const deleteDisabled = isActive || totalCycles <= 1;
        return `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">${cycle.name} ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}</h6>
                    <small class="text-muted">${cycle.startDate} to ${cycle.endDate}</small>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-success set-active-cycle-btn" data-cycle-id="${cycle.id}" ${isActive ? 'disabled' : ''}>Set Active</button>
                    <button class="btn btn-sm btn-outline-danger delete-cycle-btn" data-cycle-id="${cycle.id}" ${deleteDisabled ? 'disabled' : ''} title="${deleteDisabled ? 'Cannot delete the active or only cycle' : 'Delete cycle'}"><i class="bi bi-trash"></i></button>
                </div>
            </li>`;
    }

    renderFoundationView(project, isEditing = false) {
        const view = document.getElementById('foundation-view');
        if (!view) return;
        
        const mission = project.foundation.mission || '';
        const vision = project.foundation.vision || '';
        
        const displayView = `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h4><i class="bi bi-gem me-2 text-primary"></i>Mission</h4>
                    <button class="btn btn-outline-secondary" id="edit-foundation-btn"><i class="bi bi-pencil"></i> Edit</button>
                </div>
                <div class="card-body"><p class="fs-5">${mission.replace(/\n/g, '<br>') || '<em>Not defined.</em>'}</p></div>
            </div>
            <div class="card">
                <div class="card-header"><h4><i class="bi bi-binoculars-fill me-2 text-primary"></i>Vision</h4></div>
                <div class="card-body"><p class="fs-5">${vision.replace(/\n/g, '<br>') || '<em>Not defined.</em>'}</p></div>
            </div>`;
        
        const editView = `
            <form id="foundation-form">
                <div class="card mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h4><i class="bi bi-gem me-2 text-primary"></i>Mission</h4>
                    </div>
                    <div class="card-body"><textarea class="form-control" id="foundation-mission" rows="4" required>${mission}</textarea></div>
                </div>
                <div class="card mb-4">
                    <div class="card-header"><h4><i class="bi bi-binoculars-fill me-2 text-primary"></i>Vision</h4></div>
                    <div class="card-body"><textarea class="form-control" id="foundation-vision" rows="4" required>${vision}</textarea></div>
                </div>
                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" id="cancel-edit-foundation-btn">Cancel</button>
                </div>
            </form>`;
        
        view.innerHTML = isEditing ? editView : displayView;
    }
    
    // --- TEMPLATES ---
    renderNewProjectModal() {
        return `
        <div class="modal fade" id="newProjectModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <form id="new-project-form">
                        <div class="modal-header"><h5 class="modal-title">Create New OKR Project</h5></div>
                        <div class="modal-body">
                            <h6>Step 1: Project Details</h6>
                            <div class="mb-3"><label for="project-name" class="form-label">Project / Company Name</label><input type="text" class="form-control" id="project-name" required></div>
                            <div class="mb-3"><label for="project-mission" class="form-label">Mission Statement</label><textarea class="form-control" id="project-mission" rows="2" required></textarea></div>
                            <div class="mb-3"><label for="project-vision" class="form-label">Vision Statement</label><textarea class="form-control" id="project-vision" rows="2" required></textarea></div>
                            <hr>
                            <h6>Step 2: Define Your Teams</h6>
                            <p class="text-muted small">List the teams or departments that will have their own OKRs. Enter one team name per line.</p>
                            <div class="mb-3"><textarea class="form-control" id="project-teams" rows="4" placeholder="Team Alpha\nTeam Bravo\nMarketing"></textarea></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Project</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
    }
    renderObjectiveModal(owners = []) {
        return `
        <div class="modal fade" id="objectiveModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <form id="objective-form">
                        <div class="modal-header"><h5 class="modal-title" id="objective-modal-title">Add Objective</h5></div>
                        <div class="modal-body">
                            <input type="hidden" id="objective-id">
                            <div class="mb-3"><label for="objective-title" class="form-label">Objective Title</label><input type="text" class="form-control" id="objective-title" required></div>
                            <div class="mb-3"><label for="objective-owner" class="form-label">Owner</label><select class="form-select" id="objective-owner" required></select></div>
                            <div class="mb-3"><label for="objective-notes" class="form-label">Notes (Markdown supported)</label><textarea class="form-control" id="objective-notes" rows="5"></textarea></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="submit" class="btn btn-primary">Save Objective</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
    }
    renderKeyResultModal() {
        return `
        <div class="modal fade" id="keyResultModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <form id="kr-form">
                        <div class="modal-header"><h5 class="modal-title" id="kr-modal-title">Add Key Result</h5></div>
                        <div class="modal-body">
                            <input type="hidden" id="kr-objective-id">
                            <input type="hidden" id="kr-id">
                            <div class="mb-3"><label for="kr-title" class="form-label">Key Result Title</label><input type="text" class="form-control" id="kr-title" required></div>
                            <div class="row">
                                <div class="col"><label for="kr-start-value" class="form-label">Start Value</label><input type="number" class="form-control" id="kr-start-value" value="0" required></div>
                                <div class="col"><label for="kr-current-value" class="form-label">Current Value</label><input type="number" class="form-control" id="kr-current-value" value="0" required></div>
                                <div class="col"><label for="kr-target-value" class="form-label">Target Value</label><input type="number" class="form-control" id="kr-target-value" required></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="submit" class="btn btn-primary">Save Key Result</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
    }
}
