document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const ui = new UI();
    let currentViewListeners = [];

    function cleanupListeners() {
        currentViewListeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
        currentViewListeners = [];
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
        // Attach listeners for the project switcher view
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

        const addListener = (element, type, handler) => {
            element.addEventListener(type, handler);
            currentViewListeners.push({ element, type, handler });
        };
        
        addListener(window, 'hashchange', router);
        addListener(document.getElementById('back-to-projects'), 'click', () => { store.setCurrentProjectId(null); main(); });
        
        // --- Add ALL main app listeners here ---
        addListener(document.getElementById('search-input'), 'input', e => ui.renderExplorerView(project, e.target.value));
        addListener(document.getElementById('cycle-selector-list'), 'click', e => {
            if (e.target.dataset.cycleId) {
                store.setActiveCycle(e.target.dataset.cycleId);
                ui.renderNavControls(project);
                ui.renderExplorerView(project);
            }
        });

        addListener(document, 'submit', e => {
            if (e.target.id === 'objective-form') { /* ... form logic ... */ }
            if (e.target.id === 'kr-form') { /* ... form logic ... */ }
        });

        addListener(document, 'show.bs.modal', e => {
            const modal = e.target, trigger = e.relatedTarget;
            if (!trigger) return;
            // ... all modal population logic from previous steps goes here
        });

        // Finally, run the router to render the initial view
        router();
        ui.renderNavControls(project); // Also render nav controls on initial load
    }
    
    main(); // Start the application
});
