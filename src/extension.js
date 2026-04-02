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
    return config.get('profiles', []);
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

// ─── Window Title ────────────────────────────────────────────────

async function applyWindowTitle(profile) {
    const windowConfig = vscode.workspace.getConfiguration('window');
    const defaultTitle =
        '${dirty}${activeEditorShort}${separator}${rootName}${separator}${profileName}${separator}${appName}';
    const currentTitle = windowConfig.get('title') || defaultTitle;
    const stripped = currentTitle.replace(/^\[.*?\]\s*/, '');
    const newTitle = `[${profile.name}] ${stripped}`;
    await windowConfig.update('title', newTitle, vscode.ConfigurationTarget.Global);
}

// ─── Switching Logic ─────────────────────────────────────────────

async function switchToProfile(profile) {
    const symlinkPath = getSymlinkPath();
    const configDir = resolveConfigDir(profile);

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

    // 3. Update window title
    await applyWindowTitle(profile);

    // 4. Reload the VS Code window (small delay to flush settings)
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

// ─── Onboarding ─────────────────────────────────────────────────

function sanitizeProfileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function createProfile() {
    const name = await vscode.window.showInputBox({
        prompt: 'Profile name (e.g., Work, Personal)',
        placeHolder: 'Work',
        validateInput: (value) => {
            if (!value || !value.trim()) {
                return 'Profile name is required';
            }
            const dirName = sanitizeProfileName(value);
            if (!dirName) {
                return 'Name must contain at least one letter or number';
            }
            const configDir = path.join(os.homedir(), `.claude-${dirName}`);
            if (fs.existsSync(configDir)) {
                return `Directory ~/.claude-${dirName} already exists`;
            }
            return null;
        },
    });

    if (!name) {
        return null;
    }

    const dirName = sanitizeProfileName(name);
    const configDir = path.join(os.homedir(), `.claude-${dirName}`);
    const configDirShort = `~/.claude-${dirName}`;

    fs.mkdirSync(configDir, { recursive: true });

    const terminal = vscode.window.createTerminal({
        name: `Claude Auth: ${name}`,
        env: { CLAUDE_CONFIG_DIR: configDir },
    });
    terminal.show();
    terminal.sendText(`echo "=== Authenticate your '${name}' Claude profile ==="`);
    terminal.sendText(`echo "Config dir: ${configDir}"`);
    terminal.sendText(`echo "Run: claude auth login"`);
    terminal.sendText(`echo "Then click 'Done' in the notification above."`);

    await vscode.window.showInformationMessage(
        `Authenticate your "${name}" profile in the terminal, then click Done.`,
        'Done'
    );

    return { name: name.trim(), configDir: configDirShort };
}

// ─── Shell Aliases ───────────────────────────────────────────────

const SHELL_ALIAS_MARKER = '# === Claude Profile Switcher ===';

async function injectShellAliases(profiles) {
    const shell = process.env.SHELL || '/bin/zsh';
    const rcFile = shell.includes('zsh') ? '.zshrc' : shell.includes('bash') ? '.bashrc' : '.profile';
    const rcPath = path.join(os.homedir(), rcFile);

    const aliases = profiles.map(p => {
        const alias = sanitizeProfileName(p.name);
        return `alias claude-${alias}="export CLAUDE_CONFIG_DIR=${p.configDir}; ln -sf ${p.configDir} ~/.claude"`;
    });
    const block = `\n${SHELL_ALIAS_MARKER}\n${aliases.join('\n')}\n`;

    const aliasNames = profiles.map(p => `claude-${sanitizeProfileName(p.name)}`).join(', ');

    // Always show the aliases regardless of injection result
    const aliasPreview = aliases.join('\n');

    try {
        const existing = fs.readFileSync(rcPath, 'utf8');

        // Check for our marker OR existing bare claude- aliases
        if (existing.includes(SHELL_ALIAS_MARKER)) {
            vscode.window.showInformationMessage(
                `Shell aliases already exist in ~/${rcFile} (marker found). Commands: ${aliasNames}`
            );
        } else if (aliases.some(a => existing.includes(a.split('=')[0]))) {
            vscode.window.showInformationMessage(
                `Claude aliases already present in ~/${rcFile}. Commands: ${aliasNames}`
            );
        } else {
            fs.appendFileSync(rcPath, block);
            vscode.window.showInformationMessage(
                `Shell aliases added to ~/${rcFile}. Commands: ${aliasNames}. Run "source ~/${rcFile}" to activate.`
            );
        }
    } catch (err) {
        vscode.window.showWarningMessage(
            `Could not write to ~/${rcFile}: ${err.message}. Add these aliases manually:\n${aliasPreview}`
        );
    }
}

// ─── Onboarding Orchestration ────────────────────────────────────

async function runOnboarding() {
    const createdProfiles = [];

    while (true) {
        const profile = await createProfile();
        if (!profile) {
            break;
        }
        createdProfiles.push(profile);

        const more = await vscode.window.showInformationMessage(
            `Profile "${profile.name}" created. Add another account?`,
            'Yes',
            'No, finish setup'
        );
        if (more !== 'Yes') {
            break;
        }
    }

    if (createdProfiles.length === 0) {
        return;
    }

    // Save profiles to VS Code settings
    const config = vscode.workspace.getConfiguration('claudeProfileSwitcher');
    const existingProfiles = config.get('profiles', []);
    const allProfiles = [...existingProfiles, ...createdProfiles];
    await config.update('profiles', allProfiles, vscode.ConfigurationTarget.Global);

    // Create symlink to first new profile
    const firstProfile = createdProfiles[0];
    const symlinkPath = getSymlinkPath();
    const configDir = resolveConfigDir(firstProfile);
    try {
        try { fs.unlinkSync(symlinkPath); } catch { /* ok */ }
        fs.symlinkSync(configDir, symlinkPath);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to create symlink: ${err.message}`);
    }

    // Inject shell aliases
    await injectShellAliases(allProfiles);

    // Update UI
    updateStatusBar(firstProfile);
    await applyWindowTitle(firstProfile);

    vscode.window.showInformationMessage(
        `Setup complete! ${createdProfiles.length} profile(s) created. Active: ${firstProfile.name}`
    );
}

// ─── Activation ──────────────────────────────────────────────────

async function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.command = 'claudeProfileSwitcher.switchProfile';
    context.subscriptions.push(statusBarItem);

    // Detect current profile, update status bar AND window title
    const profiles = getProfiles();
    const active = detectActiveProfile(profiles);
    updateStatusBar(active);
    statusBarItem.show();

    if (active) {
        applyWindowTitle(active);
    }

    // Auto-detect: no profiles and no symlink → offer onboarding
    if (profiles.length === 0 && !active) {
        const action = await vscode.window.showInformationMessage(
            'No Claude profiles found. Set up multi-account switching?',
            'Get Started',
            'Dismiss'
        );
        if (action === 'Get Started') {
            await runOnboarding();
        }
    }

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

    // Register the setup command
    const setupCommand = vscode.commands.registerCommand(
        'claudeProfileSwitcher.setupProfiles',
        async () => {
            await runOnboarding();
        }
    );
    context.subscriptions.push(setupCommand);
}

function deactivate() {}

module.exports = { activate, deactivate };
