import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { SidebarProvider } from './SidebarProvider';
import { parseCommand, COMMANDS } from './commandParser';
import { gatherContext, contextToPromptBlock } from './codeContext';
import { streamChat } from './aiService';
import { StateManager } from './stateManager';

let outputChannel: vscode.OutputChannel;
let activeRunProcess: ChildProcess | null = null;
let currentSidebarProvider: SidebarProvider | null = null;

/** Shared state across the extension */
const state = new StateManager();

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SelfHeal Agent');
    outputChannel.appendLine('🩹 SelfHeal AI Dev Assistant activated.');

    // ── Register Webview Provider ──────────────────────────────────
    currentSidebarProvider = new SidebarProvider(context.extensionUri, state);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            currentSidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // ── Command: Run Current Test ──────────────────────────────────
    const runCmd = vscode.commands.registerCommand(
        'selfheal.runCurrentTest',
        async () => {
            if (activeRunProcess) {
                vscode.window.showWarningMessage('SelfHeal: A run is already in progress. Please stop it first.');
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('SelfHeal: Please open a Playwright test file first.');
                return;
            }

            const filePath = editor.document.fileName;

            if (!filePath.endsWith('.js') && !filePath.endsWith('.ts') && !filePath.endsWith('.mjs')) {
                vscode.window.showWarningMessage('SelfHeal: The current file does not look like a test script (.js, .ts, .mjs).');
                return;
            }

            // Save the file before running
            await editor.document.save();

            // Resolve workspace-relative path
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            const relativePath = path.relative(workspaceRoot, filePath);

            outputChannel.appendLine(`\n─── 🚀 Starting Background SelfHeal: ${relativePath} ───`);
            
            // Switch sidebar to dashboard mode and focus
            if (currentSidebarProvider) {
                currentSidebarProvider.postMessage({ type: 'switchTab', tab: 'dashboard' });
            }
            vscode.commands.executeCommand('selfheal.agentView.focus');

            // Spawn the CLI in the background
            activeRunProcess = spawn('npx', ['selfheal', 'run', relativePath, '--panel'], {
                cwd: workspaceRoot,
                shell: process.platform === 'win32'
            });

            // Watch stdout for the WebSocket port
            activeRunProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                outputChannel.append(text);
                
                // e.g. "  [VSCODE_WS_PORT=3000]"
                const match = text.match(/\[VSCODE_WS_PORT=(\d+)\]/);
                if (match && match[1]) {
                    const port = parseInt(match[1], 10);
                    outputChannel.appendLine(`[Agent Link] Connecting Webview to WS Port ${port}...`);
                    if (currentSidebarProvider) {
                        currentSidebarProvider.sendPortToWebview(port);
                    }
                }
            });

            activeRunProcess.stderr?.on('data', (data) => {
                outputChannel.append(`[ERR] ${data.toString()}`);
            });

            activeRunProcess.on('close', (code) => {
                outputChannel.appendLine(`\n─── 🏁 Run ended with code ${code} ───`);
                activeRunProcess = null;
            });
        }
    );

    // ── Command: Stop Run ──────────────────────────────────────────
    const stopCmd = vscode.commands.registerCommand(
        'selfheal.stopRun',
        () => {
            if (activeRunProcess) {
                activeRunProcess.kill('SIGINT');
                activeRunProcess = null;
                vscode.window.showInformationMessage('SelfHeal: Run stopped.');
                outputChannel.appendLine('─── 🛑 Run forced stopped by user ───');
            } else {
                vscode.window.showInformationMessage('SelfHeal: No run currently active.');
            }
        }
    );

    // ── Command: Toggle Sidebar ─────────────────────────────────────
    const toggleCmd = vscode.commands.registerCommand(
        'selfheal.toggleSidebar',
        () => {
            vscode.commands.executeCommand('selfheal.agentView.focus');
        }
    );

    // ── Command: Open Chat ──────────────────────────────────────────
    const openChatCmd = vscode.commands.registerCommand(
        'selfheal.openChat',
        () => {
            if (currentSidebarProvider) {
                currentSidebarProvider.postMessage({ type: 'switchTab', tab: 'chat' });
            }
            vscode.commands.executeCommand('selfheal.agentView.focus');
        }
    );

    // ── Command: Debug Current File (shortcut) ──────────────────────
    const debugCmd = vscode.commands.registerCommand(
        'selfheal.debugCurrentFile',
        async () => {
            if (currentSidebarProvider) {
                currentSidebarProvider.postMessage({ type: 'switchTab', tab: 'chat' });
            }
            vscode.commands.executeCommand('selfheal.agentView.focus');
            // Trigger /debug automatically
            await handleChatMessage('/debug');
        }
    );

    // ── Register URI Handler (Deep Linking from CLI) ────────────────
    const uriHandler = vscode.window.registerUriHandler({
        handleUri(uri: vscode.Uri) {
            if (uri.path === '/toggle') {
                vscode.commands.executeCommand('selfheal.agentView.focus');
            }
        }
    });

    context.subscriptions.push(runCmd, stopCmd, toggleCmd, openChatCmd, debugCmd, outputChannel, uriHandler);
}

