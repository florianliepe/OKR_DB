import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { FirestoreStore } from './firestore-store.js';
import { UI } from './ui.js';

onAuthStateChanged(auth, user => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (user) {
        if (isLoginPage) window.location.href = 'index.html';
        else initializeApp(user); 
    } else {
        if (!isLoginPage) window.location.href = 'login.html';
    }
});

async function initializeApp(user) {
    const ui = new UI();
    try {
        const store = new FirestoreStore(user.uid);
        await store.loadAppData(); 
        run(store, ui);
    } catch (error) {
        console.error("Fatal Error: Could not initialize Firestore data.", error);
        ui.showToast("Error loading your data. Please refresh the page.", "danger");
    }
}

function run(store, ui) {
    let currentViewListeners = [];
    let explorerResponsibleFilter = 'all';
    let dashboardOwnerFilter = 'all';
    let dashboardResponsibleFilter = 'all';
    let workbenchUnsubscribe = null;

    function cleanupListeners() {
        currentViewListeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
        currentViewListeners = [];
        if (workbenchUnsubscribe) {
            workbenchUnsubscribe();
            workbenchUnsubscribe = null;
        }
    }
    
    function addListener(element, type, handler) {
        element.addEventListener(type, handler);
        currentViewListeners.push({ element, type, handler });
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    function initializeTooltips() {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].forEach(tooltipTriggerEl => {
            const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
            if (tooltip) tooltip.dispose();
        });
        [...tooltipTriggerList].forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }

    async function main() {
        cleanupListeners();
        const currentProject = store.getCurrentProject();
        if (currentProject) await loadProject(currentProject);
        else await loadProjectSwitcher();
    }

    async function loadProjectSwitcher() {
        ui.renderProjectSwitcher(store.getProjects());
        addListener(document.getElementById('app-container'), 'click', async e => {
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
                const projectId = deleteBtn.dataset.projectId;
                const projectName = deleteBtn.dataset.projectName;
                store.setCurrentProjectId(projectId); // Temporarily set to check ownership
                if (store.isCurrentUserOwner()) {
                    if (confirm(`Are you sure you want to PERMANENTLY DELETE the project "${projectName}"? This action cannot be undone.`)) {
                        await store.deleteProject(projectId);
                        ui.showToast(`Project "${projectName}" deleted.`, 'danger');
                    }
                } else {
                    ui.showToast('Only the project owner can delete this project.', 'danger');
                }
                store.setCurrentProjectId(null); // Unset after operation
                await main(); // Refresh the view
                return;
            }
             if (archiveBtn) {
                e.stopPropagation();
                await store.archiveProject(archiveBtn.dataset.projectId);
                ui.showToast('Project archived.', 'info');
                await main();
                return;
            }
            if (unarchiveBtn) {
                e.stopPropagation();
                await store.unarchiveProject(unarchiveBtn.dataset.projectId);
                ui.showToast('Project unarchived.');
                await main();
                return;
            }
            if (cloneBtn) {
                e.stopPropagation();
                await store.cloneProject(cloneBtn.dataset.projectId);
                ui.showToast('Project cloned successfully.');
                await main();
                return;
            }
            if (card && card.id === 'create-new-project-card') {
                ui.showModal('newProjectModal');
            } else if (card) {
                store.setCurrentProjectId(card.dataset.projectId);
                await main();
            }
        });

        const importInput = document.getElementById('import-project-input');
        if (importInput) {
            addListener(importInput, 'change', async e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const projectData = JSON.parse(event.target.result);
                        const importedProject = await store.importProject(projectData);
                        if (importedProject) {
                            ui.showToast(`Project "${importedProject.name}" imported successfully.`);
                            await main();
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
        
        addListener(document.getElementById('new-project-form'), 'submit', async e => {
            e.preventDefault();
            const projectName = document.getElementById('project-name').value;
            const initialData = {
                projectName: projectName,
                mission: document.getElementById('project-mission').value,
                vision: document.getElementById('project-vision').value,
                teams: document.getElementById('project-teams').value.split('\n').filter(t => t.trim() !== '')
            };
            const newProject = await store.createNewProject(initialData);
            store.setCurrentProjectId(newProject.id);
            ui.hideModal('newProjectModal');
            ui.showToast(`Project "${projectName}" created successfully!`);
            await main();
        });
    }

    async function loadProject(project) {
        if (!window.location.hash || window.location.hash === '#') {
            window.location.hash = '#dashboard';
        }
        ui.renderMainLayout(project);

        const router = () => {
            // *** FIX: DO NOT CLEAN UP LISTENERS ON EVERY ROUTE CHANGE ***
            // cleanupListeners(); // This was the bug. Removing it.
            
            let currentProject = store.getCurrentProject();
            if (!currentProject) { main(); return; }

            // Clean up specific listeners ONLY when leaving a view that has them.
            if (workbenchUnsubscribe) {
                workbenchUnsubscribe();
                workbenchUnsubscribe = null;
            }

            const hash = window.location.hash || '#dashboard';
            ui.showView(hash.substring(1) + '-view');
            
            switch(hash) {
                case '#dashboard': ui.renderDashboardView(currentProject, dashboardOwnerFilter, dashboardResponsibleFilter); break;
                case '#explorer': ui.renderExplorerView(currentProject, document.getElementById('search-input').value, explorerResponsibleFilter); break;
                case '#workbench': setupWorkbench(currentProject); break;
                case '#gantt': ui.renderGanttView(currentProject, handleGanttDateChange); break;
                case '#risk-board': ui.renderRiskBoardView(currentProject); break;
                case '#reporting': ui.renderReportingView(currentProject); break;
                case '#cycles': ui.renderCyclesView(currentProject); break;
                case '#foundation': ui.renderFoundationView(currentProject); break;
            }
            initializeTooltips();
        };
        
        const setupWorkbench = (project) => {
            ui.renderWorkbenchView(project.workbenchContent);
            const editor = document.getElementById('workbench-editor');
            const status = document.getElementById('workbench-status');

            workbenchUnsubscribe = store.listenForWorkbenchUpdates(content => {
                if (editor.value !== content) {
                    const cursorPos = editor.selectionStart;
                    editor.value = content;
                    editor.selectionStart = editor.selectionEnd = cursorPos;
                }
            });

            const debouncedUpdate = debounce(async (content) => {
                status.textContent = 'Saving...';
                await store.updateWorkbenchContent(content);
                status.textContent = 'Saved';
            }, 500);

            addListener(editor, 'input', () => {
                status.textContent = 'Typing...';
                debouncedUpdate(editor.value);
            });
        };
        
        const handleGanttDateChange = async (task, start, end) => {
            const formattedStart = start.toISOString().split('T')[0];
            const formattedEnd = end.toISOString().split('T')[0];
            
            if (confirm(`Change dates for "${task.name}" to ${formattedStart} - ${formattedEnd}?`)) {
                const currentProject = store.getCurrentProject();
                const objective = currentProject.objectives.find(o => o.id === task.id);
                if (objective) {
                    const updatedData = { ...objective, startDate: formattedStart, endDate: formattedEnd };
                    await store.updateObjective(task.id, updatedData);
                    ui.showToast('Objective dates updated.');
                    router(); 
                }
            } else {
                router();
            }
        };

        // These are the "global for project view" listeners. They are set up ONCE when a project loads.
        addListener(window, 'hashchange', router);
        addListener(document.getElementById('back-to-projects'), 'click', async () => { 
            window.location.hash = ''; 
            store.setCurrentProjectId(null); 
            await main(); 
        });
        addListener(document.getElementById('logout-btn'), 'click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });

        addListener(document.getElementById('export-project-btn'), 'click', () => {
            const currentProject = store.getCurrentProject();
            if (!currentProject) return;
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
            const currentProject = store.getCurrentProject();
            if (!currentProject) return;
            ui.renderExplorerView(currentProject, e.target.value, explorerResponsibleFilter);
            initializeTooltips();
        });
        addListener(document.getElementById('cycle-selector-list'), 'click', async e => {
            if (e.target.dataset.cycleId) {
                e.preventDefault();
                await store.setActiveCycle(e.target.dataset.cycleId);
                const activeCycle = store.getCurrentProject().cycles.find(c => c.id === e.target.dataset.cycleId);
                ui.showToast(`Active cycle set to "${activeCycle.name}".`, 'info');
                router();
                ui.renderNavControls(store.getCurrentProject());
            }
        });
        
        addListener(document.getElementById('app-container'), 'click', async e => {
            if (e.target.closest('.delete-obj-btn')) {
                const objId = e.target.closest('.delete-obj-btn').dataset.objectiveId;
                if(confirm('Are you sure you want to delete this objective?')) {
                    await store.deleteObjective(objId); ui.showToast('Objective deleted.', 'danger'); router();
                }
            }
            if (e.target.closest('.delete-kr-btn')) {
                const { objectiveId, krId } = e.target.closest('.delete-kr-btn').dataset;
                if(confirm('Are you sure you want to delete this key result?')) {
                    await store.deleteKeyResult(objectiveId, krId); ui.showToast('Key Result deleted.', 'danger'); router();
                }
            }
            if (e.target.closest('.delete-cycle-btn')) {
                const cycleId = e.target.closest('.delete-cycle-btn').dataset.cycleId;
                 if(confirm('Are you sure you want to delete this cycle?')) {
                    await store.deleteCycle(cycleId); ui.showToast('Cycle deleted.', 'danger'); router();
                 }
            }
            if (e.target.closest('.set-active-cycle-btn')) {
                const cycleId = e.target.closest('.set-active-cycle-btn').dataset.cycleId;
                await store.setActiveCycle(cycleId);
                const currentProject = store.getCurrentProject();
                const activeCycle = currentProject.cycles.find(c => c.id === cycleId);
                ui.showToast(`Active cycle set to "${activeCycle.name}".`, 'info');
                ui.renderCyclesView(currentProject); ui.renderNavControls(currentProject);
            }
            if (e.target.id === 'edit-foundation-btn') ui.renderFoundationView(store.getCurrentProject(), true);
            if (e.target.id === 'cancel-edit-foundation-btn') ui.renderFoundationView(store.getCurrentProject(), false);
        });

        addListener(document.getElementById('app-container'), 'change', async e => {
            let currentProject;
            if (e.target.id === 'report-date-input') {
                currentProject = store.getCurrentProject(); ui.renderReportingView(currentProject, e.target.value);
            }
            if (e.target.id === 'dashboard-filter-owner') {
                dashboardOwnerFilter = e.target.value; currentProject = store.getCurrentProject(); ui.renderDashboardView(currentProject, dashboardOwnerFilter, dashboardResponsibleFilter);
            }
            if (e.target.id === 'dashboard-filter-responsible') {
                dashboardResponsibleFilter = e.target.value; currentProject = store.getCurrentProject(); ui.renderDashboardView(currentProject, dashboardOwnerFilter, dashboardResponsibleFilter);
            }
            if (e.target.id === 'explorer-filter-responsible') {
                explorerResponsibleFilter = e.target.value; currentProject = store.getCurrentProject(); ui.renderExplorerView(currentProject, document.getElementById('search-input').value, explorerResponsibleFilter); initializeTooltips();
            }
            if (e.target.classList.contains('member-role-select')) {
                const result = await store.updateMember(e.target.dataset.uid, e.target.value);
                ui.showToast(result.success ? 'Member role updated.' : result.message, result.success ? 'success' : 'danger');
            }
        });
        
        addListener(document.getElementById('modal-container'), 'click', async e => {
            if (e.target.closest('.remove-member-btn')) {
                const uid = e.target.closest('.remove-member-btn').dataset.uid;
                if (confirm('Are you sure you want to remove this member?')) {
                    const result = await store.removeMember(uid);
                     if (result.success) {
                        ui.showToast('Member removed.', 'success');
                        const members = await store.getProjectMembersWithData();
                        ui.populateShareModal(members, store.isCurrentUserOwner());
                    } else ui.showToast(result.message, 'danger');
                }
            }
        });

        addListener(document, 'submit', async e => {
            e.preventDefault();
            if (e.target.id === 'objective-form') {
                const id = document.getElementById('objective-id').value;
                const dependsOn = Array.from(document.getElementById('objective-depends-on').selectedOptions).map(opt => opt.value);
                const data = {
                    title: document.getElementById('objective-title').value, ownerId: document.getElementById('objective-owner').value,
                    notes: document.getElementById('objective-notes').value, dependsOn: dependsOn,
                    startDate: document.getElementById('objective-start-date').value, endDate: document.getElementById('objective-end-date').value,
                    responsible: document.getElementById('objective-responsible').value.trim()
                };
                if(id) await store.updateObjective(id, data); else await store.addObjective(data);
                ui.showToast(id ? 'Objective updated.' : 'Objective added.'); ui.hideModal('objectiveModal'); router();
            }
            if (e.target.id === 'kr-form') {
                const objId = document.getElementById('kr-objective-id').value, krId = document.getElementById('kr-id').value;
                const data = {
                    title: document.getElementById('kr-title').value, startValue: document.getElementById('kr-start-value').value,
                    currentValue: document.getElementById('kr-current-value').value, targetValue: document.getElementById('kr-target-value').value,
                    confidence: document.getElementById('kr-confidence').value, notes: document.getElementById('kr-notes').value
                };
                if (krId) await store.updateKeyResult(objId, krId, data); else await store.addKeyResult(objId, data);
                ui.showToast(krId ? 'Key Result updated.' : 'Key Result added.'); ui.hideModal('keyResultModal'); router();
            }
            if (e.target.id === 'new-cycle-form') {
                const data = { name: document.getElementById('cycle-name').value, startDate: document.getElementById('cycle-start-date').value, endDate: document.getElementById('cycle-end-date').value };
                await store.addCycle(data); ui.showToast(`Cycle "${data.name}" added.`); e.target.reset(); router(); ui.renderNavControls(store.getCurrentProject());
            }
            if (e.target.id === 'foundation-form') {
                const data = { mission: document.getElementById('foundation-mission').value, vision: document.getElementById('foundation-vision').value };
                await store.updateFoundation(data); ui.showToast('Foundation statements updated.'); router();
            }
            if (e.target.id === 'invite-member-form') {
                const emailInput = document.getElementById('invite-email-input'); const roleSelect = document.getElementById('invite-role-select');
                const result = await store.inviteMember(emailInput.value, roleSelect.value);
                ui.showToast(result.message, result.success ? 'success' : 'danger');
                if (result.success) {
                    emailInput.value = '';
                    const members = await store.getProjectMembersWithData(); ui.populateShareModal(members, store.isCurrentUserOwner());
                }
            }
        });

        addListener(document, 'show.bs.modal', async e => {
            const modal = e.target, trigger = e.relatedTarget;
            const currentProject = store.getCurrentProject(); if (!currentProject) return;

            if (modal.id === 'shareProjectModal') {
                const members = await store.getProjectMembersWithData(); ui.populateShareModal(members, store.isCurrentUserOwner());
            }

            if (modal.id === 'objectiveModal' && trigger) {
                const form = document.getElementById('objective-form'); form.reset();
                document.getElementById('objective-id').value = '';
                const ownerSelect = document.getElementById('objective-owner');
                const owners = [{ id: 'company', name: currentProject.companyName }, ...currentProject.teams];
                ownerSelect.innerHTML = owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
                const objId = trigger.dataset.objectiveId;
                const activeCycle = currentProject.cycles.find(c => c.status === 'Active');
                const possibleDependencies = currentProject.objectives.filter(o => o.cycleId === activeCycle?.id && o.id !== objId);
                const dependsOnSelect = document.getElementById('objective-depends-on');
                dependsOnSelect.innerHTML = possibleDependencies.map(o => `<option value="${o.id}">${o.title}</option>`).join('');
                if (objId) {
                    document.getElementById('objective-modal-title').textContent = 'Edit Objective';
                    const obj = currentProject.objectives.find(o => o.id === objId);
                    if (obj) {
                        document.getElementById('objective-id').value = obj.id; document.getElementById('objective-title').value = obj.title; document.getElementById('objective-owner').value = obj.ownerId;
                        document.getElementById('objective-notes').value = obj.notes || ''; document.getElementById('objective-start-date').value = obj.startDate || '';
                        document.getElementById('objective-end-date').value = obj.endDate || ''; document.getElementById('objective-responsible').value = obj.responsible || '';
                        if (obj.dependsOn) Array.from(dependsOnSelect.options).forEach(opt => { if (obj.dependsOn.includes(opt.value)) opt.selected = true; });
                    }
                } else document.getElementById('objective-modal-title').textContent = 'Add Objective'; 
            }
            if (modal.id === 'keyResultModal' && trigger) {
                const form = document.getElementById('kr-form'); form.reset();
                document.getElementById('kr-id').value = ''; document.getElementById('kr-start-value').value = 0; document.getElementById('kr-confidence').value = 'On Track';
                const objId = trigger.dataset.objectiveId; document.getElementById('kr-objective-id').value = objId;
                const krId = trigger.dataset.krId; const objective = currentProject.objectives.find(o => o.id === objId);
                if (krId && objective) {
                    document.getElementById('kr-modal-title').textContent = 'Edit Key Result';
                    const kr = objective.keyResults.find(k => k.id === krId);
                    if (kr) {
                        document.getElementById('kr-id').value = kr.id; document.getElementById('kr-title').value = kr.title; document.getElementById('kr-start-value').value = kr.startValue;
                        document.getElementById('kr-current-value').value = kr.currentValue; document.getElementById('kr-target-value').value = kr.targetValue;
                        document.getElementById('kr-confidence').value = kr.confidence || 'On Track'; document.getElementById('kr-notes').value = kr.notes || '';
                    }
                } else { document.getElementById('kr-modal-title').textContent = 'Add Key Result'; document.getElementById('kr-current-value').value = 0; }
            }
        });

        // Initial call to the router to render the correct view based on the current URL hash
        router();
        ui.renderNavControls(project);
    }
    
    // Initial call to start the application logic
    main();
}
