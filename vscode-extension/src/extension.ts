import * as vscode from 'vscode';
import * as path from 'path';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SelfHeal');
    outputChannel.appendLine('🩹 SelfHeal extension activated.');

    // ── Status Bar Button ──────────────────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = '$(beaker) SelfHeal';
    statusBarItem.tooltip = 'Run current test through SelfHeal engine';
    statusBarItem.command = 'selfheal.runCurrentTest';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // ── Command: Run Current Test ──────────────────────────────────
    const runCmd = vscode.commands.registerCommand(
        'selfheal.runCurrentTest',
        async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage(
                    'SelfHeal: Please open a Playwright test file first.'
                );
                return;
            }

            const filePath = editor.document.fileName;

            // Gate: Only JS/TS files
            if (
                !filePath.endsWith('.js') &&
                !filePath.endsWith('.ts') &&
                !filePath.endsWith('.mjs')
            ) {
                vscode.window.showWarningMessage(
                    'SelfHeal: The current file does not look like a test script (.js, .ts, .mjs).'
                );
                return;
            }

            // Save the file before running
            await editor.document.save();

            // Resolve workspace-relative path
            const workspaceRoot =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            const relativePath = path.relative(workspaceRoot, filePath);

            outputChannel.appendLine(
                `\n─── Running SelfHeal on: ${relativePath} ───`
            );
            outputChannel.show(true);

            // Update status bar while running
            statusBarItem.text = '$(sync~spin) SelfHeal…';
            statusBarItem.tooltip = `Healing: ${path.basename(filePath)}`;

            // Create or reuse a dedicated terminal
            const terminalName = 'SelfHeal Runner';
            let terminal = vscode.window.terminals.find(
                (t) => t.name === terminalName
            );
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot || undefined,
                    iconPath: new vscode.ThemeIcon('beaker'),
                });
            }

            terminal.show();
            terminal.sendText(
                `npx selfheal run "${relativePath}" --dashboard`
            );

            // Show a progress notification
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `SelfHeal: Running ${path.basename(filePath)}…`,
                    cancellable: false,
                },
                async () => {
                    // Wait a reasonable amount so the user sees the notification
                    await new Promise((resolve) =>
                        setTimeout(resolve, 4000)
                    );
                }
            );

            // Reset status bar after a delay
            setTimeout(() => {
                statusBarItem.text = '$(beaker) SelfHeal';
                statusBarItem.tooltip =
                    'Run current test through SelfHeal engine';
            }, 8000);
        }
    );

    // ── Command: Open Dashboard ────────────────────────────────────
    const dashCmd = vscode.commands.registerCommand(
        'selfheal.openDashboard',
        () => {
            const workspaceRoot =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

            const terminalName = 'SelfHeal Dashboard';
            let terminal = vscode.window.terminals.find(
                (t) => t.name === terminalName
            );
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot || undefined,
                    iconPath: new vscode.ThemeIcon('dashboard'),
                });
            }

            terminal.show();
            terminal.sendText('npx selfheal run --dashboard');

            vscode.window.showInformationMessage(
                'SelfHeal: Opening dashboard…'
            );
        }
    );

    context.subscriptions.push(runCmd, dashCmd, outputChannel);
}

export function deactivate() {
    statusBarItem?.dispose();
    outputChannel?.dispose();
}