// ── Chat Message Handler ────────────────────────────────────────────
export async function handleChatMessage(text: string): Promise<void> {
    if (!currentSidebarProvider) { return; }

    const parsed = parseCommand(text);

    // ── /clear command ──────────────────────────────────────────────
    if (parsed?.command === 'clear') {
        state.clear();
        currentSidebarProvider.postMessage({ type: 'clearChat' });
        return;
    }

    // ── /run command → delegate to test runner ──────────────────────
    if (parsed?.command === 'run') {
        vscode.commands.executeCommand('selfheal.runCurrentTest');
        return;
    }

    // ── /scan command → delegate to CLI scan ────────────────────────
    if (parsed?.command === 'scan') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            currentSidebarProvider.postMessage({
                type: 'chatResponse',
                msgId: 'err',
                chunk: '❌ No file is open to scan.',
                done: true,
            });
            return;
        }
        // Add user message
        state.addUserMessage(text, 'scan');
        currentSidebarProvider.postMessage({
            type: 'userMessage',
            content: text,
            command: 'scan',
        });
        // For now, show a message pointing to CLI  
        const assistantMsg = state.addAssistantMessage('');
        const response = `🛡️ Run the fragility scan from the terminal:\n\`\`\`bash\nnpx selfheal scan ${path.basename(editor.document.fileName)}\n\`\`\`\nOr press ▶️ **Run** to execute with the full SelfHeal Engine.`;
        state.appendToLast(response);
        state.finishLast();
        currentSidebarProvider.postMessage({
            type: 'chatResponse',
            msgId: assistantMsg.id,
            chunk: response,
            done: true,
        });
        return;
    }

    // ── AI-powered commands & plain chat ─────────────────────────────
    const command = parsed?.command || 'chat';
    const commandDef = COMMANDS.find(c => c.name === command);

    // Gather code context if the command needs it
    let contextBlock = '';
    if (!parsed || commandDef?.requiresCode) {
        const ctx = await gatherContext();
        if (ctx) {
            contextBlock = contextToPromptBlock(ctx);
        } else if (commandDef?.requiresCode) {
            currentSidebarProvider.postMessage({
                type: 'chatResponse',
                msgId: 'err',
                chunk: `❌ Open a file first — **/${command}** needs code context.`,
                done: true,
            });
            return;
        }
    }

    // Build the user prompt
    const userPrompt = parsed
        ? `Command: /${command}${parsed.rawArgs ? ' ' + parsed.rawArgs : ''}\n\n${contextBlock}`
        : `${text}\n\n${contextBlock}`;

    // Add user message to state
    const userMsg = state.addUserMessage(text, parsed?.command);
    currentSidebarProvider.postMessage({
        type: 'userMessage',
        content: text,
        command: parsed?.command,
    });

    // Start assistant message
    const assistantMsg = state.addAssistantMessage('', parsed?.command);
    currentSidebarProvider.postMessage({
        type: 'chatResponseStart',
        msgId: assistantMsg.id,
        command: parsed?.command,
    });

    // Stream from Gemini
    const history = state.getApiHistory().slice(0, -2); // exclude the current pair

    await streamChat(command, userPrompt, history, {
        onChunk: (chunk) => {
            state.appendToLast(chunk);
            currentSidebarProvider!.postMessage({
                type: 'chatResponse',
                msgId: assistantMsg.id,
                chunk,
                done: false,
            });
        },
        onDone: () => {
            state.finishLast();
            currentSidebarProvider!.postMessage({
                type: 'chatResponse',
                msgId: assistantMsg.id,
                chunk: '',
                done: true,
            });
        },
        onError: (error) => {
            state.appendToLast(error);
            state.finishLast();
            currentSidebarProvider!.postMessage({
                type: 'chatResponse',
                msgId: assistantMsg.id,
                chunk: error,
                done: true,
            });
        },
    });
}

export function deactivate() {
    if (activeRunProcess) {
        activeRunProcess.kill();
    }
    outputChannel?.dispose();
}
