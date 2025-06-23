import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  getScreenSources: () => Promise<ScreenSource[]>;
  captureSource: (sourceId: string) => Promise<Buffer | null>;
  getDisplayInfo: () => Promise<DisplayInfo[]>;
  onScreenCaptured: (callback: (image: Buffer) => void) => void;
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  primary: boolean;
}

const electronAPI: ElectronAPI = {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  captureSource: (sourceId: string) => ipcRenderer.invoke('capture-source', sourceId),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  onScreenCaptured: (callback: (image: Buffer) => void) => {
    ipcRenderer.on('screen-captured', (event, image) => callback(image));
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 