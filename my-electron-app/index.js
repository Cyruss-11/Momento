const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// 设置应用名称
app.setName('我的日记');

// 定义文件路径
const APP_DIR = path.join(app.getPath('userData'), 'DiaryApp');
const MT_DIR = path.join(APP_DIR, 'MT');
const DIARY_FILE = path.join(MT_DIR, 'diaries.json');
const TRASH_FILE = path.join(MT_DIR, 'trash.json');
const SETTINGS_FILE = path.join(APP_DIR, 'settings.json');
const BACKUP_DIR = path.join(APP_DIR, 'backups');

// 初始化数据文件
async function initDataFile() {
  try {
    // 创建必要的目录
    await fs.mkdir(APP_DIR, { recursive: true });
    await fs.mkdir(MT_DIR, { recursive: true });
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // 初始化日记文件
    try {
      await fs.access(DIARY_FILE);
    } catch {
      await fs.writeFile(DIARY_FILE, JSON.stringify({ diaries: [] }, null, 2), 'utf8');
    }

    // 初始化回收站文件
    try {
      await fs.access(TRASH_FILE);
    } catch {
      await fs.writeFile(TRASH_FILE, JSON.stringify({ diaries: [] }, null, 2), 'utf8');
    }

    // 初始化设置文件
    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      const defaultSettings = {
        theme: 'light',
        fontSize: 16,
        autoSave: false,
        darkMode: false,
        editorType: 'richtext',
        autoSaveInterval: 60  // 默认60秒
      };
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('初始化数据文件失败:', error);
  }
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: '我的日记',
    icon: path.join(__dirname, 'favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: process.env.NODE_ENV === 'development'
    },
    autoHideMenuBar: true
  });

  // 在开发环境中加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    const waitForDevServer = async () => {
      try {
        const response = await fetch('http://localhost:5173');
        if (response.ok) {
          mainWindow.loadURL('http://localhost:5173');
          mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12') {
              mainWindow.webContents.toggleDevTools();
              event.preventDefault();
            } else if (input.key === 'F11') {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
              event.preventDefault();
            }
          });
        } else {
          setTimeout(waitForDevServer, 100);
        }
      } catch (error) {
        setTimeout(waitForDevServer, 100);
      }
    };
    // 显示加载提示
    mainWindow.loadFile('loading.html');
    // 等待开发服务器启动
    waitForDevServer();
  } else {
    // 在生产环境中加载打包后的文件
    mainWindow.loadFile('dist/index.html');
  }

  // 设置任务栏图标和应用名称
  if (process.platform === 'win32') {
    app.setAppUserModelId('我的日记');
  }
};

