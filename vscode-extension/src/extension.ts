import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { SidebarProvider } from './SidebarProvider';

let outputChannel: vscode.OutputChannel;
let activeRunProcess: ChildProcess | null = null;
let currentSidebarProvider: SidebarProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SelfHeal Agent');
    outputChannel.appendLine('🩹 SelfHeal extension activated in Agent Panel mode.');

    // ── Register Webview Provider ──────────────────────────────────
    currentSidebarProvider = new SidebarProvider(context.extensionUri);
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
            
            // Pop open the Sidebar Agent Panel so the user sees the dashboard
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

    // ── Register URI Handler (Deep Linking from CLI) ────────────────
    const uriHandler = vscode.window.registerUriHandler({
        handleUri(uri: vscode.Uri) {
            if (uri.path === '/toggle') {
                vscode.commands.executeCommand('selfheal.agentView.focus');
            }
        }
    });

    context.subscriptions.push(runCmd, stopCmd, toggleCmd, outputChannel, uriHandler);
}

export function deactivate() {
    if (activeRunProcess) {
        activeRunProcess.kill();
    }
    outputChannel?.dispose();
}
