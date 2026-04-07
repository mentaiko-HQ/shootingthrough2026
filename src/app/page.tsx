"use client";

import React, { useEffect, useState } from "react";
import { Target, ClipboardList, ChevronRight, Trophy, Users, MonitorPlay, Edit } from "lucide-react";

/**
 * 弓道大会システム「SHOOTING THROUGH」トップページ
 * * エラー回避のため、Next.jsの Link コンポーネントの代わりに
 * 標準の a タグを使用してナビゲーションを実装しています。
 */
export default function HomePage() {
  const [hasError, setHasError] = useState<boolean>(false);

  // クライアントサイドでの予期せぬエラーを捕捉しログを出力する機構
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("[Page Error Log] トップページでエラーが発生しました:", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
      setHasError(true);
    };

    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-6 rounded-2xl border-l-4 border-red-500 max-w-md w-full">
          <h2 className="text-xl font-bold text-red-500 mb-2">システムエラー</h2>
          <p className="text-slate-400 text-sm mb-4">
            画面の描画中に問題が発生しました。コンソールのエラーログを確認してください。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-bold"
          >
            画面を再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景の装飾用グラデーション */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl w-full text-center space-y-12 relative z-10 py-10">
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

        {/* 4つのリンクを配置するグリッドレイアウト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          
          {/* 1. 一般公開用：成績閲覧ページ */}
          <a 
            href="/results" 
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

          {/* 2. 会場表示用：ディスプレイページ */}
          <a 
            href="/display" 
            className="group relative p-8 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-600/10 transition-all duration-500 text-left overflow-hidden flex flex-col justify-between min-h-[220px]"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <MonitorPlay size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-1 flex items-center gap-2">
                  DISPLAY <ChevronRight size={28} className="group-hover:translate-x-2 transition-transform text-purple-500" />
                </h2>
                <p className="text-slate-400 group-hover:text-slate-200 font-bold leading-relaxed">
                  会場モニター用画面<br />進行状況の全画面表示
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <MonitorPlay size={200} />
            </div>
          </a>

          {/* 3. データ入力用：エントリーページ */}
          <a 
            href="/entry" 
            className="group relative p-8 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-600/10 transition-all duration-500 text-left overflow-hidden flex flex-col justify-between min-h-[220px]"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Edit size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-1 flex items-center gap-2">
                  DATA ENTRY <ChevronRight size={28} className="group-hover:translate-x-2 transition-transform text-amber-500" />
                </h2>
                <p className="text-slate-400 group-hover:text-slate-200 font-bold leading-relaxed">
                  選手データやスコアの<br />新規登録・入力画面
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Edit size={200} />
            </div>
          </a>

          {/* 4. 運営専用：管理パネル */}
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
                  運営スタッフ専用<br />システム設定・データ統括
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Users size={200} />
            </div>
          </a>

        </div>

        <footer className="pt-12">
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