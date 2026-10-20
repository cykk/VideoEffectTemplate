import { useCallback } from 'react';

/**
 * 表单持久化 Hook
 * 使用 sessionStorage 保存和恢复表单草稿数据
 * 
 * @param key - 存储键名
 * @returns 保存、加载、清除方法
 */
export function useFormPersistence<T extends Record<string, unknown>>(key: string) {
    /**
     * 保存表单状态到 sessionStorage
     */
    const saveState = useCallback((state: T) => {
        try {
            sessionStorage.setItem(key, JSON.stringify(state));
            console.log(`[FormPersistence] Saved draft to sessionStorage: ${key}`);
        } catch (error) {
            console.error(`[FormPersistence] Failed to save draft:`, error);
        }
    }, [key]);

    /**
     * 从 sessionStorage 加载表单状态
     */
    const loadState = useCallback((): T | null => {
        try {
            const saved = sessionStorage.getItem(key);
            if (saved) {
                console.log(`[FormPersistence] Loaded draft from sessionStorage: ${key}`);
                return JSON.parse(saved);
            }
            return null;
        } catch (error) {
            console.error(`[FormPersistence] Failed to load draft:`, error);
            return null;
        }
    }, [key]);

    /**
     * 清除 sessionStorage 中的表单状态
     */
    const clearState = useCallback(() => {
        try {
            sessionStorage.removeItem(key);
            console.log(`[FormPersistence] Cleared draft from sessionStorage: ${key}`);
        } catch (error) {
            console.error(`[FormPersistence] Failed to clear draft:`, error);
        }
    }, [key]);

    return { saveState, loadState, clearState };
}

/**
 * 将 File 对象转换为 base64 字符串（用于存储）
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 将 base64 字符串转换回 File 对象（用于恢复）
 */
export async function base64ToFile(base64: string, fileName: string, fileType: string): Promise<File> {
    const response = await fetch(base64);
    const blob = await response.blob();
    return new File([blob], fileName, { type: fileType });
}
