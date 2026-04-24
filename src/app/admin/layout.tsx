"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Firebaseの認証状態を監視
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // 未ログイン（userがnull）の場合は、強制的にログイン画面へ飛ばす
        router.push("/login");
      } else {
        // ログイン済みの場合はローディングを解除して画面を表示する
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 認証チェックが終わるまではローディング画面を表示（画面のチラつきと情報漏洩を防止）
  if (isLoading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="text-theme-primary font-bold animate-pulse flex items-center gap-2">
          <span>🔒</span> 認証情報を確認中...
        </div>
      </div>
    );
  }

  // 認証が確認できたら、本来の管理画面（page.tsx）を表示する
  return <>{children}</>;
}