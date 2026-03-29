import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { StateManager } from './stateManager';
import { handleChatMessage } from './extension';
import { COMMANDS } from './commandParser';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'selfheal.agentView';
    private _view?: vscode.WebviewView;
    private _termProcess: ChildProcess | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _state: StateManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'runTest': {
                    vscode.commands.executeCommand('selfheal.runCurrentTest');
                    break;
                }
                case 'stopTest': {
                    vscode.commands.executeCommand('selfheal.stopRun');
                    break;
                }
                case 'chatMessage': {
                    if (data.text && typeof data.text === 'string') {
                        handleChatMessage(data.text.trim());
                    }
                    break;
                }
                case 'getCommands': {
                    this.postMessage({ type: 'commandList', commands: COMMANDS });
                    break;
                }
                case 'requestHistory': {
                    const messages = this._state.getAllMessages();
                    this.postMessage({ type: 'chatHistory', messages });
                    break;
                }
                case 'runTerminalCommand': {
                    this._runTerminalCmd(data.command);
                    break;
                }
                case 'killTerminalCommand': {
                    this._killTerminalCmd();
                    break;
                }
                case 'onInfo': {
                    if (!data.value) { return; }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case 'onError': {
                    if (!data.value) { return; }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    /* ── Terminal Process ── */
    private _runTerminalCmd(command: string) {
        if (this._termProcess) {
            this.postMessage({ type: 'terminalError', message: 'A process is already running. Kill it first.' });
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const args = command.split(/\s+/);
        const cmd = args.shift() || 'npx';

        this._termProcess = spawn(cmd, args, {
            cwd: workspaceRoot,
            shell: true,
        });

        this._termProcess.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line) this.postMessage({ type: 'terminalOutput', text: line, stream: 'stdout' });
            }
        });

        this._termProcess.stderr?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line) this.postMessage({ type: 'terminalOutput', text: line, stream: 'stderr' });
            }
        });

        this._termProcess.on('close', (code: number | null) => {
            this.postMessage({ type: 'terminalDone', code: code ?? 1 });
            this._termProcess = null;
        });

        this._termProcess.on('error', (err: Error) => {
            this.postMessage({ type: 'terminalError', message: err.message });
            this._termProcess = null;
        });
    }

    private _killTerminalCmd() {
        if (this._termProcess) {
            this._termProcess.kill('SIGINT');
            this._termProcess = null;
        }
    }

    private async _runTerminalCommand(cmdInput: string, useActiveFile: boolean) {
        // Kill any existing terminal process
        this._killTerminalCommand();

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

        // Resolve command — handle quick-launch shorthand (run/scan/panel)
        let fullCmd = cmdInput.trim();

        if (useActiveFile && (fullCmd === 'run' || fullCmd === 'scan' || fullCmd === 'panel')) {
            const editor = vscode.window.activeTextEditor;
            const filePath = editor?.document?.fileName;
            if (filePath && workspaceRoot) {
                const rel = path.relative(workspaceRoot, filePath);
                fullCmd = `selfheal ${fullCmd} ${rel}`;
            } else {
                fullCmd = `selfheal ${fullCmd}`;
            }
        }

        // Split into args — handle `npx selfheal ...` and bare `selfheal ...`
        const parts = fullCmd.split(/\s+/);
        let cmd: string;
        let args: string[];

        if (parts[0] === 'selfheal') {
            cmd = 'npx';
            args = ['selfheal', ...parts.slice(1)];
        } else if (parts[0] === 'npx') {
            cmd = 'npx';
            args = parts.slice(1);
        } else {
            cmd = parts[0];
            args = parts.slice(1);
        }

        this.postMessage({
            type: 'terminalOutput',
            line: `> ${fullCmd}`,
            stream: 'info'
        });

        try {
            this._termProcess = spawn(cmd, args, {
                cwd: workspaceRoot || process.cwd(),
                shell: process.platform === 'win32',
                env: { ...process.env },
            });

            this._termProcess.stdout?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        this.postMessage({ type: 'terminalOutput', line: line.trimEnd(), stream: 'stdout' });
                    }
                });
            });

            this._termProcess.stderr?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        this.postMessage({ type: 'terminalOutput', line: line.trimEnd(), stream: 'stderr' });
                        // Also watch for WS port from CLI
                        const portMatch = line.match(/\[VSCODE_WS_PORT=(\d+)\]/);
                        if (portMatch) {
                            this.sendPortToWebview(parseInt(portMatch[1], 10));
                        }
                    }
                });
            });

            this._termProcess.on('close', (code: number | null) => {
                this._termProcess = null;
                this.postMessage({ type: 'terminalDone', code });
            });

            this._termProcess.on('error', (err: Error) => {
                this._termProcess = null;
                this.postMessage({ type: 'terminalError', message: `Failed to start: ${err.message}` });
            });

        } catch (err: any) {
            this.postMessage({ type: 'terminalError', message: `Spawn error: ${err.message}` });
        }
    }

    private _killTerminalCommand() {
        if (this._termProcess) {
            try {
                this._termProcess.kill('SIGINT');
            } catch (_) {}
            this._termProcess = null;
        }
    }

    public postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public sendPortToWebview(port: number) {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({ type: 'PORT_ALLOCATED', port });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        const uiJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'ui.js'));
        const wsClientJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'ws-client.js'));
        const chatJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'chat.js'));
        const termJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'terminal.js'));

        // Replace the script tags with the webview-safe URIs
        html = html.replace('<script src="ui.js"></script>', `<script src="${uiJsUri}"></script>`);
        html = html.replace('<script src="ws-client.js"></script>', `<script src="${wsClientJsUri}"></script>`);
        html = html.replace('<script src="chat.js"></script>', `<script src="${chatJsUri}"></script>`);
        html = html.replace('<script src="terminal.js"></script>', `<script src="${termJsUri}"></script>`);

        // Inject VS Code API acquisition
        html = html.replace('</head>', `<script>const vscode = acquireVsCodeApi();</script>\n</head>`);

        return html;
    }
}
