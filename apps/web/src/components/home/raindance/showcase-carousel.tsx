"use client";

import { useEffect, useRef } from "react";
import type { ShowcaseItem } from "./showcase-config";

interface ShowcaseCarouselProps {
  items: ShowcaseItem[];
  alts: string[];
}

/** 竖屏 9:16 横向滑动轮播：只有进入视口的视频才会静音自动播放，其余暂停，避免同时解码多个视频。 */
export function ShowcaseCarousel({ items, alts }: ShowcaseCarouselProps) {
  const refs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) void video.play().catch(() => undefined);
          else video.pause();
        }
      },
      { threshold: [0, 0.6] },
    );
    refs.current.forEach((video) => video && observer.observe(video));
    return () => observer.disconnect();
  }, [items]);

  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {items.map((item, index) => (
        <li key={item.video} className="w-[62%] max-w-[240px] shrink-0 snap-center sm:w-[200px]">
          <video
            ref={(element) => {
              refs.current[index] = element;
            }}
            src={item.video}
            poster={item.poster}
            muted
            loop
            playsInline
            preload={index === 0 ? "metadata" : "none"}
            aria-label={alts[index] ?? alts[0]}
            className="aspect-[9/16] w-full rounded-2xl bg-slate-100 object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
