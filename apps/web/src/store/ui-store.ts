import { create } from 'zustand';

interface DemoVideoInfo {
    modelName: string;
    videoUrl: string;
    modelLogo: string;
}

interface UIStore {
    // 当前选中模型的演示视频信息
    demoVideoInfo: DemoVideoInfo | null;
    setDemoVideoInfo: (info: DemoVideoInfo) => void;
}

export const useUIStore = create<UIStore>((set) => ({
    demoVideoInfo: null,
    setDemoVideoInfo: (info) => set({ demoVideoInfo: info }),
}));
