"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase"; // ステップ2でexportしたauthを読み込む

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // すでにログイン済みの場合は、自動的に管理画面へリダイレクトさせる
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/admin");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      // Firebase Authenticationでログイン処理を実行
      await signInWithEmailAndPassword(auth, email, password);
      
      // 成功したら管理画面のトップへ遷移
      router.push("/admin");
    } catch (error: any) {
      console.error("❌ ログインエラー:", error);
      setErrorMsg("メールアドレス、またはパスワードが正しくありません。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* 背景の装飾（トップページと同じグラスモーフィズムの雰囲気） */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border-2 border-theme-secondary/10 shadow-sm mb-4 text-3xl">
            🔒
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-theme-secondary tracking-tight mb-2">
            システムログイン
          </h1>
          <p className="text-sm font-bold text-theme-secondary/60">
            第100回 勇気凛々杯争奪弓道大会 管理用
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border-2 border-theme-secondary/10">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2">
              <span>⚠️</span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-theme-secondary/70 mb-2 uppercase tracking-wider">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-theme-primary focus:bg-white outline-none font-bold text-theme-secondary transition-colors"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-theme-secondary/70 mb-2 uppercase tracking-wider">
                パスワード
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-theme-primary focus:bg-white outline-none font-bold text-theme-secondary transition-colors"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full mt-4 py-4 bg-theme-primary text-white font-black rounded-xl shadow-[0_4px_0_0_rgba(139,21,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(139,21,0,1)] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isLoading ? "認証中..." : "ログインする"}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => router.push("/")}
            className="text-sm font-bold text-theme-secondary/50 hover:text-theme-secondary transition-colors"
          >
            ← トップページへ戻る
          </button>
        </div>

      </div>
    </div>
  );
}