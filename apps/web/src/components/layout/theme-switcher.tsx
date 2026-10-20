"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HeaderDictionary } from "@markless/shared/src/i18n/types";

type Theme = "light" | "dark" | "system";

interface ThemeSwitcherProps {
  dictionary: HeaderDictionary;
}

export function ThemeSwitcher({ dictionary }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // 从localStorage读取保存的主题设置
    try {
      const savedTheme = localStorage.getItem("theme") as Theme;
      if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Error reading theme from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const root = window.document.documentElement;
      
      // 移除所有主题类
      root.classList.remove("light", "dark");
      
      if (theme === "system") {
        // 跟随系统主题
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      
      // 保存到localStorage
      localStorage.setItem("theme", theme);
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const getThemeIcon = (theme: Theme) => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (theme: Theme) => {
    switch (theme) {
      case "light":
        return dictionary.lightTheme;
      case "dark":
        return dictionary.darkTheme;
      case "system":
        return dictionary.systemTheme;
      default:
        return theme;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 h-9 w-9 md:w-9 p-0">
        {getThemeIcon(theme)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {(["light", "dark", "system"] as Theme[]).map((themeOption) => (
          <DropdownMenuItem
            key={themeOption}
            onClick={() => handleThemeChange(themeOption)}
            className={themeOption === theme ? "bg-accent" : ""}
          >
            {getThemeIcon(themeOption)}
            <span className="ml-2">{getThemeLabel(themeOption)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
