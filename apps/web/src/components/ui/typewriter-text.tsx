"use client";

import { useState, useEffect } from "react";

interface TypewriterTextProps {
    text: string;
    speed?: number;
    delay?: number;
    className?: string;
}

export function TypewriterText({
    text,
    speed = 50,
    delay = 1000,
    className = ""
}: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        let charIndex = 0;

        const startTyping = () => {
            setIsTyping(true);
            setDisplayedText("");
            charIndex = 0;

            const typeNextChar = () => {
                if (charIndex < text.length) {
                    setDisplayedText(text.slice(0, charIndex + 1));
                    charIndex++;
                    timeout = setTimeout(typeNextChar, speed);
                } else {
                    setIsTyping(false);
                    // Restart after delay
                    timeout = setTimeout(() => {
                        startTyping();
                    }, delay * 3);
                }
            };

            timeout = setTimeout(typeNextChar, delay);
        };

        startTyping();

        return () => clearTimeout(timeout);
    }, [text, speed, delay]);

    return (
        <span className={className}>
            {displayedText}
            <span
                className={`inline-block w-0.5 h-5 bg-white/80 ml-0.5 ${
                    isTyping ? "animate-pulse" : "opacity-0"
                }`}
            />
        </span>
    );
}
