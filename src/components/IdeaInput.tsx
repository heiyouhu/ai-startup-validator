"use client";

import { useState } from "react";

interface IdeaInputProps {
  onSubmit: (idea: string) => void;
  disabled?: boolean;
}

export function IdeaInput({ onSubmit, disabled = false }: IdeaInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (disabled) return;
    const v = value.trim();
    if (v) onSubmit(v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = !disabled && !!value.trim();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-white shadow-soft p-4 focus-within:border-accent/30 focus-within:shadow-soft transition-all duration-300">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "请先配置 API Key 后再输入想法…" : "在此输入你的想法…"}
          rows={3}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-lg leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-border">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center rounded-lg bg-accent text-accent-foreground text-sm font-medium px-5 py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all duration-300 active:scale-[0.98]"
          >
            验证想法
          </button>
        </div>
      </div>
    </div>
  );
}
