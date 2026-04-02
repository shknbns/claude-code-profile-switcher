const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Helpers ─────────────────────────────────────────────────────

function expandTilde(p) {
    if (p.startsWith('~/') || p === '~') {
        return path.join(os.homedir(), p.slice(1));
    }
    return p;
}

function resolveConfigDir(profile) {
    return path.resolve(expandTilde(profile.configDir));
}

function getProfiles() {
    const config = vscode.workspace.getConfiguration('claudeProfileSwitcher');
    const raw = config.get('profiles', []);
    return raw.map(p => ({
        ...p,
        titleBarForeground: p.titleBarForeground || '#ffffff',
    }));
}

function getSymlinkPath() {
    const config = vscode.workspace.getConfiguration('claudeProfileSwitcher');
    return expandTilde(config.get('symlinkPath', '~/.claude'));
}

// ─── Detection ───────────────────────────────────────────────────

function detectActiveProfile(profiles) {
    const symlinkPath = getSymlinkPath();
    try {
        const target = fs.readlinkSync(symlinkPath);
        const resolvedTarget = path.resolve(path.dirname(symlinkPath), target);
        return profiles.find(p => resolveConfigDir(p) === resolvedTarget);
    } catch {
        return undefined;
    }
}

// ─── Switching Logic ─────────────────────────────────────────────

async function switchToProfile(profile) {
    const symlinkPath = getSymlinkPath();
    const configDir = resolveConfigDir(profile);

    // Validate config directory exists
    if (!fs.existsSync(configDir)) {
        vscode.window.showErrorMessage(
            `Claude profile directory does not exist: ${configDir}`
        );
        return;
    }

    // 1. Recreate the symlink
    try {
        try {
            fs.unlinkSync(symlinkPath);
        } catch {
            // Doesn't exist yet — fine
        }
        fs.symlinkSync(configDir, symlinkPath);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Failed to create symlink: ${err.message}`
        );
        return;
    }

    // 2. Set CLAUDE_CONFIG_DIR for integrated terminals
    const terminalEnvConfig = vscode.workspace.getConfiguration(
        'terminal.integrated.env'
    );
    const currentOsx = terminalEnvConfig.get('osx') || {};
    await terminalEnvConfig.update(
        'osx',
        { ...currentOsx, CLAUDE_CONFIG_DIR: configDir },
        vscode.ConfigurationTarget.Global
    );

    // 3. Update title bar colors
    const workbenchConfig = vscode.workspace.getConfiguration('workbench');
    const currentColors = workbenchConfig.get('colorCustomizations') || {};
    await workbenchConfig.update(
        'colorCustomizations',
        {
            ...currentColors,
            'titleBar.activeBackground': profile.titleBarColor,
            'titleBar.activeForeground': profile.titleBarForeground,
        },
        vscode.ConfigurationTarget.Global
    );

    // 4. Update window title with profile name prefix
    const windowConfig = vscode.workspace.getConfiguration('window');
    const defaultTitle =
        '${dirty}${activeEditorShort}${separator}${rootName}${separator}${profileName}${separator}${appName}';
    const currentTitle = windowConfig.get('title') || defaultTitle;
    const stripped = currentTitle.replace(/^\[.*?\]\s*/, '');
    const newTitle = `[${profile.name}] ${stripped}`;
    await windowConfig.update(
        'title',
        newTitle,
        vscode.ConfigurationTarget.Global
    );

    // 5. Reload the VS Code window (small delay to flush settings)
    setTimeout(() => {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }, 300);
}

// ─── Status Bar ──────────────────────────────────────────────────

let statusBarItem;

function updateStatusBar(profile) {
    if (profile) {
        statusBarItem.text = `$(account) Claude: ${profile.name}`;
        statusBarItem.tooltip = `Active Claude profile: ${profile.name}\nConfig: ${profile.configDir}\nClick to switch`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(warning) Claude: Unknown`;
        statusBarItem.tooltip =
            'Claude profile not detected. Click to switch.';
        statusBarItem.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.warningBackground'
        );
    }
}

// ─── Activation ──────────────────────────────────────────────────

function activate(context) {
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.command = 'claudeProfileSwitcher.switchProfile';
    context.subscriptions.push(statusBarItem);

    // Detect and display current profile
    const profiles = getProfiles();
    const active = detectActiveProfile(profiles);
    updateStatusBar(active);
    statusBarItem.show();

    // Register the switch command
    const switchCommand = vscode.commands.registerCommand(
        'claudeProfileSwitcher.switchProfile',
        async () => {
            const profiles = getProfiles();
            if (profiles.length === 0) {
                vscode.window.showWarningMessage(
                    'No Claude profiles configured. Add profiles in Settings > Claude Profile Switcher.'
                );
                return;
            }

            const active = detectActiveProfile(profiles);

            const items = profiles.map(p => ({
                label: p.name,
                description: p.configDir,
                detail:
                    active && active.name === p.name
                        ? '$(check) Currently active'
                        : undefined,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Claude profile',
                title: 'Switch Claude Profile',
            });

            if (!selected) {
                return;
            }

            const targetProfile = profiles.find(
                p => p.name === selected.label
            );
            if (!targetProfile) {
                return;
            }

            if (active && active.name === targetProfile.name) {
                const confirm = await vscode.window.showInformationMessage(
                    `"${targetProfile.name}" is already active. Re-apply anyway?`,
                    'Yes',
                    'No'
                );
                if (confirm !== 'Yes') {
                    return;
                }
            }

            await switchToProfile(targetProfile);
        }
    );

    context.subscriptions.push(switchCommand);
}

function deactivate() {}

module.exports = { activate, deactivate };
