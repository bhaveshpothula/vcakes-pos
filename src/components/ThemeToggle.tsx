"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-[var(--background)] hover:bg-bakery-cream hover:text-bakery-warm dark:hover:bg-bakery-dark border border-[var(--border)] transition-all cursor-pointer flex items-center justify-center text-[var(--foreground)]"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 text-bakery-warm" />
      ) : (
        <Sun className="w-5 h-5 text-bakery-gold" />
      )}
    </button>
  );
};
export default ThemeToggle;
