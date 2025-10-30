class UI {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.modalContainer = document.getElementById('modal-container');
        this.modals = {};
    }

    _initModal(id) {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            this.modals[id] = new bootstrap.Modal(modalEl);
        }
    }
    
    showModal(id) { this.modals[id]?.show(); }
    hideModal(id) { this.modals[id]?.hide(); }

    renderProjectSwitcher(projects) {
        this.appContainer.innerHTML = `
            <div class="container vh-100 d-flex flex-column justify-content-center">
                <div class="text-center mb-5">
                    <h1 class="display-4"><i class="bi bi-bullseye"></i> OKR Master</h1>
                    <p class="lead">Select an OKR Project or create a new one.</p>
                </div>
                <div class="row g-4 justify-content-center" id="project-list">
                    ${projects.map(this.renderProjectCard).join('')}
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
        this._initModal('newProjectModal');
    }

    renderProjectCard(project) {
        const objectives = project.objectives || [];
        const cycles = project.cycles || [];
        return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card project-card bg-dark text-white h-100" data-project-id="${project.id}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${project.name}</h5>
                        <p class="card-text text-muted small flex-grow-1">${objectives.length} objectives across ${cycles.length} cycles.</p>
                        <button class="btn btn-sm btn-outline-danger mt-2 align-self-end delete-project-btn" data-project-id="${project.id}"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    renderMainLayout() {
        this.appContainer.innerHTML = `
            <div class="container-fluid g-0">
                <div class="row g-0 vh-100">
                    <div id="sidebar-col" class="col-auto bg-dark p-3">
                        <nav id="sidebar" class="d-flex flex-column h-100">
                            <div class="d-flex align-items-center mb-3 text-white text-decoration-none">
                                <i class="bi bi-bullseye me-2 fs-4"></i><span class="fs-4">OKR Master</span>
                            </div><hr>
                            <ul class="nav nav-pills flex-column mb-auto">
                                <li class="nav-item"><a href="#explorer" class="nav-link text-white active" data-view="explorer-view"><i class="bi bi-columns-gap me-2"></i> OKR Explorer</a></li>
                                <li><a href="#cycles" class="nav-link text-white" data-view="cycles-view"><i class="bi bi-arrow-repeat me-2"></i> Cycle Management</a></li>
                                <li><a href="#foundation" class="nav-link text-white" data-view="foundation-view"><i class="bi bi-flag-fill me-2"></i> North Star</a></li>
                            </ul><hr>
                            <div class="d-flex flex-column gap-2">
                                <button class="btn btn-sm btn-outline-secondary" id="back-to-projects"><i class="bi bi-box-arrow-left me-2"></i>Back to Projects</button>
                                <label for="import-excel" class="btn btn-outline-secondary btn-sm" style="cursor: pointer;"><i class="bi bi-upload me-2"></i> Import from Excel</label>
                                <input type="file" id="import-excel" accept=".xlsx, .xls" style="display: none;"><a class="btn btn-outline-secondary btn-sm" href="#" id="export-excel-btn"><i class="bi bi-download me-2"></i> Export to Excel</a>
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
                            <div id="cycles-view" class="view-container"></div>
                            <div id="foundation-view" class="view-container"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        this.modalContainer.innerHTML = `${this.renderObjectiveModal()}${this.renderKeyResultModal()}`;
        this._initModal('objectiveModal');
        this._initModal('keyResultModal');
    }
    
    renderExplorerView(project, searchTerm = '') { /* ... unchanged ... */ }
    renderCyclesView(project) { /* ... unchanged ... */ }
    renderFoundationView(project, isEditing = false) { /* ... unchanged ... */ }
    
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
    renderObjectiveModal() { return `<!-- ... full HTML for objectiveModal from previous steps ... -->`; }
    renderKeyResultModal() { return `<!-- ... full HTML for keyResultModal from previous steps ... -->`; }
}
