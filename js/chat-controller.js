import { N8nChatService } from './chat-service.js';

const INITIAL_MESSAGE = 'Hi, I’m your OKR Coach. I can assess outcome quality, identify risks, and draft objectives or key results for your active cycle.';

export class ChatController {
    constructor({ getProject, onAction, service = new N8nChatService() }) {
        this.getProject = getProject;
        this.onAction = onAction;
        this.service = service;
        this.abortController = null;
        this.listeners = [];
    }

    mount() {
        this.launcher = document.getElementById('okr-chat-launcher');
        this.panel = document.getElementById('okr-chat-panel');
        this.messages = document.getElementById('okr-chat-messages');
        this.form = document.getElementById('okr-chat-form');
        this.input = document.getElementById('okr-chat-input');
        this.submitButton = document.getElementById('okr-chat-submit');
        if (!this.launcher || !this.panel || !this.messages || !this.form || !this.input) return;

        this._listen(this.launcher, 'click', () => this.toggle());
        this._listen(document.getElementById('okr-chat-close'), 'click', () => this.close());
        this._listen(document.getElementById('okr-chat-new'), 'click', () => this.reset());
        this._listen(this.form, 'submit', event => this.handleSubmit(event));
        this._listen(this.messages, 'click', event => this.handleAction(event));
        this.renderMessage('assistant', INITIAL_MESSAGE);
    }

    _listen(element, type, handler) {
        if (!element) return;
        element.addEventListener(type, handler);
        this.listeners.push({ element, type, handler });
    }

    destroy() {
        this.abortController?.abort();
        this.listeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
        this.listeners = [];
    }

    toggle() {
        const willOpen = this.panel.hidden;
        this.panel.hidden = !willOpen;
        this.launcher.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) requestAnimationFrame(() => this.input.focus());
    }

    close() {
        this.panel.hidden = true;
        this.launcher.setAttribute('aria-expanded', 'false');
        this.launcher.focus();
    }

    reset() {
        this.abortController?.abort();
        this.service.resetSession();
        this.messages.replaceChildren();
        this.renderMessage('assistant', INITIAL_MESSAGE);
        this.input.focus();
    }

    async handleSubmit(event) {
        event.preventDefault();
        const message = this.input.value.trim();
        if (!message || this.submitButton.disabled) return;

        this.renderMessage('user', message);
        this.input.value = '';
        this.setLoading(true);
        const requestController = new AbortController();
        this.abortController = requestController;
        const loadingMessage = this.renderLoadingMessage();

        try {
            const response = await this.service.sendMessage(message, this.getProject(), requestController.signal);
            loadingMessage.remove();
            this.renderMessage('assistant', response.message, response.actions);
        } catch (error) {
            loadingMessage.remove();
            if (requestController.signal.aborted) return;
            this.renderMessage('error', error.message || 'The OKR Coach could not respond. Please try again.');
        } finally {
            if (this.abortController === requestController) this.abortController = null;
            this.setLoading(false);
            this.input.focus();
        }
    }

    handleAction(event) {
        const button = event.target.closest('[data-chat-action-index]');
        if (!button) return;
        const message = button.closest('.chat-message');
        const action = message?._okrActions?.[Number(button.dataset.chatActionIndex)];
        if (action) this.onAction(action);
    }

    setLoading(isLoading) {
        this.submitButton.disabled = isLoading;
        this.input.disabled = isLoading;
        this.panel.setAttribute('aria-busy', String(isLoading));
    }

    renderLoadingMessage() {
        const element = document.createElement('div');
        element.className = 'chat-message chat-message--assistant chat-message--loading';
        element.setAttribute('role', 'status');
        element.innerHTML = '<span></span><span></span><span></span><span class="visually-hidden">OKR Coach is thinking</span>';
        this.messages.append(element);
        this.scrollToLatest();
        return element;
    }

    renderMessage(role, content, actions = []) {
        const element = document.createElement('article');
        element.className = `chat-message chat-message--${role}`;
        const label = role === 'user' ? 'You' : role === 'error' ? 'Connection issue' : 'OKR Coach';
        const body = document.createElement('div');
        body.className = 'chat-message__body';

        if (role === 'assistant' && globalThis.marked && globalThis.DOMPurify) {
            body.innerHTML = DOMPurify.sanitize(marked.parse(content));
        } else {
            body.textContent = content;
        }

        element.innerHTML = `<span class="chat-message__label">${label}</span>`;
        element.append(body);
        if (actions.length) {
            const actionContainer = document.createElement('div');
            actionContainer.className = 'chat-message__actions';
            actions.forEach((action, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-sm btn-outline-primary';
                button.dataset.chatActionIndex = String(index);
                const icon = document.createElement('i');
                icon.className = 'bi bi-arrow-up-right me-1';
                button.append(icon, document.createTextNode(action.label));
                actionContainer.append(button);
            });
            element._okrActions = actions;
            element.append(actionContainer);
        }
        this.messages.append(element);
        this.scrollToLatest();
        return element;
    }

    scrollToLatest() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }
}