// 处理日记文件操作
ipcMain.handle('save-diary', async (event, { date, content, title, id }) => {
  try {
    const data = await fs.readFile(DIARY_FILE, 'utf8');
    const diaryData = JSON.parse(data);
    
    const newDiary = {
      id: id || Date.now().toString(), // 使用时间戳作为唯一ID
      date,
      title: title || '无标题',
      content,
      updatedAt: new Date().toISOString()
    };

    if (id) {
      const existingIndex = diaryData.diaries.findIndex(d => d.id === id);
      if (existingIndex >= 0) {
        diaryData.diaries[existingIndex] = newDiary;
      } else {
        diaryData.diaries.push(newDiary);
      }
    } else {
      diaryData.diaries.push(newDiary);
    }

    await fs.writeFile(DIARY_FILE, JSON.stringify(diaryData, null, 2), 'utf8');
    return { success: true, data: newDiary };
  } catch (error) {
    console.error('保存日记失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-diary', async (event, id) => {
  try {
    const data = await fs.readFile(DIARY_FILE, 'utf8');
    const diaryData = JSON.parse(data);
    const diary = diaryData.diaries.find(d => d.id === id);
  
    return { 
      success: true, 
      data: diary || null
    };
  } catch (error) {
    console.error('读取日记失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-diaries', async () => {
  try {
    const data = await fs.readFile(DIARY_FILE, 'utf8');
    const diaryData = JSON.parse(data);
    return { success: true, data: diaryData.diaries };
  } catch (error) {
    console.error('获取日记列表失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-diary', async (event, id) => {
  try {
    const data = await fs.readFile(DIARY_FILE, 'utf8');
    const diaryData = JSON.parse(data);
    diaryData.diaries = diaryData.diaries.filter(d => d.id !== id);
    await fs.writeFile(DIARY_FILE, JSON.stringify(diaryData, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('删除日记失败:', error);
    return { success: false, error: error.message };
  }
});

// 统计信息
ipcMain.handle('get-statistics', async () => {
  try {
    const [diaryData, trashData] = await Promise.all([
      fs.readFile(DIARY_FILE, 'utf8'),
      fs.readFile(TRASH_FILE, 'utf8')
    ]);

    const diaries = JSON.parse(diaryData).diaries;
    const trashed = JSON.parse(trashData).diaries;
    const currentMonth = new Date().getMonth() + 1;

    return {
      success: true,
      data: {
        total: diaries.length,
        monthly: diaries.filter(d => new Date(d.date).getMonth() + 1 === currentMonth).length,
        trashed: trashed.length
      }
    };
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return { success: false, error: error.message };
  }
});

// 回收站操作
ipcMain.handle('move-to-trash', async (event, id) => {
  try {
    const [diaryData, trashData] = await Promise.all([
      fs.readFile(DIARY_FILE, 'utf8'),
      fs.readFile(TRASH_FILE, 'utf8')
    ]);

    const diaryJson = JSON.parse(diaryData);
    const trashJson = JSON.parse(trashData);

    const diaryIndex = diaryJson.diaries.findIndex(d => d.id === id);
    if (diaryIndex !== -1) {
      const diary = diaryJson.diaries[diaryIndex];
      diary.deletedAt = new Date().toISOString();
      trashJson.diaries.push(diary);
      diaryJson.diaries.splice(diaryIndex, 1);

      await Promise.all([
        fs.writeFile(DIARY_FILE, JSON.stringify(diaryJson, null, 2), 'utf8'),
        fs.writeFile(TRASH_FILE, JSON.stringify(trashJson, null, 2), 'utf8')
      ]);
    }

    return { success: true };
  } catch (error) {
    console.error('移动到回收站失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-trash', async () => {
  try {
    const data = await fs.readFile(TRASH_FILE, 'utf8');
    const trashData = JSON.parse(data);
    return { success: true, data: trashData.diaries };
  } catch (error) {
    console.error('获取回收站列表失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-from-trash', async (event, id) => {
  try {
    const [diaryData, trashData] = await Promise.all([
      fs.readFile(DIARY_FILE, 'utf8'),
      fs.readFile(TRASH_FILE, 'utf8')
    ]);

    const diaryJson = JSON.parse(diaryData);
    const trashJson = JSON.parse(trashData);

    const trashIndex = trashJson.diaries.findIndex(d => d.id === id);
    if (trashIndex !== -1) {
      const diary = trashJson.diaries[trashIndex];
      delete diary.deletedAt;
      diaryJson.diaries.push(diary);
      trashJson.diaries.splice(trashIndex, 1);

      await Promise.all([
        fs.writeFile(DIARY_FILE, JSON.stringify(diaryJson, null, 2), 'utf8'),
        fs.writeFile(TRASH_FILE, JSON.stringify(trashJson, null, 2), 'utf8')
      ]);
    }

    return { success: true };
  } catch (error) {
    console.error('从回收站恢复失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-permanently', async (event, id) => {
  try {
    const data = await fs.readFile(TRASH_FILE, 'utf8');
    const trashData = JSON.parse(data);
    trashData.diaries = trashData.diaries.filter(d => d.id !== id);
    await fs.writeFile(TRASH_FILE, JSON.stringify(trashData, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('永久删除失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-trash', async () => {
  try {
    await fs.writeFile(TRASH_FILE, JSON.stringify({ diaries: [] }, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('清空回收站失败:', error);
    return { success: false, error: error.message };
  }
});

// 设置操作
ipcMain.handle('load-settings', async () => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    // 应用主题设置
    if (settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)) {
      nativeTheme.themeSource = 'dark';
    } else {
      nativeTheme.themeSource = 'light';
    }
    
    return { success: true, data: settings };
  } catch (error) {
    console.error('加载设置失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    // 验证设置数据
    if (typeof settings !== 'object') {
      throw new Error('无效的设置数据');
    }

    // 保存设置
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    
    // 应用主题设置
    if (settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)) {
      nativeTheme.themeSource = 'dark';
    } else {
      nativeTheme.themeSource = 'light';
    }

    return { success: true };
  } catch (error) {
    console.error('保存设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 数据管理操作
ipcMain.handle('export-data', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出数据',
      defaultPath: path.join(app.getPath('downloads'), 'diary-backup.zip'),
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (!filePath) {
      return { success: false, message: '未选择保存位置' };
    }

    const zip = new AdmZip();

    // 读取并添加数据文件到 zip
    const [diaryData, trashData, settingsData] = await Promise.all([
      fs.readFile(DIARY_FILE, 'utf8'),
      fs.readFile(TRASH_FILE, 'utf8'),
      fs.readFile(SETTINGS_FILE, 'utf8')
    ]);

    zip.addFile('diaries.json', Buffer.from(diaryData));
    zip.addFile('trash.json', Buffer.from(trashData));
    zip.addFile('settings.json', Buffer.from(settingsData));

    // 写入 zip 文件
    zip.writeZip(filePath);
    return { success: true };
  } catch (error) {
    console.error('导出数据失败:', error);
    return { success: false, message: error.message };
  }
});

// 导入数据
ipcMain.handle('import-data', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (filePaths.length === 0) {
      return { success: false, message: '未选择文件' };
    }

    const zip = new AdmZip(filePaths[0]);
    const zipEntries = zip.getEntries();

    // 验证 zip 文件内容
    const requiredFiles = ['diaries.json', 'trash.json', 'settings.json'];
    const hasAllFiles = requiredFiles.every(file => 
      zipEntries.some(entry => entry.entryName === file)
    );

    if (!hasAllFiles) {
      return { success: false, message: '无效的备份文件' };
    }

    // 解压并保存文件
    await Promise.all([
      fs.writeFile(DIARY_FILE, zip.readFile('diaries.json')),
      fs.writeFile(TRASH_FILE, zip.readFile('trash.json')),
      fs.writeFile(SETTINGS_FILE, zip.readFile('settings.json'))
    ]);

    return { success: true };
  } catch (error) {
    console.error('导入数据失败:', error);
    return { success: false, message: error.message };
  }
});

// 处理打开数据文件夹的请求
ipcMain.handle('open-data-folder', async () => {
  try {
    const dataPath = app.getPath('userData');
    await shell.openPath(dataPath);
    return { success: true };
  } catch (error) {
    console.error('打开数据文件夹失败:', error);
    return { success: false, error: error.message };
  }
});

// 创建备份
ipcMain.handle('create-backup', async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.zip`);

    // 确保备份目录存在
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const zip = new AdmZip();

    // 读取并添加数据文件到 zip
    const [diaryData, trashData, settingsData] = await Promise.all([
      fs.readFile(DIARY_FILE, 'utf8'),
      fs.readFile(TRASH_FILE, 'utf8'),
      fs.readFile(SETTINGS_FILE, 'utf8')
    ]);

    zip.addFile('diaries.json', Buffer.from(diaryData));
    zip.addFile('trash.json', Buffer.from(trashData));
    zip.addFile('settings.json', Buffer.from(settingsData));

    // 写入 zip 文件
    zip.writeZip(backupPath);
    return { success: true, backupPath };
  } catch (error) {
    console.error('创建备份失败:', error);
    return { success: false, message: error.message };
  }
});

// 辅助函数：检查文件是否存在
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 全屏切换处理
ipcMain.handle('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setFullScreen(!win.isFullScreen());
});

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  await initDataFile();
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 