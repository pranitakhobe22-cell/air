export { healClick } from './healClick.js';
export { healFill } from './healFill.js';
export { healNavigate } from './healNavigate.js';

// Global singleton to inject context (io, testFile) if users don't want to specify it in every call.
let globalContext = { testFile: null, io: null };

export function registerContext(testFile, io) {
    globalContext = { testFile, io };
}

export function getGlobalContext() {
    return globalContext;
}
