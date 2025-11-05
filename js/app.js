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

    function initializeTooltips() {
        // First, dispose of any existing tooltips to prevent memory leaks
        const existingTooltips = bootstrap.Tooltip.getInstance(document.body);
        if (existingTooltips) {
             document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                const tooltip = bootstrap.Tooltip.getInstance(el);
                if (tooltip) {
                    tooltip.dispose();
                }
            });
        }
        // Then, initialize new ones
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
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

        // Attach main listener to the app container for broader event delegation
        addListener(document.getElementById('app-container'), 'click', e => {
            const card = e.target.closest('.project-card');
            const deleteBtn = e.target.closest('.delete-project-btn');
            const archiveBtn = e.target.closest('.archive-project-btn');
            const unarchiveBtn = e.target.closest('.unarchive-project-btn');
            const toggleBtn = e.target.closest('#toggle-archived-btn');

            if (toggleBtn) {
                 const container = document.getElementById('archived-projects-container');
                if (container) {
                    const isHidden = container.style.display === 'none';
                    container.style.display = isHidden ? 'block' : 'none';
                    toggleBtn.textContent = isHidden ? 'Hide Archived Projects' : `Show ${container.querySelectorAll('.project-card').length} Archived Project(s)`;
                }
                return;
            }

            if (deleteBtn) {
                e.stopPropagation();
                const projectId = deleteBtn.dataset.projectId, projectName = deleteBtn.dataset.projectName;
                if (confirm(`Are you sure you want to PERMANENTLY DELETE the project "${projectName}"? This action cannot be undone.`)) {
                    store.deleteProject(projectId);
                    ui.showToast(`Project "${projectName}" deleted.`, 'danger');
                    main();
                }
                return;
            }
             if (archiveBtn) {
                e.stopPropagation();
                store.archiveProject(archiveBtn.dataset.projectId);
                ui.showToast('Project archived.', 'info');
                main();
                return;
            }
            if (unarchiveBtn) {
                e.stopPropagation();
                store.unarchiveProject(unarchiveBtn.dataset.projectId);
                ui.showToast('Project unarchived.');
                main();
                return;
            }
            if (card && card.id === 'create-new-project-card') {
                ui.showModal('newProjectModal');
            } else if (card) {
                store.setCurrentProjectId(card.dataset.projectId);
                main();
            }
        });

        const importInput = document.getElementById('import-project-input');
        if (importInput) {
            addListener(importInput, 'change', e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const projectData = JSON.parse(event.target.result);
                        const importedProject = store.importProject(projectData);
                        if (importedProject) {
                            ui.showToast(`Project "${importedProject.name}" imported successfully.`);
                            main();
                        } else {
                            ui.showToast('Failed to import project. Invalid file format.', 'danger');
                        }
                    } catch (err) {
                        console.error('Error parsing project file:', err);
                        ui.showToast('Failed to import project. File is not valid JSON.', 'danger');
                    }
                    e.target.value = '';
                };
                reader.readAsText(file);
            });
        }
        
        addListener(document.getElementById('new-project-form'), 'submit', e => {
            e.preventDefault();
            const projectName = document.getElementById('project-name').value;
            const initialData = {
                projectName: projectName,
                mission: document.getElementById('project-mission').value,
                vision: document.getElementById('project-vision').value,
                teams: document.getElementById('project-teams').value.split('\n').filter(t => t.trim() !== '')
            };
            const newProject = store.createNewProject(initialData);
            store.setCurrentProjectId(newProject.id);
            ui.hideModal('newProjectModal');
            ui.showToast(`Project "${projectName}" created successfully!`);
            main();
        });
    }

    function loadProject(project) {
        if (!window.location.hash || window.location.hash === '#') {
            window.location.hash = '#dashboard';
        }
        ui.renderMainLayout(project);

        const router = () => {
            project = store.getCurrentProject();
            if (!project) { main(); return; }
            const hash = window.location.hash || '#dashboard';
            ui.showView(hash.substring(1) + '-view');
            switch(hash) {
                case '#dashboard': ui.renderDashboardView(project); break;
                case '#explorer': ui.renderExplorerView(project, document.getElementById('search-input').value); break;
                case '#gantt': ui.renderGanttView(project); break;
                case '#reporting': ui.renderReportingView(project); break;
                case '#cycles': ui.renderCyclesView(project); break;
                case '#foundation': ui.renderFoundationView(project); break;
            }
            initializeTooltips();
        };

        addListener(window, 'hashchange', router);
        addListener(document.getElementById('back-to-projects'), 'click', () => { 
            window.location.hash = ''; store.setCurrentProjectId(null); main(); 
        });

        addListener(document.getElementById('export-project-btn'), 'click', () => {
            const currentProject = store.getCurrentProject();
            const projectName = currentProject.name.replace(/\s/g, '_').toLowerCase();
            const fileName = `${projectName}_okr_backup.json`;
            const dataStr = JSON.stringify(currentProject, null, 2);
            const dataBlob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(dataBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
            ui.showToast(`Project exported to ${fileName}.`, 'info');
        });
        
        addListener(document.getElementById('search-input'), 'input', e => ui.renderExplorerView(project, e.target.value));
        addListener(document.getElementById('cycle-selector-list'), 'click', e => {
            if (e.target.dataset.cycleId) {
                e.preventDefault();
                store.setActiveCycle(e.target.dataset.cycleId);
                const activeCycle = store.getCurrentProject().cycles.find(c => c.id === e.target.dataset.cycleId);
                ui.showToast(`Active cycle set to "${activeCycle.name}".`, 'info');
                router();
                ui.renderNavControls(store.getCurrentProject());
            }
        });
        
        addListener(document.getElementById('app-container'), 'click', e => {
            if (e.target.closest('.delete-obj-btn')) {
                const objId = e.target.closest('.delete-obj-btn').dataset.objectiveId;
                if(confirm('Are you sure you want to delete this objective and all its key results?')) {
                    store.deleteObjective(objId);
                    ui.showToast('Objective deleted.', 'danger');
                    router();
                }
            }
            if (e.target.closest('.delete-kr-btn')) {
                const { objectiveId, krId } = e.target.closest('.delete-kr-btn').dataset;
                if(confirm('Are you sure you want to delete this key result?')) {
                    store.deleteKeyResult(objectiveId, krId);
                    ui.showToast('Key Result deleted.', 'danger');
                    router();
                }
            }
            if (e.target.closest('.delete-cycle-btn')) {
                const cycleId = e.target.closest('.delete-cycle-btn').dataset.cycleId;
                 if(confirm('Are you sure you want to delete this cycle? All objectives within it will also be deleted.')) {
                    store.deleteCycle(cycleId);
                    ui.showToast('Cycle deleted.', 'danger');
                    router();
                 }
            }
            if (e.target.closest('.set-active-cycle-btn')) {
                const cycleId = e.target.closest('.set-active-cycle-btn').dataset.cycleId;
                store.setActiveCycle(cycleId);
                project = store.getCurrentProject();
                const activeCycle = project.cycles.find(c => c.id === cycleId);
                ui.showToast(`Active cycle set to "${activeCycle.name}".`, 'info');
                ui.renderCyclesView(project);
                ui.renderNavControls(project);
            }
            if (e.target.id === 'edit-foundation-btn') ui.renderFoundationView(project, true);
            if (e.target.id === 'cancel-edit-foundation-btn') ui.renderFoundationView(project, false);
        });

        addListener(document.getElementById('app-container'), 'change', e => {
            if (e.target.id === 'report-date-input') {
                const newDate = e.target.value;
                project = store.getCurrentProject();
                ui.renderReportingView(project, newDate);
            }
            if (e.target.id === 'dashboard-filter') {
                const filterOwnerId = e.target.value;
                project = store.getCurrentProject();
                ui.renderDashboardView(project, filterOwnerId);
            }
        });

        // --- Drag and Drop Logic ---
        addListener(document.getElementById('explorer-view'), 'dragstart', e => {
            if (e.target.classList.contains('okr-card')) {
                e.target.classList.add('dragging');
            }
        });

        addListener(document.getElementById('explorer-view'), 'dragend', e => {
            if (e.target.classList.contains('okr-card')) {
                e.target.classList.remove('dragging');
            }
        });

        addListener(document.getElementById('explorer-view'), 'dragover', e => {
            e.preventDefault();
            const container = e.target.closest('.objective-list');
            if (!container) return;

            const existingPlaceholder = container.querySelector('.drag-over-placeholder');
            if(existingPlaceholder) existingPlaceholder.remove();

            const afterElement = getDragAfterElement(container, e.clientY);
            const placeholder = document.createElement('div');
            placeholder.classList.add('drag-over-placeholder');

            if (afterElement == null) {
                container.appendChild(placeholder);
            } else {
                container.insertBefore(placeholder, afterElement);
            }
        });

        addListener(document.getElementById('explorer-view'), 'drop', e => {
            e.preventDefault();
            const container = e.target.closest('.objective-list');
            const placeholder = container?.querySelector('.drag-over-placeholder');
            if(placeholder) placeholder.remove();

            const draggedElement = document.querySelector('.dragging');
            if (!draggedElement || !container) return;
            
            let newOrderedIds = [...container.querySelectorAll('.okr-card:not(.dragging)')]
                .map(el => el.id);

            const afterElement = getDragAfterElement(container, e.clientY);

            if (afterElement == null) {
                newOrderedIds.push(draggedElement.id);
            } else {
                const insertIndex = newOrderedIds.indexOf(afterElement.id);
                newOrderedIds.splice(insertIndex, 0, draggedElement.id);
            }
            
            store.reorderObjectives(newOrderedIds);
            router();
            ui.showToast('Objectives reordered.');
        });
        
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.okr-card:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
        addListener(document, 'submit', e => {
            e.preventDefault();
            if (e.target.id === 'objective-form') {
                const id = document.getElementB
