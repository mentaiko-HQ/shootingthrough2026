import React from "react";

type ToastProps = {
  message: { text: string; type: "success" | "error" } | null;
};

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  const isSuccess = message.type === "success";
  const bgClass = isSuccess ? "bg-[#10b981]" : "bg-[#ef4444]";
  const icon = isSuccess ? "✅" : "⚠️";

  return (
    <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-full font-black text-lg shadow-2xl z-[9999] flex items-center gap-3 animate-bounce ${bgClass} text-white`}>
      <span>{icon}</span>
      <span>{message.text}</span>
    </div>
  );
}