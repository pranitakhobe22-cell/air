import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'selfheal.agentView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the Webview
        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case 'runTest': {
                    vscode.commands.executeCommand('selfheal.runCurrentTest');
                    break;
                }
                case 'stopTest': {
                    vscode.commands.executeCommand('selfheal.stopRun');
                    break;
                }
                case 'onInfo': {
                    if (!data.value) return;
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case 'onError': {
                    if (!data.value) return;
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    /**
     * Called by the extension host to pass the dynamically allocated 
     * WebSocket port (from the CLI runner) down into the Webview.
     */
    public sendPortToWebview(port: number) {
        if (this._view) {
            this._view.show?.(true); // force it to reveal
            this._view.webview.postMessage({ type: 'PORT_ALLOCATED', port });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Read index.html from our local copy in the extension
        const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        // We must translate standard <script src="ui.js"> into VS Code Webview URIs
        const uiJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'ui.js'));
        const wsClientJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'ws-client.js'));

        // Replace the script tags with the webview-safe URIs
        html = html.replace('<script src="ui.js"></script>', `<script src="${uiJsUri}"></script>`);
        html = html.replace('<script src="ws-client.js"></script>', `<script src="${wsClientJsUri}"></script>`);
        
        // Add the VS Code API acquisition script so the webview can talk to the host
        const vscodeApiScript = `<script>const vscode = acquireVsCodeApi();</script>`;
        html = html.replace('</head>', `${vscodeApiScript}\n</head>`);

        return html;
    }
}
