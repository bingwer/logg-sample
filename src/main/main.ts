import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 개발 모드에서는 Vite 서버에 연결
  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // 글로벌 단축키 등록 (Ctrl+Shift+C로 화면 캡쳐)
  globalShortcut.register('CommandOrControl+Shift+C', async () => {
    await captureScreen();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 화면 캡쳐 함수
async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 1920,
        height: 1080
      }
    });

    if (sources.length > 0) {
      const screenImage = sources[0].thumbnail.toPNG();
      mainWindow.webContents.send('screen-captured', screenImage);
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
  }
}

// IPC 핸들러들
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: {
        width: 300,
        height: 200
      }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});

ipcMain.handle('capture-source', async (event, sourceId: string) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: {
        width: 1920,
        height: 1080
      }
    });
    
    const source = sources.find(s => s.id === sourceId);
    if (source) {
      return source.thumbnail.toPNG();
    }
    return null;
  } catch (error) {
    console.error('Error capturing source:', error);
    return null;
  }
});

ipcMain.handle('get-display-info', () => {
  return screen.getAllDisplays().map(display => ({
    id: display.id,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    primary: display === screen.getPrimaryDisplay()
  }));
}); 