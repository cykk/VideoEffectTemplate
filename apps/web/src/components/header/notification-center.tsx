"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bell, Check, Video, CreditCard, AlertCircle, X } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface Notification {
    id: string;
    type: "video_complete" | "credits_low" | "payment_success" | "system";
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
}

interface NotificationCenterProps {
    notifications?: Notification[];
}

export function NotificationCenter({
    notifications = [],
}: NotificationCenterProps) {
    const { dictionary } = useLocale();
    const dict = dictionary.header.notificationCenter;
    const [isOpen, setIsOpen] = useState(false);
    const [localNotifications, setLocalNotifications] = useState(notifications);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const isLight = pathname?.includes("/settings");

    const unreadCount = localNotifications.filter((n) => !n.read).length;

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    const markAsRead = (id: string) => {
        setLocalNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        // TODO: Call API to mark notification as read
    };

    const markAllAsRead = () => {
        setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        // TODO: Call API to mark all notifications as read
    };

    const deleteNotification = (id: string) => {
        setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
        // TODO: Call API to delete notification
    };

    const getIcon = (type: Notification["type"]) => {
        switch (type) {
            case "video_complete":
                return <Video className="w-5 h-5 text-green-600" />;
            case "credits_low":
                return <AlertCircle className="w-5 h-5 text-orange-600" />;
            case "payment_success":
                return <CreditCard className="w-5 h-5 text-blue-600" />;
            default:
                return <Bell className="w-5 h-5 text-neutral-600" />;
        }
    };

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer",
                    isLight
                        ? "text-neutral-500 hover:bg-slate-100 hover:text-slate-700"
                        : "text-neutral-300 hover:bg-brand-500/10 hover:text-brand-200"
                )}
                aria-label="Notifications"
            >
                <Bell className={cn(
                    "w-5 h-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12",
                    isLight ? "group-hover:text-slate-700" : "group-hover:text-brand-300"
                )} />
                {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                            {dict.title}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                            >
                                {dict.markAllRead}
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {localNotifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    {dict.noNotifications}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                {localNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`group p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${!notification.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            {/* Icon */}
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                        {notification.title}
                                                    </h4>
                                                    <button
                                                        onClick={() => deleteNotification(notification.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                                                        aria-label="Delete notification"
                                                    >
                                                        <X className="w-3.5 h-3.5 text-neutral-500" />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-neutral-500">
                                                        {formatTimestamp(notification.timestamp)}
                                                    </span>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="text-xs text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1"
                                                        >
                                                            <Check className="w-3 h-3" />
                                                            {dict.markRead}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
