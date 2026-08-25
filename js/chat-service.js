import { APP_CONFIG } from './config.js';

const SESSION_STORAGE_KEY = 'eraneos-okr-chat-session';
const ACTION_BLOCK_PATTERN = /```okr_action\s*([\s\S]*?)```/gi;
const SUPPORTED_ACTIONS = new Set(['create_objective', 'create_key_result']);

function createSessionId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `okr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readResponseText(payload) {
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload)) {
        return payload.map(readResponseText).filter(Boolean).join('\n\n');
    }
    if (!payload || typeof payload !== 'object') return '';
    for (const key of ['output', 'text', 'response', 'message', 'content']) {
        if (typeof payload[key] === 'string') return payload[key];
    }
    if (payload.data) return readResponseText(payload.data);
    return '';
}

function normalizeAction(candidate) {
    if (!candidate || !SUPPORTED_ACTIONS.has(candidate.type) || !candidate.payload) return null;
    return {
        type: candidate.type,
        label: String(candidate.label || (candidate.type === 'create_objective' ? 'Review objective draft' : 'Review key result draft')),
        payload: candidate.payload
    };
}

export function parseChatResponse(payload) {
    const rawText = readResponseText(payload).trim();
    const actions = [];
    let match;
    ACTION_BLOCK_PATTERN.lastIndex = 0;
    while ((match = ACTION_BLOCK_PATTERN.exec(rawText)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            candidates.map(normalizeAction).filter(Boolean).forEach(action => actions.push(action));
        } catch (error) {
            console.warn('Ignoring invalid OKR action returned by the chatbot.', error);
        }
    }
    const message = rawText.replace(ACTION_BLOCK_PATTERN, '').trim();
    return {
        message: message || 'I received a response, but it did not contain displayable text.',
        actions
    };
}

export function buildProjectContext(project, objectiveLimit = APP_CONFIG.chatContextObjectiveLimit) {
    if (!project) return null;
    const activeCycle = (project.cycles || []).find(cycle => cycle.status === 'Active') || null;
    const objectives = (project.objectives || [])
        .filter(objective => !activeCycle || objective.cycleId === activeCycle.id)
        .slice(0, objectiveLimit)
        .map(objective => ({
            id: objective.id,
            title: objective.title,
            ownerId: objective.ownerId,
            responsible: objective.responsible || null,
            progress: Number(objective.progress || 0),
            keyResults: (objective.keyResults || []).map(keyResult => ({
                id: keyResult.id,
                title: keyResult.title,
                currentValue: keyResult.currentValue,
                targetValue: keyResult.targetValue,
                confidence: keyResult.confidence || 'On Track'
            }))
        }));

    return {
        project: { name: project.name, companyName: project.companyName || project.name },
        activeCycle: activeCycle ? { id: activeCycle.id, name: activeCycle.name, startDate: activeCycle.startDate, endDate: activeCycle.endDate } : null,
        teams: (project.teams || []).map(team => ({ id: team.id, name: team.name })),
        objectives,
        contextTruncated: (project.objectives || []).length > objectiveLimit
    };
}

export class N8nChatService {
    constructor({
        webhookUrl = APP_CONFIG.n8nChatWebhookUrl,
        timeoutMs = APP_CONFIG.chatRequestTimeoutMs,
        storage = globalThis.sessionStorage
    } = {}) {
        this.webhookUrl = webhookUrl;
        this.timeoutMs = timeoutMs;
        this.storage = storage;
        this.sessionId = this.storage?.getItem(SESSION_STORAGE_KEY) || createSessionId();
        this.storage?.setItem(SESSION_STORAGE_KEY, this.sessionId);
    }

    resetSession() {
        this.sessionId = createSessionId();
        this.storage?.setItem(SESSION_STORAGE_KEY, this.sessionId);
    }

    async sendMessage(message, project, externalSignal) {
        const trimmedMessage = String(message || '').trim();
        if (!trimmedMessage) throw new Error('Enter a message before sending.');

        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
        const abortFromExternalSignal = () => timeoutController.abort();
        externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
                body: JSON.stringify({
                    action: 'sendMessage',
                    sessionId: this.sessionId,
                    chatInput: trimmedMessage,
                    metadata: {
                        source: 'eraneos-okr-dashboard',
                        projectContext: buildProjectContext(project)
                    }
                }),
                signal: timeoutController.signal
            });

            if (!response.ok) throw new Error(`The OKR Coach is unavailable (${response.status}).`);
            const contentType = response.headers.get('content-type') || '';
            const payload = contentType.includes('application/json') ? await response.json() : await response.text();
            return parseChatResponse(payload);
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('The OKR Coach took too long to respond. Please try again.');
            throw error;
        } finally {
            clearTimeout(timeout);
            externalSignal?.removeEventListener('abort', abortFromExternalSignal);
        }
    }
}
