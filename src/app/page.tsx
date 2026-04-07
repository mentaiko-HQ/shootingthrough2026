"use client";

import React from "react";
import { Target, ClipboardList, ChevronRight, Trophy, Users } from "lucide-react";

/**
 * 弓道大会システム「SHOOTING THROUGH」トップページ
 * * エラー回避のため、Next.jsの Link コンポーネントの代わりに
 * 標準の a タグを使用してナビゲーションを実装しています。
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景の装飾用グラデーション */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl w-full text-center space-y-12 relative z-10">
        <header className="space-y-6">
          <div className="inline-flex p-5 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl shadow-blue-500/20 mb-4 animate-in zoom-in duration-700">
            <Target size={48} strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter italic">
              SHOOTING<br className="md:hidden" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">THROUGH</span>
            </h1>
            <p className="text-slate-400 font-bold text-lg md:text-2xl tracking-[0.2em] uppercase opacity-80">
              Kyudo Tournament 2026
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          {/* 一般公開用：成績閲覧ページ */}
          <a 
            href="/result" 
            className="group relative p-8 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-600/10 transition-all duration-500 text-left overflow-hidden flex flex-col justify-between min-h-[220px]"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <Trophy size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-1 flex items-center gap-2">
                  LIVE RESULT <ChevronRight size={28} className="group-hover:translate-x-2 transition-transform text-blue-500" />
                </h2>
                <p className="text-slate-400 group-hover:text-slate-200 font-bold leading-relaxed">
                  大会の速報・的中数を<br />リアルタイムで確認
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Target size={200} />
            </div>
          </a>

          {/* 運営専用：管理パネル */}
          <a 
            href="/admin" 
            className="group relative p-8 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-600/10 transition-all duration-500 text-left overflow-hidden flex flex-col justify-between min-h-[220px]"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <ClipboardList size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-1 flex items-center gap-2">
                  ADMIN PANEL <ChevronRight size={28} className="group-hover:translate-x-2 transition-transform text-emerald-500" />
                </h2>
                <p className="text-slate-400 group-hover:text-slate-200 font-bold leading-relaxed">
                  運営スタッフ専用<br />成績入力・データ管理
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Users size={200} />
            </div>
          </a>
        </div>

        <footer className="pt-20">
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-slate-500 font-black text-xs tracking-widest uppercase">
              System Active: 2026 Season Official
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}