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
                const projectId = deleteBtn.dataset.projectId, projectName = deleteBtn.dataset.projectName;
                if (confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
                    store.deleteProject(projectId);
                    ui.showToast(`Project "${projectName}" deleted.`, 'danger');
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
                case '#cycles': ui.renderCyclesView(project); break;
                case '#foundation': ui.renderFoundationView(project); break;
            }
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
