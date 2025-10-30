document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const ui = new UI();
    let currentViewListeners = [];

    function cleanupListeners() {
        currentViewListeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
        currentViewListeners = [];
    }
    
    function addListener(element, type, handler) {
        element.addEventListener(type, handler);
        currentViewListeners.push({ element, type, handler });
    }

    function main() {
        cleanupListeners();
        const currentProject = store.getCurrentProject();
        if (currentProject) {
            loadProject(currentProject);
        } else {
            loadProjectSwitcher();
        }
    }

    function loadProjectSwitcher() {
        ui.renderProjectSwitcher(store.getProjects());
        
        addListener(document.getElementById('project-list'), 'click', e => {
            const card = e.target.closest('.project-card');
            const deleteBtn = e.target.closest('.delete-project-btn');
            
            if (deleteBtn) {
                e.stopPropagation();
                const projectId = deleteBtn.dataset.projectId;
                const projectName = deleteBtn.dataset.projectName;
                if (confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
                    store.deleteProject(projectId);
                    main();
                }
                return;
            }

            if (card && card.id === 'create-new-project-card') {
                ui.showModal('newProjectModal');
            } else if (card) {
                store.setCurrentProjectId(card.dataset.projectId);
                main();
            }
        });

        addListener(document.getElementById('new-project-form'), 'submit', e => {
            e.preventDefault();
            const initialData = {
                projectName: document.getElementById('project-name').value,
                mission: document.getElementById('project-mission').value,
                vision: document.getElementById('project-vision').value,
                teams: document.getElementById('project-teams').value.split('\n').filter(t => t.trim() !== '')
            };
            const newProject = store.createNewProject(initialData);
            store.setCurrentProjectId(newProject.id);
            ui.hideModal('newProjectModal');
            main();
        });
    }

    function loadProject(project) {
        ui.renderMainLayout(project);

        const router = () => {
            const hash = window.location.hash || '#explorer';
            ui.showView(hash.substring(1) + '-view');
            switch(hash) {
                case '#explorer': ui.renderExplorerView(project, document.getElementById('search-input').value); break;
                case '#cycles': ui.renderCyclesView(project); break;
                case '#foundation': ui.renderFoundationView(project); break;
            }
        };

        // --- GLOBAL LISTENERS ---
        addListener(window, 'hashchange', router);
        addListener(document.getElementById('back-to-projects'), 'click', () => { store.setCurrentProjectId(null); main(); });
        
        // --- NAV CONTROLS LISTENERS ---
        addListener(document.getElementById('search-input'), 'input', e => ui.renderExplorerView(project, e.target.value));
        addListener(document.getElementById('cycle-selector-list'), 'click', e => {
            if (e.target.dataset.cycleId) {
                e.preventDefault();
                store.setActiveCycle(e.target.dataset.cycleId);
                project = store.getCurrentProject(); // Re-fetch project data
                ui.renderNavControls(project);
                ui.renderExplorerView(project, document.getElementById('search-input').value);
            }
        });
        
        // --- DYNAMIC CONTENT LISTENERS (EVENT DELEGATION) ---
        addListener(document.getElementById('app-container'), 'click', e => {
            // Objective actions
            if (e.target.closest('.delete-obj-btn')) {
                const objId = e.target.closest('.delete-obj-btn').dataset.objectiveId;
                if(confirm('Are you sure you want to delete this objective and all its key results?')) {
                    store.deleteObjective(objId);
                    router();
                }
            }
            // Key Result actions
            if (e.target.closest('.delete-kr-btn')) {
                const btn = e.target.closest('.delete-kr-btn');
                const { objectiveId, krId } = btn.dataset;
                if(confirm('Are you sure you want to delete this key result?')) {
                    store.deleteKeyResult(objectiveId, krId);
                    router();
                }
            }
            // Cycle actions
            if (e.target.closest('.delete-cycle-btn')) {
                const cycleId = e.target.closest('.delete-cycle-btn').dataset.cycleId;
                 if(confirm('Are you sure you want to delete this cycle? All objectives within it will also be deleted.')) {
                    store.deleteCycle(cycleId);
                    project = store.getCurrentProject();
                    ui.renderCyclesView(project);
                 }
            }
            if (e.target.closest('.set-active-cycle-btn')) {
                const cycleId = e.target.closest('.set-active-cycle-btn').dataset.cycleId;
                store.setActiveCycle(cycleId);
                project = store.getCurrentProject();
                ui.renderCyclesView(project);
                ui.renderNavControls(project);
            }
            // Foundation actions
            if (e.target.id === 'edit-foundation-btn') ui.renderFoundationView(project, true);
            if (e.target.id === 'cancel-edit-foundation-btn') ui.renderFoundationView(project, false);
        });
        
        // --- FORM SUBMISSIONS ---
        addListener(document, 'submit', e => {
            e.preventDefault();
            // Objective form
            if (e.target.id === 'objective-form') {
                const id = document.getElementById('objective-id').value;
                const data = {
                    title: document.getElementById('objective-title').value,
                    ownerId: document.getElementById('objective-owner').value
                };
                if(id) store.updateObjective(id, data); else store.addObjective(data);
                ui.hideModal('objectiveModal');
                router();
            }
            // Key Result form
            if (e.target.id === 'kr-form') {
                const objId = document.getElementById('kr-objective-id').value;
                const krId = document.getElementById('kr-id').value;
                const data = {
                    title: document.getElementById('kr-title').value,
                    startValue: document.getElementById('kr-start-value').value,
                    currentValue: document.getElementById('kr-current-value').value,
                    targetValue: document.getElementById('kr-target-value').value,
                };
                if (krId) store.updateKeyResult(objId, krId, data); else store.addKeyResult(objId, data);
                ui.hideModal('keyResultModal');
                router();
            }
            // New cycle form
            if (e.target.id === 'new-cycle-form') {
                const data = {
                    name: document.getElementById('cycle-name').value,
                    startDate: document.getElementById('cycle-start-date').value,
                    endDate: document.getElementById('cycle-end-date').value,
                };
                store.addCycle(data);
                e.target.reset();
                project = store.getCurrentProject();
                ui.renderCyclesView(project);
                ui.renderNavControls(project);
            }
            // Foundation form
            if (e.target.id === 'foundation-form') {
                const data = {
                    mission: document.getElementById('foundation-mission').value,
                    vision: document.getElementById('foundation-vision').value,
                };
                store.updateFoundation(data);
                project = store.getCurrentProject();
                ui.renderFoundationView(project, false);
            }
        });

        // --- MODAL POPULATION ---
        addListener(document, 'show.bs.modal', e => {
            const modal = e.target;
            const trigger = e.relatedTarget;
            if (!trigger) return;

            if (modal.id === 'objectiveModal') {
                const form = document.getElementById('objective-form');
                form.reset();
                document.getElementById('objective-id').value = '';

                const ownerSelect = document.getElementById('objective-owner');
                const owners = [{ id: 'company', name: project.companyName }, ...project.teams];
                ownerSelect.innerHTML = owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

                const objId = trigger.dataset.objectiveId;
                if (objId) {
                    document.getElementById('objective-modal-title').textContent = 'Edit Objective';
                    const obj = project.objectives.find(o => o.id === objId);
                    document.getElementById('objective-id').value = obj.id;
                    document.getElementById('objective-title').value = obj.title;
                    document.getElementById('objective-owner').value = obj.ownerId;
                } else {
                    document.getElementById('objective-modal-title').textContent = 'Add Objective';
                }
            }

            if (modal.id === 'keyResultModal') {
                const form = document.getElementById('kr-form');
                form.reset();
                document.getElementById('kr-id').value = '';
                document.getElementById('kr-start-value').value = 0;

                const objId = trigger.dataset.objectiveId;
                document.getElementById('kr-objective-id').value = objId;

                const krId = trigger.dataset.krId;
                const objective = project.objectives.find(o => o.id === objId);
                
                if (krId && objective) {
                    document.getElementById('kr-modal-title').textContent = 'Edit Key Result';
                    const kr = objective.keyResults.find(k => k.id === krId);
                    document.getElementById('kr-id').value = kr.id;
                    document.getElementById('kr-title').value = kr.title;
                    document.getElementById('kr-start-value').value = kr.startValue;
                    document.getElementById('kr-current-value').value = kr.currentValue;
                    document.getElementById('kr-target-value').value = kr.targetValue;
                } else {
                    document.getElementById('kr-modal-title').textContent = 'Add Key Result';
                    document.getElementById('kr-current-value').value = 0;
                }
            }
        });

        // Initial render
        router();
        ui.renderNavControls(project);
    }
    
    main(); // Start the application
});
