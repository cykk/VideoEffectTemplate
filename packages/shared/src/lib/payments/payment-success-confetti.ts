"use client";

import confetti from "canvas-confetti";

export function playPaymentSuccessConfetti(): () => void {
  const timeouts: Array<ReturnType<typeof setTimeout>> = [];
  const intervals: Array<ReturnType<typeof setInterval>> = [];

  try {
    void confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.5 },
      colors: [
        "rgb(251 191 36)",
        "rgb(245 158 11)",
        "rgb(255 255 255)",
        "rgb(139 92 246)",
        "rgb(13 148 136)",
        "rgb(236 72 153)",
      ],
      scalar: 1.2,
      gravity: 0.8,
    });
  } catch (error) {
    console.error("[Confetti Error] Failed to fire initial burst:", error);
  }

  timeouts.push(
    setTimeout(() => {
      void confetti({
        particleCount: 120,
        angle: 60,
        spread: 100,
        origin: { x: 0, y: 0.3 },
        colors: ["rgb(251 191 36)", "rgb(255 255 255)", "rgb(139 92 246)", "rgb(217 70 239)"],
      });
      void confetti({
        particleCount: 120,
        angle: 120,
        spread: 100,
        origin: { x: 1, y: 0.3 },
        colors: ["rgb(6 182 212)", "rgb(255 255 255)", "rgb(16 185 129)", "rgb(251 191 36)"],
      });
    }, 200)
  );

  timeouts.push(
    setTimeout(() => {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 50,
        spread: 360,
        ticks: 120,
        zIndex: 0,
        gravity: 0.7,
      };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        void confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: [
            "rgb(251 191 36)",
            "rgb(245 158 11)",
            "rgb(255 255 255)",
            "rgb(139 92 246)",
            "rgb(217 70 239)",
          ],
          scalar: randomInRange(0.8, 1.4),
        });

        void confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: [
            "rgb(13 148 136)",
            "rgb(8 145 178)",
            "rgb(255 255 255)",
            "rgb(16 185 129)",
            "rgb(251 191 36)",
          ],
          scalar: randomInRange(0.8, 1.4),
        });
      }, 200);

      intervals.push(interval);
      timeouts.push(setTimeout(() => clearInterval(interval), duration));
    }, 400)
  );

  timeouts.push(
    setTimeout(() => {
      const count = 150;
      const defaults: Partial<confetti.Options> = {
        origin: { y: 0.2 },
        colors: ["rgb(251 191 36)", "rgb(245 158 11)", "rgb(255 237 213)"],
        shapes: ["star"] as confetti.Shape[],
        scalar: 1.5,
      };

      const fire = (particleRatio: number, options: confetti.Options) => {
        void confetti({
          ...defaults,
          ...options,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }, 1000)
  );

  return () => {
    timeouts.forEach((timer) => clearTimeout(timer));
    intervals.forEach((timer) => clearInterval(timer));
  };
}
