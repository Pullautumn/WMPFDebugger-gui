const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let devToolsWindow;
let serverProcess;
let isServerRunning = false;

function createWindow() {
    // 创建主窗口
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: '微信小程序调试器',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        }
    });

    // 加载app.html界面
    mainWindow.loadFile(path.join(__dirname, 'app.html'));

    // 打开开发者工具（如果需要调试UI）
    // mainWindow.webContents.openDevTools();

    // 窗口关闭事件
    mainWindow.on('closed', function () {
        stopServer();
        if (devToolsWindow) {
            devToolsWindow.close();
        }
        mainWindow = null;
    });
}

// 启动后端服务器
function startServer() {
    // 使用编译后的JavaScript文件而不是直接使用ts-node
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });

    serverProcess.on('spawn', () => {
        isServerRunning = true;
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: true });
        }
        console.log('服务器进程已成功启动');
    });

    serverProcess.on('close', (code) => {
        isServerRunning = false;
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
        if (devToolsWindow) {
            devToolsWindow.close();
            devToolsWindow = null;
        }
        console.log(`服务器进程已退出，退出码: ${code}`);
    });

    serverProcess.on('error', (err) => {
        isServerRunning = false;
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
        console.error('启动服务器失败:', err);
    });
}

// 关闭后端服务器
function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
    isServerRunning = false;
    if (mainWindow) {
        mainWindow.webContents.send('server-status', { running: false });
    }
    if (devToolsWindow) {
        devToolsWindow.close();
        devToolsWindow = null;
    }
}

// IPC事件处理
ipcMain.on('start-server', () => {
    startServer();
});

ipcMain.on('stop-server', () => {
    stopServer();
});

ipcMain.on('open-devtools', () => {
    if (isServerRunning && !devToolsWindow) {
        // 创建DevTools窗口
        devToolsWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            title: '微信小程序调试器控制台',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false, // 允许加载devtools协议
            }
        });

        // 加载Chrome DevTools界面
        devToolsWindow.loadURL('devtools://devtools/bundled/inspector.html?ws=127.0.0.1:62000');

        // 窗口关闭事件
        devToolsWindow.on('closed', function () {
            devToolsWindow = null;
        });
    } else if (!isServerRunning) {
        // 如果服务器未运行，通知主窗口
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
    }
});

// 刷新控制台
ipcMain.on('refresh-devtools', () => {
    if (isServerRunning && devToolsWindow) {
        devToolsWindow.reload();
        console.log('控制台已刷新');
    }
});

// 应用程序就绪事件
app.on('ready', () => {
    createWindow();
});

// 所有窗口关闭事件
app.on('window-all-closed', function () {
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 激活应用程序事件（macOS）
app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
