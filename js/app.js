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
        run(store, ui, user.uid);
    } catch (error) {
        console.error("Fatal Error: Could not initialize Firestore data.", error);
        ui.showToast("Error loading your data. Please refresh the page.", "danger");
    }
}

function run(store, ui, userId) {
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
        ui.renderProjectSwitcher(store.getProjects(), userId);
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
                if (confirm(`Are you sure you want to PERMANENTLY DELETE the project "${projectName}"? This action cannot be undone.`)) {
                    await store.deleteProject(projectId);
                    ui.showToast(`Project "${projectName}" deleted.`, 'danger');
                    await main();
                }
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
        
        const userRole = store.getCurrentUserRole();
        ui.renderMainLayout(project, userRole);

        const router = () => {
            let currentProject = store.getCurrentProject();
            if (!currentProject) { main(); return; }

            if (workbenchUnsubscribe) {
                workbenchUnsubscribe();
                workbenchUnsubscribe = null;
            }

            const hash = window.location.hash || '#dashboard';
            ui.showView(hash.substring(1) + '-view');
            
            const currentRole = store.getCurrentUserRole();

            switch(hash) {
                case '#dashboard': ui.renderDashboardView(currentProject, dashboardOwnerFilter, dashboardResponsibleFilter); break;
                case '#explorer': ui.renderExplorerView(currentProject, document.getElementById('search-input').value, explorerResponsibleFilter, currentRole); break;
                case '#cascade': ui.renderCascadeView(currentProject); break;
                case '#workbench': setupWorkbench(currentProject, currentRole); break;
                case '#gantt': ui.renderGanttView(currentProject, canEditGantt() ? handleGanttDateChange : () => {}); break;
                case '#risk-board': ui.renderRiskBoardView(currentProject); break;
                case '#reporting': ui.renderReportingView(currentProject); break;
                case '#cycles': ui.renderCyclesView(currentProject, currentRole); break;
                case '#settings': ui.renderSettingsView(currentProject); break;
            }
            initializeTooltips();
        };
        
        const canEditGantt = () => {
            const role = store.getCurrentUserRole();
            return role === 'owner' || role === 'editor';
        }

        const setupWorkbench = (project, userRole) => {
            ui.renderWorkbenchView(project.workbenchItems, userRole);
        
            workbenchUnsubscribe = store.listenForWorkbenchUpdates(items => {
                const currentRole = store.getCurrentUserRole();
                ui.renderWorkbenchView(items, currentRole);
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
            const currentRole = store.getCurrentUserRole();
            ui.renderExplorerView(currentProject, e.target.value, explorerResponsibleFilter, currentRole);
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
                const currentRole = store.getCurrentUserRole();
                ui.renderCyclesView(currentProject, currentRole); ui.renderNavControls(currentProject);
            }
            
            const editBtn = e.target.closest('.edit-team-btn');
            if (editBtn) {
                const listItem = editBtn.closest('li');
                listItem.querySelector('.team-name').classList.add('d-none');
                listItem.querySelector('.edit-team-btn').classList.add('d-none');
                listItem.querySelector('.delete-team-btn').classList.add('d-none');
                listItem.querySelector('.edit-team-name-input').classList.remove('d-none');
                listItem.querySelector('.save-team-btn').classList.remove('d-none');
                listItem.querySelector('.cancel-edit-team-btn').classList.remove('d-none');
            }
            const cancelBtn = e.target.closest('.cancel-edit-team-btn');
            if (cancelBtn) {
                const listItem = cancelBtn.closest('li');
                listItem.querySelector('.team-name').classList.remove('d-none');
                listItem.querySelector('.edit-team-btn').classList.remove('d-none');
                listItem.querySelector('.delete-team-btn').classList.remove('d-none');
                listItem.querySelector('.edit-team-name-input').classList.add('d-none');
                listItem.querySelector('.save-team-btn').classList.add('d-none');
                listItem.querySelector('.cancel-edit-team-btn').classList.add('d-none');
            }
            const saveBtn = e.target.closest('.save-team-btn');
            if (saveBtn) {
                const teamId = saveBtn.closest('li').dataset.teamId;
                const newName = saveBtn.closest('li').querySelector('.edit-team-name-input').value;
                if (newName) {
                    await store.updateTeam(teamId, newName);
                    ui.showToast('Team renamed.');
                    router();
                }
            }
            const deleteTeamBtn = e.target.closest('.delete-team-btn');
            if(deleteTeamBtn) {
                const teamId = deleteTeamBtn.closest('li').dataset.teamId;
                if (confirm('Are you sure you want to delete this team?')) {
                    const result = await store.deleteTeam(teamId);
                    if (result.success) {
                        ui.showToast('Team deleted.');
                        router();
                    } else {
                        ui.showToast(result.message, 'danger');
                    }
                }
            }
            
            if (e.target.id === 'add-wb-objective') await store.addWorkbenchItem('objective');
            if (e.target.id === 'add-wb-kr') await store.addWorkbenchItem('kr');

            const wbCard = e.target.closest('.wb-item-card');
            if (e.target.closest('.wb-delete-btn')) {
                if (confirm('Delete this item?')) await store.deleteWorkbenchItem(wbCard.id);
            }
            if (e.target.closest('.wb-edit-btn')) {
                wbCard.querySelector('.wb-item-text').classList.add('d-none');
                wbCard.querySelector('.wb-edit-btn').classList.add('d-none');
                wbCard.querySelector('.wb-delete-btn').classList.add('d-none');
                wbCard.querySelector('textarea').classList.remove('d-none');
                wbCard.querySelector('.wb-save-btn').classList.remove('d-none');
                wbCard.querySelector('.wb-cancel-btn').classList.remove('d-none');
            }
             if (e.target.closest('.wb-cancel-btn')) {
                wbCard.querySelector('.wb-item-text').classList.remove('d-none');
                wbCard.querySelector('.wb-edit-btn').classList.remove('d-none');
                wbCard.querySelector('.wb-delete-btn').classList.remove('d-none');
                wbCard.querySelector('textarea').classList.add('d-none');
                wbCard.querySelector('.wb-save-btn').classList.add('d-none');
                wbCard.querySelector('.wb-cancel-btn').classList.add('d-none');
                wbCard.querySelector('textarea').value = wbCard.querySelector('.wb-item-text').textContent;
            }
            if (e.target.closest('.wb-save-btn')) {
                const newText = wbCard.querySelector('textarea').value;
                await store.updateWorkbenchItemText(wbCard.id, newText);
            }
        });

        addListener(document.getElementById('app-container'), 'change', async e => {
            let currentProject;
            let currentRole;
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
                explorerResponsibleFilter = e.target.value; currentProject = store.getCurrentProject(); currentRole = store.getCurrentUserRole(); ui.renderExplorerView(currentProject, document.getElementById('search-input').value, explorerResponsibleFilter, currentRole); initializeTooltips();
            }
        });
        
        addListener(document.getElementById('modal-container'), 'click', async e => {
            if (e.target.closest('.remove-member-btn')) {
                const uid = e.target.closest('.remove-member-btn').dataset.uid;
                if (confirm('Are you sure you want to remove this member?')) {
                    const result = await store.removeMember(uid);
                     if (result.success) {
                        ui.showToast('Member removed.', 'success');
                        const isOwner = store.getCurrentUserRole() === 'owner';
                        const members = await store.getProjectMembersWithData();
                        ui.populateShareModal(members, isOwner);
                    } else ui.showToast(result.message, 'danger');
                }
            }
        });
         addListener(document.getElementById('modal-container'), 'change', async e => {
            if (e.target.classList.contains('member-role-select')) {
                const result = await store.updateMember(e.target.dataset.uid, e.target.value);
                ui.showToast(result.success ? 'Member role updated.' : result.message, result.success ? 'success' : 'danger');
            }
        });
        
        addListener(document, 'dragstart', e => { if (e.target.classList.contains('okr-card') || e.target.classList.contains('wb-item-card')) e.target.classList.add('dragging'); });
        addListener(document, 'dragend', e => { if (e.target.classList.contains('okr-card') || e.target.classList.contains('wb-item-card')) e.target.classList.remove('dragging'); });
        
        addListener(document, 'dragover', e => {
            const userRole = store.getCurrentUserRole();
            if (userRole === 'viewer') return;
            const container = e.target.closest('.objective-list') || e.target.closest('#workbench-items-container');
            if (!container) return;
            e.preventDefault();
            const placeholder = document.createElement('div'); placeholder.classList.add('drag-over-placeholder');
            const afterElement = getDragAfterElement(container, e.clientY);
            container.querySelector('.drag-over-placeholder')?.remove();
            if (afterElement == null) container.appendChild(placeholder);
            else container.insertBefore(placeholder, afterElement);
        });

        addListener(document, 'drop', async e => {
            const userRole = store.getCurrentUserRole();
            if (userRole === 'viewer') return;
            e.preventDefault();
            const okrContainer = e.target.closest('.objective-list');
            const wbContainer = e.target.closest('#workbench-items-container');
            const container = okrContainer || wbContainer;
            if (!container) return;

            container.querySelector('.drag-over-placeholder')?.remove();
            const draggedElement = document.querySelector('.dragging');
            if (!draggedElement) return;

            const cardSelector = container.id === 'workbench-items-container' ? '.wb-item-card' : '.okr-card';
            let newOrderedIds = [...container.querySelectorAll(`${cardSelector}:not(.dragging)`)].map(el => el.id);
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) newOrderedIds.push(draggedElement.id);
            else newOrderedIds.splice(newOrderedIds.indexOf(afterElement.id), 0, draggedElement.id);
            
            if(okrContainer) {
                await store.reorderObjectives(newOrderedIds); 
                ui.showToast('Objectives reordered.');
            } else if (wbContainer) {
                await store.reorderWorkbenchItems(newOrderedIds);
            }
            router();
        });
        
        function getDragAfterElement(container, y) {
            const cardSelector = container.id === 'workbench-items-container' ? '.wb-item-card' : '.okr-card';
            const draggableElements = [...container.querySelectorAll(`${cardSelector}:not(.dragging)`)];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                else return closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
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
                await store.updateFoundation(data); ui.showToast('Foundation statements updated.');
            }
            if (e.target.id === 'project-details-form') {
                const newName = document.getElementById('settings-project-name').value;
                await store.updateProjectDetails({ name: newName, companyName: newName });
                document.getElementById('sidebar-project-name').textContent = newName;
                ui.showToast('Project name updated.');
            }
            if (e.target.id === 'add-team-form') {
                const newTeamName = document.getElementById('add-team-name').value;
                if(newTeamName) {
                    await store.addTeam(newTeamName);
                    ui.showToast(`Team "${newTeamName}" added.`);
                    router();
                }
            }
            if (e.target.id === 'invite-member-form') {
                const emailInput = document.getElementById('invite-email-input'); const roleSelect = document.getElementById('invite-role-select');
                const result = await store.inviteMember(emailInput.value, roleSelect.value);
                ui.showToast(result.message, result.success ? 'success' : 'danger');
                if (result.success) {
                    emailInput.value = '';
                    const isOwner = store.getCurrentUserRole() === 'owner';
                    const members = await store.getProjectMembersWithData(); ui.populateShareModal(members, isOwner);
                }
            }
        });

        addListener(document, 'show.bs.modal', async e => {
            const modal = e.target, trigger = e.relatedTarget;
            const currentProject = store.getCurrentProject(); if (!currentProject) return;

            if (modal.id === 'shareProjectModal') {
                const isOwner = store.getCurrentUserRole() === 'owner';
                const members = await store.getProjectMembersWithData(); ui.populateShareModal(members, isOwner);
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
        
        router();
        ui.renderNavControls(project);
    }
    
    main();
}
