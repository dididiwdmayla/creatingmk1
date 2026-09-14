"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Máquina de escrever fiel ao material bruto: jitter humano entre
 * caracteres, pausa extra em pontuação, cursor piscando e gatilho opcional
 * por IntersectionObserver (para animar só quando a seção entra na tela).
 * Respeita prefers-reduced-motion (mostra o texto inteiro, sem cursor).
 */
interface TypewriterTextProps {
  text: string;
  delay?: number;
  speed?: number;
  showCursor?: boolean;
  triggerOnInView?: boolean;
  threshold?: number;
}

export function TypewriterText({
  text,
  delay = 0,
  speed = 40,
  showCursor = true,
  triggerOnInView = false,
  threshold = 0.3,
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isDone, setIsDone] = useState(true);
  const [isStarted, setIsStarted] = useState(!triggerOnInView);
  const containerRef = useRef<HTMLSpanElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    if (triggerOnInView && !isStarted) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsStarted(true);
            observer.disconnect();
          }
        },
        { threshold },
      );
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [text, triggerOnInView, isStarted, threshold, reducedMotion]);

  useEffect(() => {
    if (!isStarted || reducedMotion) return;

    setDisplayText("");
    setIsDone(false);
    let currentIndex = 0;
    let currentString = "";
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];

    const typeNextChar = () => {
      if (currentIndex >= text.length) {
        setIsDone(true);
        return;
      }
      const char = text[currentIndex];
      currentString += char;
      setDisplayText(currentString);
      currentIndex++;

      let nextDelay = speed + (Math.random() * 30 - 15);
      if (char === "." || char === "," || char === "?" || char === "!") {
        nextDelay += 250;
      }
      activeTimeouts.push(setTimeout(typeNextChar, nextDelay));
    };

    activeTimeouts.push(setTimeout(typeNextChar, delay));
    return () => activeTimeouts.forEach(clearTimeout);
  }, [text, delay, speed, isStarted, reducedMotion]);

  if (reducedMotion) return <span>{text}</span>;

  return (
    <span ref={containerRef} className="relative inline-block">
      {Array.from(text).map((char, i) => <span key={i} style={{ opacity: i < displayText.length ? 1 : 0 }}>{char}</span>)}
      {showCursor && !isDone && (
        <span
          className="ml-0.5 inline-block animate-pulse font-sans font-normal text-[var(--d-accent)]"
          aria-hidden="true"
        >
          |
        </span>
      )}

    </span>
  );
}
