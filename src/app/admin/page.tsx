"use client";

import React, { Component, ErrorInfo, ReactNode, useState, useRef, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, deleteField, doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";

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
    console.error("❌ 描画エラー詳細:");
    console.error("メッセージ:", error.message);
    console.error("スタックトレース:", error.stack);
    console.error("コンポーネントツリー:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
          <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl max-w-lg w-full">
            <h2 className="text-red-700 font-black text-xl mb-2">システムエラーが発生しました</h2>
            <p className="text-red-600 font-bold text-sm mb-4">画面の表示中に問題が発生しました。リロードをお試しください。</p>
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

// --- 2. メニュー項目の定義 ---
const ADMIN_MENUS = [
  {
    id: "entries",
    title: "エントリー・立順管理",
    description: "登録情報の確認・編集、入金承認、立順（ゼッケン）の設定、QR受付票のメール送信を行います。",
    icon: "📋",
    href: "/admin/entries",
    colorClass: "bg-white text-theme-secondary border-2 border-theme-secondary/20 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] hover:border-theme-primary/50 hover:shadow-[0_2px_0_0_rgba(139,21,0,0.2)]",
    iconBg: "bg-theme-bg",
  },
  {
    id: "reception",
    title: "当日QR受付",
    description: "参加者のQRコードを読み取り、スピーディーな受付処理とチェックインを行います。",
    icon: "📱",
    href: "/admin/reception",
    colorClass: "bg-white text-theme-secondary border-2 border-theme-secondary/20 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] hover:border-theme-primary/50 hover:shadow-[0_2px_0_0_rgba(139,21,0,0.2)]",
    iconBg: "bg-theme-bg",
  },
  {
    id: "calling",
    title: "選手呼び出し管理",
    description: "各チーム・選手の待機、呼出中、行射中のステータスを管理し、成績表示ページとリアルタイムに連動させます。",
    icon: "📢",
    href: "/admin/calling",
    colorClass: "bg-white text-theme-secondary border-2 border-theme-secondary/20 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] hover:border-theme-primary/50 hover:shadow-[0_2px_0_0_rgba(139,21,0,0.2)]",
    iconBg: "bg-theme-bg",
  },
  {
    id: "input",
    title: "大会成績入力",
    description: "予選・決勝の的中数を入力します。個人の重複通過判定なども自動で計算・反映されます。",
    icon: "🎯",
    href: "/admin/input",
    colorClass: "bg-white text-theme-secondary border-2 border-theme-secondary/20 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] hover:border-theme-primary/50 hover:shadow-[0_2px_0_0_rgba(139,21,0,0.2)]",
    iconBg: "bg-theme-bg",
  },
];

const CSV_BASE_HEADER = "部門,種別,チーム名,担当者名,電話番号,メールアドレス,ゼッケン,ポジション,名前,ふりがな,性別,段位,シニア,備考";

// --- 3. ダッシュボードの中身（UI） ---
function AdminDashboardContent() {
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deleteModalType, setDeleteModalType] = useState<"results" | "participants" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tickerMessage, setTickerMessage] = useState("");
  const [currentTicker, setCurrentTicker] = useState("");
  const [isUpdatingTicker, setIsUpdatingTicker] = useState(false);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const tickerRef = doc(db, "settings", "ticker");
    const unsubscribe = onSnapshot(tickerRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentTicker(docSnap.data().message || "");
      }
    }, (error) => {
      console.error("❌ ティッカー取得エラー:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateTicker = async (messageToSet: string) => {
    setIsUpdatingTicker(true);
    try {
      const tickerRef = doc(db, "settings", "ticker");
      await updateDoc(tickerRef, { message: messageToSet }).catch(async (error) => {
        if (error.code === 'not-found') {
          await setDoc(tickerRef, { message: messageToSet });
        } else {
          throw error;
        }
      });
      showToast(messageToSet ? "お知らせを配信しました" : "お知らせの配信を停止しました", "success");
      setTickerMessage("");
    } catch (error: any) {
      console.error("❌ ティッカー更新エラー:", error.message, error.stack);
      showToast("お知らせの更新に失敗しました", "error");
    } finally {
      setIsUpdatingTicker(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const snapshot = await getDocs(collection(db, "participants"));
      if (snapshot.empty) {
        showToast("出力するデータがありません。", "error");
        return;
      }

      const exportHeader = `${CSV_BASE_HEADER},予選,決勝,受付完了`;
      const rows: string[] = [exportHeader];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const b = data.basic_info || {};
        const a = data.applicant_info || {};
        const r = data.results || {};
        const s = data.status || {};
        
        const escapeCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

        const row = [
          escapeCSV(b.division),
          escapeCSV(b.entry_type === "team" ? "団体" : "個人"),
          escapeCSV(b.team_name),
          escapeCSV(a.name),
          escapeCSV(a.phone),
          escapeCSV(a.email),
          escapeCSV(b.bib_number),
          escapeCSV(b.position),
          escapeCSV(b.name),
          escapeCSV(b.nameKana),
          escapeCSV(b.gender),
          escapeCSV(b.rank),
          b.isSenior ? "TRUE" : "FALSE",
          escapeCSV(data.notes),
          r.yosen ?? "",
          r.kessho ?? "",
          s.is_checked_in ? "TRUE" : "FALSE"
        ];
        rows.push(row.join(","));
      });

      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const blob = new Blob([bom, rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `大会データ_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      showToast("CSVデータの出力が完了しました", "success");
    } catch (error: any) {
      console.error("❌ エクスポートエラー:", error.message, error.stack);
      showToast("出力に失敗しました", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const exampleRow = "団体の部（男子）,団体,弓道クラブ,山田太郎,090-0000-0000,test@example.com,101,大前,山田次郎,やまだじろう,男性,参段,FALSE,代理入力分";
    const blob = new Blob([bom, `${CSV_BASE_HEADER}\n${exampleRow}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "参加者インポート用フォーマット.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) throw new Error("データがありません。");

      const parsedData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        parsedData.push(values.map(v => v.replace(/^"|"$/g, '').trim()));
      }

      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;
      const groupMap = new Map<string, string>();

      parsedData.forEach(cols => {
        if (cols.length < 13) return;

        const division = cols[0];
        const entryType = cols[1] === "団体" ? "team" : "individual";
        const teamName = cols[2] || "";
        const applicantName = cols[3] || "";
        
        const groupKey = `${division}-${entryType}-${teamName}-${applicantName}`;
        let groupId = groupMap.get(groupKey);
        if (!groupId) {
          groupId = `csv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          groupMap.set(groupKey, groupId);
        }

        const newDocRef = doc(collection(db, "participants"));
        const participantData = {
          entry_group_id: groupId,
          applicant_info: { name: applicantName, phone: cols[4] || "", email: cols[5] || "" },
          basic_info: {
            division: division,
            entry_type: entryType,
            team_name: teamName,
            bib_number: cols[6] || "",
            position: cols[7] || "",
            name: cols[8] || "",
            nameKana: cols[9] || "",
            gender: cols[10] || "",
            rank: cols[11] || "無指定",
            isSenior: cols[12]?.toUpperCase() === "TRUE",
          },
          payment_info: { status: "approved", proof_url: "" },
          notes: cols[13] || "",
          status: { is_checked_in: false }
        };

        currentBatch.set(newDocRef, participantData);
        count++;

        if (count === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      });

      if (count > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      showToast(`${parsedData.length}件のデータをインポートしました`, "success");

    } catch (error: any) {
      console.error("❌ インポートエラー詳細:", error.message, error.stack);
      showToast("CSVの読み込みに失敗しました。フォーマットを確認してください。", "error");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteModalType(null);
    setConfirmText("");
  };

  const handleExecuteDelete = async () => {
    if (confirmText !== "削除します") return;
    setIsDeleting(true);

    try {
      const participantsRef = collection(db, "participants");
      const snapshot = await getDocs(participantsRef);

      if (snapshot.empty) {
        showToast("対象となるデータがありません。", "error");
        closeDeleteModal();
        setIsDeleting(false);
        return;
      }

      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        if (deleteModalType === "results") {
          currentBatch.update(docSnap.ref, { results: deleteField() });
        } else if (deleteModalType === "participants") {
          currentBatch.delete(docSnap.ref);
        }

        count++;
        if (count === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      });

      if (count > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);

      if (deleteModalType === "results") {
        showToast("すべての成績データを削除しました。", "success");
      } else {
        showToast("すべての参加者データを削除しました。", "success");
      }
    } catch (error: any) {
      console.error("❌ データ削除エラー詳細:", error.message, error.stack);
      showToast("データの削除に失敗しました。通信環境を確認してください。", "error");
    } finally {
      setIsDeleting(false);
      closeDeleteModal();
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-20 relative">
      <Header title="ADMIN" subtitle="管理者ダッシュボード" isAdmin={true} />

      <main className="max-w-[1200px] mx-auto mt-8 px-4 md:px-8">
        
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border-2 border-theme-secondary/10 mb-10 animate-fade-in-up">
          <h2 className="text-xl md:text-2xl font-black text-theme-secondary mb-2">
            大会運営ポータルサイトへようこそ
          </h2>
          <p className="font-bold text-theme-secondary/70 text-sm md:text-base leading-relaxed">
            大会役員専用の管理画面です。<br className="md:hidden" />
            以下のメニューから各業務のページへアクセスしてください。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {ADMIN_MENUS.map((menu) => (
            <Link 
              key={menu.id} 
              href={menu.href}
              className={`group block p-6 rounded-3xl transition-all duration-200 hover:-translate-y-1 ${menu.colorClass}`}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110 ${menu.iconBg}`}>
                    {menu.icon}
                  </div>
                  <h3 className="text-xl font-black leading-tight text-theme-primary">
                    {menu.title}
                  </h3>
                </div>
                
                <p className="text-sm font-bold flex-grow text-theme-secondary/70">
                  {menu.description}
                </p>
                
                <div className="mt-6 flex justify-end">
                  <span className="text-sm font-black flex items-center gap-1 transition-transform group-hover:translate-x-1 text-theme-primary">
                    アクセスする <span>→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="animate-fade-in-up mb-16" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] flex-1 bg-theme-secondary/10"></div>
            <h2 className="text-theme-secondary font-black flex items-center gap-2">
              <span>📢</span> お知らせ配信
            </h2>
            <div className="h-[2px] flex-1 bg-theme-secondary/10"></div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border-2 border-theme-secondary/10">
            <div className="mb-6">
              <span className="block text-sm font-bold text-theme-secondary/60 mb-2">現在配信中のお知らせ</span>
              {currentTicker ? (
                <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-xl text-yellow-900 font-bold break-all">
                  {currentTicker}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 font-bold">
                  現在配信中のお知らせはありません
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={tickerMessage}
                onChange={(e) => setTickerMessage(e.target.value)}
                placeholder="配信するメッセージを入力..."
                className="flex-1 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-theme-primary outline-none font-bold"
                disabled={isUpdatingTicker}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateTicker(tickerMessage)}
                  disabled={!tickerMessage.trim() || isUpdatingTicker}
                  className="px-6 py-4 bg-theme-primary text-white font-black rounded-xl shadow-[0_4px_0_0_rgba(139,21,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(139,21,0,1)] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none whitespace-nowrap"
                >
                  配信する
                </button>
                <button
                  onClick={() => handleUpdateTicker("")}
                  disabled={!currentTicker || isUpdatingTicker}
                  className="px-6 py-4 bg-white text-red-500 border-2 border-red-200 font-black rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  配信停止
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-in-up mb-16" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] flex-1 bg-theme-secondary/10"></div>
            <h2 className="text-theme-secondary font-black flex items-center gap-2">
              <span>🗄️</span> データ入出力
            </h2>
            <div className="h-[2px] flex-1 bg-theme-secondary/10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border-2 border-theme-secondary/10 flex flex-col justify-between shadow-[0_4px_0_0_rgba(80,35,20,0.05)]">
              <div>
                <h3 className="font-black text-theme-primary text-lg mb-2 flex items-center gap-2">
                  <span>📥</span> CSVエクスポート
                </h3>
                <p className="text-xs font-bold text-theme-secondary/60 mb-6 leading-relaxed">
                  データベース上の全参加者データをExcelで開けるCSV形式でダウンロードします。大会終了後のバックアップや成績の集計・印刷に利用してください。
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="w-full py-3 bg-white text-theme-secondary border-2 border-theme-secondary/20 font-black rounded-xl hover:bg-theme-secondary/5 transition-colors disabled:opacity-50"
              >
                {isExporting ? "出力中..." : "データをダウンロード"}
              </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border-2 border-theme-secondary/10 flex flex-col justify-between shadow-[0_4px_0_0_rgba(80,35,20,0.05)]">
              <div>
                <h3 className="font-black text-[#D35400] text-lg mb-2 flex items-center gap-2">
                  <span>📤</span> CSVインポート
                </h3>
                <p className="text-xs font-bold text-theme-secondary/60 mb-4 leading-relaxed">
                  Web申込みができない方のデータを一括で代理登録します。必ず専用のフォーマット（ひな形）を使用してアップロードしてください。
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs font-bold text-theme-primary underline hover:opacity-70 mb-4 inline-block"
                >
                  専用フォーマット（ひな形）をダウンロード
                </button>
              </div>
              
              <div>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleImportCSV}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className={`w-full py-3 bg-theme-accent text-white font-black rounded-xl shadow-[0_4px_0_0_rgba(200,100,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(200,100,0,1)] transition-all flex items-center justify-center gap-2 cursor-pointer ${isImporting ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {isImporting ? "読込中..." : "CSVファイルを選択して登録"}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] flex-1 bg-red-200"></div>
            <h2 className="text-red-600 font-black flex items-center gap-2">
              <span>⚠️</span> データ削除
            </h2>
            <div className="h-[2px] flex-1 bg-red-200"></div>
          </div>

          <div className="bg-red-50/50 border-2 border-red-200 rounded-3xl p-6 md:p-8 space-y-6">
            <p className="text-sm font-bold text-red-600/80 mb-2">
              以下の操作は取り消すことができません。大会の終了後や、テスト環境のリセット時のみ使用してください。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border-2 border-red-100 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-red-700 text-lg mb-2">成績データのみ削除</h3>
                  <p className="text-xs font-bold text-theme-secondary/60 mb-4">
                    参加者情報は残したまま、予選・決勝で入力した全選手の「成績（的中数）」だけを空（リセット）にします。
                  </p>
                </div>
                <button
                  onClick={() => setDeleteModalType("results")}
                  className="w-full py-3 bg-white text-red-600 font-bold border-2 border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  成績データをリセット
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-red-200 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-red-700 text-lg mb-2">参加者データを全削除</h3>
                  <p className="text-xs font-bold text-theme-secondary/60 mb-4">
                    データベースからすべてのエントリー（参加者）情報を完全に削除します。この操作は復元できません。
                  </p>
                </div>
                <button
                  onClick={() => setDeleteModalType("participants")}
                  className="w-full py-3 bg-red-600 text-white font-black rounded-xl shadow-[0_4px_0_0_rgba(185,28,28,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(185,28,28,1)] transition-all"
                >
                  全データを削除
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>

      {deleteModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border-4 border-red-100">
            <div className="bg-red-50 p-6 border-b border-red-100">
              <h3 className="text-xl font-black text-red-700 flex items-center gap-2">
                <span>⚠️</span> 最終確認
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="font-bold text-theme-secondary">
                {deleteModalType === "results"
                  ? "すべての「成績データ」をリセットします。参加者情報は保持されます。"
                  : "データベースから「すべての参加者データ」を完全に削除します。"}
              </p>
              <p className="text-sm font-bold text-red-600">
                この操作は取り消すことができません。実行する場合は、以下の入力欄に「<strong>削除します</strong>」と入力してください。
              </p>

              <input
                type="text"
                placeholder="削除します"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-red-400 outline-none font-bold text-center mt-2"
                disabled={isDeleting}
              />
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="px-6 py-2.5 font-bold text-theme-secondary/60 bg-white border-2 border-gray-200 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={confirmText !== "削除します" || isDeleting}
                className="px-6 py-2.5 font-black text-white bg-red-600 rounded-xl shadow-[0_4px_0_0_rgba(185,28,28,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(185,28,28,1)] transition-all disabled:bg-red-300 disabled:shadow-none disabled:translate-y-[4px]"
              >
                {isDeleting ? "処理中..." : "完全に削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ErrorBoundary>
      <AdminDashboardContent />
    </ErrorBoundary>
  );
}