// js/firestore-store.js

import { auth, db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export class FirestoreStore {
    constructor(userId) {
        if (!userId) {
            throw new Error("User not authenticated for FirestoreStore.");
        }
        this.userId = userId;
        this.projectsCollection = collection(db, 'users', this.userId, 'projects');
        this.appData = { currentProjectId: null, projects: [] };
    }

    // --- READ OPERATIONS ---
    async loadAppData() {
        const snapshot = await getDocs(this.projectsCollection);
        this.appData.projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
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
        if (projectId) {
            localStorage.setItem('okrAppCurrentProjectId', projectId);
        } else {
            localStorage.removeItem('okrAppCurrentProjectId');
        }
    }
    
    // --- PRIVATE HELPER ---
    _getProjectDocRef(projectId) {
        if (!projectId) return null;
        return doc(db, 'users', this.userId, 'projects', projectId);
    }
    
    // --- WRITE OPERATIONS ---
    async createNewProject(initialData) {
        const newProjectData = {
            name: initialData.projectName,
            companyName: initialData.projectName,
            isArchived: false,
            foundation: { mission: initialData.mission, vision: initialData.vision },
            cycles: [{ id: `cycle-${Date.now()}`, name: "Initial Cycle", startDate: new Date().toISOString().split('T')[0], endDate: "", status: "Active" }],
            teams: initialData.teams.map((teamName, index) => ({ id: `team-${Date.now() + index}`, name: teamName })),
            objectives: [],
        };
        const docRef = await addDoc(this.projectsCollection, newProjectData);
        const newProject = { id: docRef.id, ...newProjectData };
        this.appData.projects.push(newProject);
        return newProject;
    }
    
    async deleteProject(projectId) {
        const projectRef = this._getProjectDocRef(projectId);
        if (!projectRef) return;
        
        await deleteDoc(projectRef);
        this.appData.projects = this.appData.projects.filter(p => p.id !== projectId);
        if (this.appData.currentProjectId === projectId) {
            this.setCurrentProjectId(null);
        }
    }

    async importProject(projectData) {
        if (!projectData || !projectData.name || !projectData.cycles) {
            console.error('Invalid project data for import.');
            return null;
        }
        const newProjectData = { ...projectData, isArchived: false, name: `${projectData.name} (Imported)`};
        delete newProjectData.id; 

        const docRef = await addDoc(this.projectsCollection, newProjectData);
        const newProject = { id: docRef.id, ...newProjectData };
        this.appData.projects.push(newProject);
        return newProject;
    }

    async cloneProject(projectId) {
        const originalProject = this.appData.projects.find(p => p.id === projectId);
        if (!originalProject) return null;

        const clonedProjectData = JSON.parse(JSON.stringify(originalProject));
        delete clonedProjectData.id; 

        clonedProjectData.name = `${originalProject.name} (Clone)`;
        clonedProjectData.isArchived = false;
        
        const newCycleId = `cycle-${Date.now() + 1}`;
        clonedProjectData.cycles = [{ id: newCycleId, name: "Initial Cycle", startDate: new Date().toISOString().split('T')[0], endDate: "", status: "Active" }];

        clonedProjectData.objectives.forEach(obj => {
            obj.id = `obj-${Date.now() + Math.random()}`;
            obj.cycleId = newCycleId;
            obj.progress = 0;
            obj.keyResults.forEach(kr => {
                kr.id = `kr-${Date.now() + Math.random()}`;
                kr.currentValue = kr.startValue;
                kr.progress = 0;
                kr.history = [];
            });
        });

        const docRef = await addDoc(this.projectsCollection, clonedProjectData);
        const newProject = { id: docRef.id, ...clonedProjectData };
        this.appData.projects.push(newProject);
        return newProject;
    }

    async _updateCurrentProjectInFirestore(updateObj) {
        const projectId = this.appData.currentProjectId;
        const projectRef = this._getProjectDocRef(projectId);
        if (!projectRef) return;
        await updateDoc(projectRef, updateObj);
    }
    
    async archiveProject(projectId) {
        const projectRef = this._getProjectDocRef(projectId);
        if (!projectRef) return;
        await updateDoc(projectRef, { isArchived: true });
        const project = this.appData.projects.find(p => p.id === projectId);
        if(project) project.isArchived = true;
    }

    async unarchiveProject(projectId) {
        const projectRef = this._getProjectDocRef(projectId);
        if (!projectRef) return;
        await updateDoc(projectRef, { isArchived: false });
        const project = this.appData.projects.find(p => p.id === projectId);
        if(project) project.isArchived = false;
    }

    async reorderObjectives(orderedIds) {
        const project = this.getCurrentProject();
        if(!project) return;
        const objectiveMap = new Map(project.objectives.map(obj => [obj.id, obj]));
        const reorderedObjectives = orderedIds.map(id => objectiveMap.get(id)).filter(Boolean);
        const unhandledObjectives = project.objectives.filter(obj => !orderedIds.includes(obj.id));
        project.objectives = [...reorderedObjectives, ...unhandledObjectives];
        await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
    }
    
    async addCycle(data) {
        const project = this.getCurrentProject();
        if(!project) return;
        const newCycle = { id: `cycle-${Date.now()}`, ...data, status: "Archived" };
        project.cycles.push(newCycle);
        await this._updateCurrentProjectInFirestore({ cycles: project.cycles });
    }

    async setActiveCycle(id) {
        const project = this.getCurrentProject();
        if(!project) return;
        project.cycles.forEach(c => c.status = (c.id === id) ? 'Active' : 'Archived');
        await this._updateCurrentProjectInFirestore({ cycles: project.cycles });
    }

    async deleteCycle(id) {
        const project = this.getCurrentProject();
        if(!project || project.cycles.length <= 1 || project.cycles.find(c => c.id === id)?.status === 'Active') return;
        project.cycles = project.cycles.filter(c => c.id !== id);
        project.objectives = project.objectives.filter(o => o.cycleId !== id);
        await this._updateCurrentProjectInFirestore({ cycles: project.cycles, objectives: project.objectives });
    }

    async updateFoundation(data) {
        const project = this.getCurrentProject();
        if(!project) return;
        project.foundation = data;
        await this._updateCurrentProjectInFirestore({ foundation: data });
    }

    async addObjective(data) {
        const project = this.getCurrentProject();
        if (!project) return;
        const activeCycle = project.cycles.find(c => c.status === 'Active');
        if (!activeCycle) return;
        const newObjective = { 
            id: `obj-${Date.now()}`, 
            cycleId: activeCycle.id, 
            ...data, 
            progress: 0, 
            keyResults: [], 
            notes: data.notes || '', 
            responsible: data.responsible || '',
            dependsOn: data.dependsOn || [],
            startDate: data.startDate || '',
            endDate: data.endDate || ''
        };
        project.objectives.push(newObjective);
        await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
    }

    async updateObjective(id, data) {
        const project = this.getCurrentProject();
        if (!project) return;
        const objIndex = project.objectives.findIndex(o => o.id === id);
        if (objIndex > -1) {
            Object.assign(project.objectives[objIndex], data);
            await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
        }
    }

    async deleteObjective(id) {
        const project = this.getCurrentProject();
        if (!project) return;
        project.objectives = project.objectives.filter(o => o.id !== id);
        project.objectives.forEach(obj => {
            if (obj.dependsOn && obj.dependsOn.includes(id)) {
                obj.dependsOn = obj.dependsOn.filter(depId => depId !== id);
            }
        });
        await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
    }
    
    async addKeyResult(objId, data) {
        const project = this.getCurrentProject();
        if (!project) return;
        const obj = project.objectives.find(o => o.id === objId);
        if (obj) {
            const newKr = {
                id: `kr-${Date.now()}`,
                notes: '',
                ...data,
                history: [{ 
                    date: new Date().toISOString().split('T')[0], 
                    value: data.currentValue,
                    confidence: data.confidence 
                }]
            };
            obj.keyResults.push(newKr);
            obj.progress = this.calculateProgress(obj);
            await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
        }
    }
    
    async updateKeyResult(objId, krId, data) {
        const project = this.getCurrentProject();
        if (!project) return;
        const obj = project.objectives.find(o => o.id === objId);
        if (obj) {
            const kr = obj.keyResults.find(k => k.id === krId);
            if(kr) {
                if (!kr.history) kr.history = [];
                const hasValueChanged = String(kr.currentValue) !== String(data.currentValue);
                const hasConfidenceChanged = kr.confidence !== data.confidence;
                if (hasValueChanged || hasConfidenceChanged) {
                    kr.history.push({
                        date: new Date().toISOString().split('T')[0],
                        value: data.currentValue,
                        confidence: data.confidence
                    });
                }
                Object.assign(kr, data);
            }
            obj.progress = this.calculateProgress(obj);
            await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
        }
    }

    async deleteKeyResult(objId, krId) {
        const project = this.getCurrentProject();
        if (!project) return;
        const obj = project.objectives.find(o => o.id === objId);
        if (obj) {
            obj.keyResults = obj.keyResults.filter(k => k.id !== krId);
            obj.progress = this.calculateProgress(obj);
            await this._updateCurrentProjectInFirestore({ objectives: project.objectives });
        }
    }
    
    // --- UTILITY METHODS ---
    calculateProgress(objective) {
        if (!objective.keyResults || objective.keyResults.length === 0) return 0;
        const total = objective.keyResults.reduce((sum, kr) => {
            const start = Number(kr.startValue), target = Number(kr.targetValue), current = Number(kr.currentValue);
            if (target === start) return sum + 100;
            const progress = Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100));
            kr.progress = progress; // Also update progress on the KR object itself
            return sum + progress;
        }, 0);
        return Math.round(total / objective.keyResults.length);
    }
}
