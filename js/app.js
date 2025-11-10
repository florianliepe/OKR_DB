import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// IMPORTANT: Paste your firebaseConfig object here
const firebaseConfig = {
    apiKey: "AIzaSyC26f3QvnPD9F0_l_BNBdrGOvwICq86t1g",
    authDomain: "eraokr-4d70a.firebaseapp.com",
    projectId: "eraokr-4d70a",
    storageBucket: "eraokr-4d70a.appspot.com",
    messagingSenderId: "78295398521",
    appId: "1:78295398521:web:ea3c7e8e9f7b8e247c7ca8",
    measurementId: "G-GMY1CXXY4E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Auth Guard ---
onAuthStateChanged(auth, user => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (user && isLoginPage) {
        window.location.href = 'index.html';
    } else if (!user && !isLoginPage) {
        window.location.href = 'login.html';
    } else if (user && !isLoginPage) {
        // User is logged in and on the correct page, so initialize the app
        initializeApp();
    }
});

function initializeApp() {
    // Dynamically import the app's main classes AFTER auth is confirmed
    Promise.all([
        import('./store.js'),
        import('./ui.js')
    ]).then(([{ Store }, { UI }]) => {

        const store = new Store();
        const ui = new UI();
        let currentViewListeners = [];

        // ... rest of the app logic ...
        // (The content of your old app.js file from `let explorerResponsibleFilter = 'all';` downwards goes here)

        // State for view-specific filters
        let explorerResponsibleFilter = 'all';
        let dashboardOwnerFilter = 'all';
        let dashboardResponsibleFilter = 'all';


        function cleanupListeners() {
            currentViewListeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
            currentViewListeners = [];
        }
        
        function addListener(element, type, handler) {
            element.addEventListener(type, handler);
            currentViewListeners.push({ element, type, handler });
        }

        function initializeTooltips() {
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            [...tooltipTriggerList].forEach(tooltipTriggerEl => {
                const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
                if (tooltip) {
                    tooltip.dispose();
                }
            });
            [...tooltipTriggerList].forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
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
            addListener(document.getElementById('app-container'), 'click', e => {
                const card = e.target.closest('.project-card');
                const deleteBtn = e.target.closest('.delete-project-btn');
                const archiveBtn = e.target.closest('.archive-project-btn');
                const unarchiveBtn = e.target.closest('.unarchive-project-btn');
                const cloneBtn = e.target.closest('.clone-project-btn');
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
                if (cloneBtn) {
                    e.stopPropagation();
                    store.cloneProject(cloneBtn.dataset.projectId);
                    ui.showToast('Project cloned successfully.');
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

            const handleGanttDateChange = (task, start, end) => {
                const formattedStart = start.toISOString().split('T')[0];
                const formattedEnd = end.toISOString().split('T')[0];
                
                if (confirm(`Change dates for "${task.name}" to ${formattedStart} - ${formattedEnd}?`)) {
                    const objective = project.objectives.find(o => o.id === task.id);
                    if (objective) {
                        store.updateObjective(task.id, { ...objective, startDate: formattedStart, endDate: formattedEnd });
                        ui.showToast('Objective dates updated.');
                    }
                } else {
                    router();
                }
            };

            const router = () => {
                project = store.getCurrentProject();
                if (!project) { main(); return; }
                const hash = window.location.hash || '#dashboard';
                ui.showView(hash.substring(1) + '-view');
                switch(hash) {
                    case '#dashboard': ui.renderDashboardView(project, dashboardOwnerFilter, dashboardResponsibleFilter); break;
                    case '#explorer': ui.renderExplorerView(project, document.getElementById('search-input').value, explorerResponsibleFilter); break;
                    case '#gantt': ui.renderGanttView(project, handleGanttDateChange); break;
                    case '#risk-board': ui.renderRiskBoardView(project); break;
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

            addListener(document.getElementById('logout-btn'), 'click', () => {
                signOut(auth).then(() => {
                    ui.showToast('You have been logged out.', 'info');
                    // onAuthStateChanged will handle the redirect
                }).catch(error => {
                    console.error("Logout error:", error);
                    ui.showToast('Error logging out.', 'danger');
                });
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
            
            addListener(document.getElementById('search-input'), 'input', e => {
                ui.renderExplorerView(project, e.target.value, explorerResponsibleFilter);
                initializeTooltips();
            });
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
                if (e.target.id === 'dashboard-filter-owner') {
                    dashboardOwnerFilter = e.target.value;
                    project = store.getCurrentProject();
                    ui.renderDashboardView(project, dashboardOwnerFilter, dashboardResponsibleFilter);
                }
                if (e.target.id === 'dashboard-filter-responsible') {
                    dashboardResponsibleFilter = e.target.value;
                    project = store.getCurrentProject();
                    ui.renderDashboardView(project, dashboardOwnerFilter, dashboardResponsibleFilter);
                }
                 if (e.target.id === 'explorer-filter-responsible') {
                    explorerResponsibleFilter = e.target.value;
                    project = store.getCurrentProject();
                    ui.renderExplorerView(project, document.getElementById('search-input').value, explorerResponsibleFilter);
                    initializeTooltips();
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
                let newOrderedIds = [...container.querySelectorAll('.okr-card:not(.dragging)')].map(el => el.id);
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
                    const id = document.getElementById('objective-id').value;
                    const selectedOptions = document.getElementById('objective-depends-on').selectedOptions;
                    const dependsOn = Array.from(selectedOptions).map(opt => opt.value);
                    const data = {
                        title: document.getElementById('objective-title').value, ownerId: document.getElementById('objective-owner').value,
                        notes: document.getElementById('objective-notes').value, dependsOn: dependsOn,
                        startDate: document.getElementById('objective-start-date').value,
                        endDate: document.getElementById('objective-end-date').value,
                        responsible: document.getElementById('objective-responsible').value.trim()
                    };
                    if(id) { store.updateObjective(id, data); ui.showToast('Objective updated successfully!'); } 
                    else { store.addObjective(data); ui.showToast('Objective added successfully!'); }
                    ui.hideModal('objectiveModal');
                    router();
                }
                if (e.target.id === 'kr-form') {
                    const objId = document.getElementById('kr-objective-id').value;
                    const krId = document.getElementById('kr-id').value;
                    const data = {
                        title: document.getElementById('kr-title').value, startValue: document.getElementById('kr-start-value').value,
                        currentValue: document.getElementById('kr-current-value').value, targetValue: document.getElementById('kr-target-value').value,
                        confidence: document.getElementById('kr-confidence').value,
                        notes: document.getElementById('kr-notes').value
                    };
                    if (krId) { store.updateKeyResult(objId, krId, data); ui.showToast('Key Result updated successfully!'); } 
                    else { store.addKeyResult(objId, data); ui.showToast('Key Result added successfully!'); }
                    ui.hideModal('keyResultModal');
                    router();
                }
                if (e.target.id === 'new-cycle-form') {
                    const data = { name: document.getElementById('cycle-name').value, startDate: document.getElementById('cycle-start-date').value, endDate: document.getElementById('cycle-end-date').value };
                    store.addCycle(data);
                    ui.showToast(`Cycle "${data.name}" added successfully.`);
                    e.target.reset();
                    router();
                    ui.renderNavControls(store.getCurrentProject());
                }
                if (e.target.id === 'foundation-form') {
                    const data = { mission: document.getElementById('foundation-mission').value, vision: document.getElementById('foundation-vision').value };
                    store.updateFoundation(data);
                    ui.showToast('Foundation statements updated.');
                    router();
                }
            });

            addListener(document, 'show.bs.modal', e => {
                const modal = e.target, trigger = e.relatedTarget;
                if (!trigger) return;
                if (modal.id === 'objectiveModal') {
                    project = store.getCurrentProject();
                    const form = document.getElementById('objective-form');
                    form.reset();
                    document.getElementById('objective-id').value = '';
                    document.getElementById('objective-notes').value = '';
                    document.getElementById('objective-responsible').value = '';
                    const ownerSelect = document.getElementById('objective-owner');
                    const owners = [{ id: 'company', name: project.companyName }, ...project.teams];
                    ownerSelect.innerHTML = owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
                    const objId = trigger.dataset.objectiveId;
                    const activeCycle = project.cycles.find(c => c.status === 'Active');
                    const possibleDependencies = project.objectives.filter(o => o.cycleId === activeCycle?.id && o.id !== objId);
                    const dependsOnSelect = document.getElementById('objective-depends-on');
                    dependsOnSelect.innerHTML = possibleDependencies.map(o => `<option value="${o.id}">${o.title}</option>`).join('');
                    if (objId) {
                        document.getElementById('objective-modal-title').textContent = 'Edit Objective';
                        const obj = project.objectives.find(o => o.id === objId);
                        if (obj) {
                            document.getElementById('objective-id').value = obj.id;
                            document.getElementById('objective-title').value = obj.title;
                            document.getElementById('objective-owner').value = obj.ownerId;
                            document.getElementById('objective-notes').value = obj.notes || '';
                            document.getElementById('objective-start-date').value = obj.startDate || '';
                            document.getElementById('objective-end-date').value = obj.endDate || '';
                            document.getElementById('objective-responsible').value = obj.responsible || '';
                            if (obj.dependsOn) {
                                Array.from(dependsOnSelect.options).forEach(opt => {
                                    if (obj.dependsOn.includes(opt.value)) opt.selected = true;
                                });
                            }
                        }
                    } else { document.getElementById('objective-modal-title').textContent = 'Add Objective'; }
                }
                if (modal.id === 'keyResultModal') {
                    project = store.getCurrentProject();
                    const form = document.getElementById('kr-form');
                    form.reset();
                    document.getElementById('kr-id').value = '';
                    document.getElementById('kr-start-value').value = 0;
                    document.getElementById('kr-confidence').value = 'On Track';
                    document.getElementById('kr-notes').value = '';
                    const objId = trigger.dataset.objectiveId;
                    document.getElementById('kr-objective-id').value = objId;
                    const krId = trigger.dataset.krId;
                    const objective = project.objectives.find(o => o.id === objId);
                    if (krId && objective) {
                        document.getElementById('kr-modal-title').textContent = 'Edit Key Result';
                        const kr = objective.keyResults.find(k => k.id === krId);
                        if (kr) {
                            document.getElementById('kr-id').value = kr.id;
                            document.getElementById('kr-title').value = kr.title;
                            document.getElementById('kr-start-value').value = kr.startValue;
                            document.getElementById('kr-current-value').value = kr.currentValue;
                            document.getElementById('kr-target-value').value = kr.targetValue;
                            document.getElementById('kr-confidence').value = kr.confidence || 'On Track';
                            document.getElementById('kr-notes').value = kr.notes || '';
                        }
                    } else { document.getElementById('kr-modal-title').textContent = 'Add Key Result'; document.getElementById('kr-current-value').value = 0; }
                }
            });

            router();
            ui.renderNavControls(project);
        }
        
    });
});
