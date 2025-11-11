export class FirestoreStore {
    constructor() {
        if (!auth.currentUser) {
            throw new Error("User not authenticated for FirestoreStore.");
        }
        this.userId = auth.currentUser.uid;
        this.projectsCollection = db.collection('users').doc(this.userId).collection('projects');
        this.appData = { currentProjectId: null, projects: [] };
        this.unsubscribe = null; // For real-time listeners later
    }

    // --- READ OPERATIONS ---

    async loadAppData() {
        const snapshot = await this.projectsCollection.get();
        this.appData.projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Load currentProjectId from localStorage for session persistence
        const savedProjectId = localStorage.getItem('okrAppCurrentProjectId');
        if (savedProjectId && this.appData.projects.some(p => p.id === savedProjectId)) {
            this.appData.currentProjectId = savedProjectId;
        } else {
            this.appData.currentProjectId = null;
        }
    }

    getProjects() {
        return this.appData.projects;
    }

    getCurrentProject() {
        if (!this.appData.currentProjectId) return null;
        return this.appData.projects.find(p => p.id === this.appData.currentProjectId);
    }

    setCurrentProjectId(projectId) {
        this.appData.currentProjectId = projectId;
        // Still use localStorage for the current project ID to persist across reloads
        if (projectId) {
            localStorage.setItem('okrAppCurrentProjectId', projectId);
        } else {
            localStorage.removeItem('okrAppCurrentProjectId');
        }
    }

    // --- WRITE OPERATIONS (STUBS FOR NOW) ---
    // We will implement these in the next step. For now, they do nothing.

    async createNewProject(initialData) { console.log('createNewProject not implemented'); return null; }
    async deleteProject(projectId) { console.log('deleteProject not implemented'); }
    async importProject(projectData) { console.log('importProject not implemented'); return null; }
    async cloneProject(projectId) { console.log('cloneProject not implemented'); return null; }
    async archiveProject(projectId) { console.log('archiveProject not implemented'); }
    async unarchiveProject(projectId) { console.log('unarchiveProject not implemented'); }
    async reorderObjectives(orderedIds) { console.log('reorderObjectives not implemented'); }
    async addCycle(data) { console.log('addCycle not implemented'); }
    async setActiveCycle(id) { console.log('setActiveCycle not implemented'); }
    async deleteCycle(id) { console.log('deleteCycle not implemented'); }
    async updateFoundation(data) { console.log('updateFoundation not implemented'); }
    async addObjective(data) { console.log('addObjective not implemented'); }
    async updateObjective(id, data) { console.log('updateObjective not implemented'); }
    async deleteObjective(id) { console.log('deleteObjective not implemented'); }
    async addKeyResult(objId, data) { console.log('addKeyResult not implemented'); }
    async updateKeyResult(objId, krId, data) { console.log('updateKeyResult not implemented'); }
    async deleteKeyResult(objId, krId) { console.log('deleteKeyResult not implemented'); }
    getOwnerName(ownerId) { 
        const p = this.getCurrentProject(); 
        if (!p) return ''; 
        if(ownerId === 'company') return p.companyName; 
        const team = p.teams.find(t => t.id === ownerId); 
        return team ? team.name : 'Unknown'; 
    }
}
