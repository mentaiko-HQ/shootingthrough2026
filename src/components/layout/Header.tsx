import React, { useSyncExternalStore } from "react";

// --- ネットワーク状態を監視するための関数 ---
const subscribe = (callback: () => void) => {
  if (typeof window !== "undefined") {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  }
  return () => {};
};

// クライアントサイドでの現在のネットワーク状態を取得
const getSnapshot = () => {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
};

// サーバーサイドレンダリング時は常にオンラインと仮定
const getServerSnapshot = () => {
  return true;
};

type HeaderProps = {
  title: string;
  subtitle: string;
  isAdmin?: boolean;
  rightContent?: React.ReactNode;
};

export default function Header({ title, subtitle, isAdmin = false, rightContent }: HeaderProps) {
  // React 18推奨の useSyncExternalStore を使用して外部の状態（ネットワーク）と同期
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isOffline = !isOnline;

  // 管理者画面か一般画面かで背景色を変える
  const bgClass = isAdmin ? "bg-theme-adminBg" : "bg-theme-primary";

  return (
    <header className="sticky top-0 z-50 w-full shadow-md">
      {/* オフライン検知時の警告バナー */}
      {isOffline && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-xs md:text-sm font-black animate-pulse flex items-center justify-center gap-2">
          <span role="img" aria-label="warning">⚠️</span>
          <span>通信が切断されています。データが保存されない可能性があります。通信環境を確認してください。</span>
        </div>
      )}

      {/* メインヘッダーコンテンツ */}
      <div className={`${bgClass} text-white p-6 flex flex-col md:flex-row justify-between items-center transition-colors duration-300`}>
        <div className={isAdmin ? "text-left" : "text-center w-full"}>
          <h1 className="text-2xl md:text-3xl font-black tracking-widest">{title}</h1>
          <p className="text-sm font-bold mt-1 opacity-90">{subtitle}</p>
        </div>
        
        {/* 右側にコンテンツ（CSVボタンなど）があれば表示 */}
        {rightContent && (
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
}