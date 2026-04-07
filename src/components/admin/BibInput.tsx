"use client";

import React, { useState, useEffect } from "react";

type BibInputProps = {
  initialValue: string;
  isDuplicate: boolean;
  onSave: (val: string) => void;
};

export default function BibInput({ initialValue, isDuplicate, onSave }: BibInputProps) {
  const [value, setValue] = useState(initialValue);

  // 外部からの更新（Firestoreからの再取得時など）を反映
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // フォーカスが外れた時（onBlur）に保存を発火
  const handleBlur = () => {
    if (value !== initialValue) {
      onSave(value);
    }
  };

  // Enterキーを押した時にフォーカスを外して保存を発火させる
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="例: 101"
      className={`w-full p-2 bg-white border-2 rounded-xl focus:outline-none font-bold text-base text-center transition-colors shadow-inner ${
        isDuplicate 
          ? "border-red-500 bg-red-50 text-red-700 focus:border-red-600 focus:ring-2 focus:ring-red-500/20" 
          : "border-theme-secondary/30 focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20"
      }`}
    />
  );
}