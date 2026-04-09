"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

// --- 1. エラーキャッチ専用コンポーネント（Error Boundary） ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 予期せぬ描画エラーが発生した際、コンソールに詳細なログを出力します
    console.error("❌ マニュアルページ描画エラー詳細:");
    console.error("メッセージ:", error.message);
    console.error("スタックトレース:", error.stack);
    console.error("コンポーネントツリー:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // エラー発生時のフォールバックUI（画面全体が真っ白になるのを防ぐ）
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl max-w-lg w-full">
            <h2 className="text-red-700 font-black text-xl mb-2">システムエラーが発生しました</h2>
            <p className="text-red-600 font-bold text-sm mb-4">マニュアルの表示中に問題が発生しました。リロードをお試しください。</p>
            <details className="bg-white p-3 rounded-lg border border-red-100">
              <summary className="text-xs font-bold text-red-500 cursor-pointer outline-none hover:opacity-70">
                エラー詳細を表示（開発者用）
              </summary>
              <pre className="text-[10px] text-red-400 mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                {this.state.error?.stack || this.state.error?.message}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 2. マニュアルページ本体 ---
function ManualContent() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto">
        
        {/* ヘッダー */}
        <header className="mb-8 text-center print:break-inside-avoid print:mb-4">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2 print:text-2xl">
            第１００回 勇気凛々杯争奪弓道大会
          </h1>
          <p className="text-lg font-bold text-slate-500 print:text-sm print:text-slate-800">
            大会当日 運営操作マニュアル
          </p>
          <div className="mt-4 inline-block bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-600 print:shadow-none print:border-slate-400 print:py-1">
            システムURL: <span className="text-blue-600 select-all print:text-slate-800">https://shootingthrough2026-app--shootingthrough2026.asia-east1.hosted.app/</span>
          </div>
        </header>

        {/* 共通注意事項 */}
        <section className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-r-lg shadow-sm print:break-inside-avoid print:shadow-none print:border-slate-400 print:bg-white print:border-2 print:rounded-lg">
          <h2 className="text-lg font-bold text-yellow-800 mb-2 flex items-center gap-2 print:text-slate-900">
            <svg className="w-5 h-5 print:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span className="hidden print:inline mr-1">⚠️</span>
            全スタッフ共通の注意事項
          </h2>
          <ul className="list-disc list-inside text-sm font-medium text-yellow-900 space-y-1 print:text-slate-800">
            <li>管理画面（/admin 以下）へのアクセスには <strong>IDとパスワード</strong> が必要です。（本部より後日共有）</li>
            <li>画面の動きがおかしい、データが反映されない場合は、まず <strong>ブラウザの更新（リロード）</strong> を行ってください。</li>
            <li>操作を間違えた場合は、独断で修正せず、速やかにシステム管理者（本部）へ報告してください。</li>
          </ul>
        </section>

        {/* マニュアル本体のグリッドレイアウト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 print:block print:space-y-4">

          {/* 業務1: 受付担当 */}
          <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:break-inside-avoid print:shadow-none print:border-slate-400 print:p-4">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4 print:border-slate-300 print:mb-2 print:pb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl print:bg-white print:border print:border-slate-400 print:text-slate-900">1</div>
              <h2 className="text-xl font-black text-slate-800">QR受付担当</h2>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4 print:mb-2 print:text-slate-700">対象ページ: <strong>/admin/reception</strong></p>
            <ol className="list-decimal list-inside space-y-3 text-slate-700 text-sm font-medium print:space-y-1">
              <li>メニューから「当日QR受付」を開きます。</li>
              <li>端末に接続された機器の起動許可を求められたら「許可」をタップします。</li>
              <li>参加者が提示するスマホ画面（または印刷物）のQRコードを機材の枠内に映します。</li>
              <li>読み取り成功の画面が表示され、「受付完了」のステータスに変われば処理完了です。</li>
            </ol>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 print:border-slate-300 print:bg-white print:mt-2">
              <span className="font-bold text-red-500 print:text-slate-900">トラブル時:</span> QRが読み取れない場合は、「エントリー・立順管理」から名前検索で手動受付を行ってください。
            </div>
          </article>

          {/* 業務2: 呼び出し担当 */}
          <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:break-inside-avoid print:shadow-none print:border-slate-400 print:p-4">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4 print:border-slate-300 print:mb-2 print:pb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl print:bg-white print:border print:border-slate-400 print:text-slate-900">2</div>
              <h2 className="text-xl font-black text-slate-800">呼び出し担当</h2>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4 print:mb-2 print:text-slate-700">対象ページ: <strong>/admin/calling</strong></p>
            <ol className="list-decimal list-inside space-y-3 text-slate-700 text-sm font-medium print:space-y-1">
              <li>メニューから「選手呼び出し管理」を開きます。</li>
              <li>進行状況に合わせて、対象チームのステータスボタンを順番にタップします。<br />
                <span className="inline-block mt-2 px-2 py-1 bg-slate-100 rounded text-xs print:border print:border-slate-300 print:bg-white">待機</span> → <span className="inline-block px-2 py-1 bg-yellow-100 rounded text-xs print:border print:border-slate-300 print:bg-white">呼出中</span> → <span className="inline-block px-2 py-1 bg-red-100 rounded text-xs print:border print:border-slate-300 print:bg-white">行射中</span>
              </li>
              <li>この操作は会場のディスプレイ（/display）や一般公開用の成績閲覧ページ（LIVE RESULT: /results）にリアルタイムに連動します。操作遅れにご注意ください。</li>
            </ol>
          </article>

          {/* 業務3: 成績入力担当 */}
          <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:break-inside-avoid md:col-span-2 print:shadow-none print:border-slate-400 print:p-4">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4 print:border-slate-300 print:mb-2 print:pb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl print:bg-white print:border print:border-slate-400 print:text-slate-900">3</div>
              <h2 className="text-xl font-black text-slate-800">成績入力担当</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 print:block">
              <div className="print:mb-4">
                <p className="text-sm font-bold text-slate-500 mb-4 print:mb-2 print:text-slate-700">対象ページ: <strong>/admin/input</strong></p>
                <ol className="list-decimal list-inside space-y-3 text-slate-700 text-sm font-medium print:space-y-1">
                  <li>メニューから「大会成績入力」を開きます。</li>
                  <li>立順またはゼッケン番号から対象の選手・チームを検索します。</li>
                  <li>的前からの報告に基づき、各ラウンド（予選・決勝）の的中数（〇・✕ または数値）を正確に入力します。</li>
                  <li>入力後、必ず「保存」ボタンを押下してデータを確定させてください。</li>
                </ol>
              </div>
              <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-sm font-medium flex flex-col justify-center print:bg-white print:border-2 print:border-slate-400 print:text-slate-800">
                <p className="mb-2 text-white font-bold flex items-center gap-2 print:text-slate-900">
                  <svg className="w-5 h-5 text-blue-400 print:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="hidden print:inline mr-1">ℹ️</span>
                  一般公開データとの連動
                </p>
                <p>
                  入力・保存されたデータは、即座に一般公開用の成績閲覧ページ（LIVE RESULT: /results）に反映されます。入力ミスは参加者の混乱を招くため、確定前に再確認をお願いします。
                </p>
              </div>
            </div>
          </article>

        </div>

        {/* フッター */}
        <footer className="mt-12 text-center text-sm font-bold text-slate-400 border-t border-slate-200 pt-6 print:break-inside-avoid print:mt-6 print:pt-4 print:text-slate-600">
          <p>システムトラブル時の緊急連絡先: [ハヤタ 090-7290-9698]</p>
          <p className="mt-2">© 2026 勇気凛々杯争奪弓道大会 Tournament Operation Team.</p>
        </footer>
      </div>
    </div>
  );
}

export default function ManualPage() {
  return (
    <ErrorBoundary>
      <ManualContent />
    </ErrorBoundary>
  );
}