"use client";

import { motion, useReducedMotion } from "framer-motion";

type Props = { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "li" };

/** Fades + rises 16px when scrolled into view (once). */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const reduce = useReducedMotion();
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </Tag>
  );
}
