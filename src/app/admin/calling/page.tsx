"use client";

import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, writeBatch } from "firebase/firestore";

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

// --- 2. 型定義 ---
type CallStatus = "waiting" | "calling" | "shooting";

type ParticipantDoc = {
  id: string;
  entry_group_id?: string;
  basic_info?: {
    bib_number: string;
    position: string;
    entry_type: "individual" | "team";
    division: string;
    nameKana: string;
    name: string;
    isSenior: boolean;
    gender: string;
    rank: string;
    team_name: string;
  };
  payment_info?: { status: "pending" | "approved" };
  status?: {
    is_checked_in?: boolean;
    qr_sent_at?: any;
    call_status?: CallStatus;
    is_withdrawn?: boolean; // 🌟 追加: 棄権フラグ
  };
};

type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  payment_status: string;
  members: ParticipantDoc[];
};

const SUB_TABS = [
  { id: "団体の部（男子）", label: "団体 男子", icon: "👥" },
  { id: "団体の部（女子）", label: "団体 女子", icon: "👥" },
  { id: "個人の部（男子）", label: "個人 男子", icon: "👤" },
  { id: "個人の部（女子）", label: "個人 女子", icon: "👤" },
  { id: "個人の部（シニア）", label: "個人 シニア", icon: "🏅" },
];

// --- 3. メインコンポーネント ---
function AdminCallingContent() {
  const [activeTab, setActiveTab] = useState<string>("団体の部（男子）");
  const [groupedEntries, setGroupedEntries] = useState<EntryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 一括操作用の選択状態管理（チェックボックス用）
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    setSelectedGroupIds([]);
  }, [activeTab]);

  // データ取得ロジック
  useEffect(() => {
    const participantsRef = collection(db, "participants");
    
    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        try {
          const rawData: ParticipantDoc[] = [];
          snapshot.forEach((docSnap) => {
            rawData.push({ id: docSnap.id, ...docSnap.data() } as ParticipantDoc);
          });

          const groupsMap = new Map<string, EntryGroup>();

          rawData.forEach((item) => {
            if (!item.basic_info || !item.basic_info.bib_number || item.payment_info?.status !== "approved") return;

            const groupId = item.entry_group_id || `fallback-group-${item.id}`;

            if (!groupsMap.has(groupId)) {
              groupsMap.set(groupId, {
                entry_group_id: groupId,
                entry_type: item.basic_info.entry_type || "individual",
                team_name: item.basic_info.team_name || "名称未設定",
                division: item.basic_info.division || "未分類",
                payment_status: item.payment_info?.status || "pending",
                members: [],
              });
            }
            groupsMap.get(groupId)?.members.push(item);
          });

          const groupsArray = Array.from(groupsMap.values());
          
          groupsArray.forEach((group) => {
            group.members.sort((a, b) => {
              const order = { "大前": 1, "中": 2, "落": 3, "個人": 1 };
              const posA = a.basic_info?.position as keyof typeof order;
              const posB = b.basic_info?.position as keyof typeof order;
              return (order[posA] || 99) - (order[posB] || 99);
            });
          });

          groupsArray.sort((a, b) => {
            const bibA = a.members[0]?.basic_info?.bib_number || "";
            const bibB = b.members[0]?.basic_info?.bib_number || "";
            const numA = parseInt(bibA, 10);
            const numB = parseInt(bibB, 10);
            
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (bibA && bibB) return bibA.localeCompare(bibB);
            return 0;
          });

          setGroupedEntries(groupsArray);
          setIsLoading(false);

        } catch (error) {
          const err = error as Error;
          console.error("❌ データマッピングエラー:", err.message, err.stack);
          showToast("データの解析中にエラーが発生しました", "error");
          setIsLoading(false);
        }
      },
      (error) => {
        const err = error as Error;
        console.error("❌ Firestoreリアルタイム取得エラー:", err.message);
        showToast("データの取得に失敗しました", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --- データの4つ切り分け（チャンク化）ロジック ---
  // 🌟 棄権しているチームも除外せずにそのまま含めてフィルタリング
  const targetGroups = groupedEntries.filter(g => g.division === activeTab);
  const CHUNK_SIZE = 4;
  const chunkedGroups: EntryGroup[][] = [];
  for (let i = 0; i < targetGroups.length; i += CHUNK_SIZE) {
    chunkedGroups.push(targetGroups.slice(i, i + CHUNK_SIZE));
  }

  // --- ステータス更新ロジック ---

  // ① 4チーム（チャンク）全体の一括更新
  const handleUpdateChunkStatus = async (chunk: EntryGroup[], newStatus: CallStatus) => {
    try {
      const batch = writeBatch(db);
      let updateCount = 0;

      chunk.forEach(group => {
        group.members.forEach(member => {
          // 🌟 修正: 棄権しているメンバーはステータス更新の対象外とする（フェイルセーフ）
          if (member.status?.is_withdrawn) return;

          const memberRef = doc(db, "participants", member.id);
          batch.update(memberRef, { "status.call_status": newStatus });
          updateCount++;
        });
      });

      if (updateCount === 0) {
        showToast("更新可能な選手がいません（すべて棄権等）", "error");
        return;
      }

      await batch.commit();
      
      const statusText = newStatus === "calling" ? "呼出中" : newStatus === "shooting" ? "行射中" : "待機";
      showToast(`対象のチームを【${statusText}】に変更しました`, "success");
    } catch (error) {
      const err = error as Error;
      console.error("❌ チャンクステータス更新エラー:", err.message, err.stack);
      showToast("ステータスの更新に失敗しました", "error");
    }
  };

  // ② 選択した複数チーム（任意の数）の更新（スティッキーヘッダー用）
  const handleBulkUpdateStatus = async (newStatus: CallStatus) => {
    if (selectedGroupIds.length === 0) return;
    setIsBulkUpdating(true);
    
    try {
      const batch = writeBatch(db);
      const groupsToUpdate = targetGroups.filter(g => selectedGroupIds.includes(g.entry_group_id));
      let updateCount = 0;
      
      groupsToUpdate.forEach(group => {
        group.members.forEach(member => {
          // 🌟 修正: 棄権しているメンバーは一括操作でも更新しない
          if (member.status?.is_withdrawn) return;

          const memberRef = doc(db, "participants", member.id);
          batch.update(memberRef, { "status.call_status": newStatus });
          updateCount++;
        });
      });

      if (updateCount > 0) {
        await batch.commit();
        const statusText = newStatus === "calling" ? "呼出中" : newStatus === "shooting" ? "行射中" : "待機";
        showToast(`選択したチームを【${statusText}】に一括変更しました`, "success");
      } else {
        showToast("更新可能な選手がいませんでした", "error");
      }
      
      setSelectedGroupIds([]);
    } catch (error) {
      const err = error as Error;
      console.error("❌ 一括ステータス更新エラー:", err.message, err.stack);
      showToast("一括更新に失敗しました。通信環境を確認してください。", "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // --- 選択操作ロジック ---
  const toggleChunkSelection = (chunk: EntryGroup[]) => {
    const chunkIds = chunk.map(g => g.entry_group_id);
    const isAllSelected = chunkIds.every(id => selectedGroupIds.includes(id));

    if (isAllSelected) {
      setSelectedGroupIds(prev => prev.filter(id => !chunkIds.includes(id)));
    } else {
      setSelectedGroupIds(prev => {
        const newSet = new Set([...prev, ...chunkIds]);
        return Array.from(newSet);
      });
    }
  };

  // --- UIコンポーネント ---
  const StatusButtonGroup = ({ 
    currentStatus, 
    onStatusChange,
    disabled = false // 🌟 追加: 無効化制御プロパティ
  }: { 
    currentStatus: CallStatus, 
    onStatusChange: (status: CallStatus) => void,
    disabled?: boolean
  }) => {
    return (
      <div className={`flex bg-gray-100 p-1.5 rounded-xl shadow-inner ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
        <button
          onClick={() => !disabled && onStatusChange("waiting")}
          disabled={disabled}
          className={`px-3 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
            currentStatus === "waiting" 
              ? "bg-white text-gray-700 shadow-sm" 
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          待機
        </button>
        <button
          onClick={() => !disabled && onStatusChange("calling")}
          disabled={disabled}
          className={`px-3 py-1.5 md:py-2 text-xs font-black rounded-lg transition-all ${
            currentStatus === "calling" 
              ? "bg-yellow-400 text-yellow-900 shadow-md animate-pulse" 
              : "text-gray-400 hover:text-yellow-600"
          }`}
        >
          📢 呼出中
        </button>
        <button
          onClick={() => !disabled && onStatusChange("shooting")}
          disabled={disabled}
          className={`px-3 py-1.5 md:py-2 text-xs font-black rounded-lg transition-all ${
            currentStatus === "shooting" 
              ? "bg-theme-primary text-white shadow-md" 
              : "text-gray-400 hover:text-theme-primary"
          }`}
        >
          🎯 行射中
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-40">
      <Header title="大会管理ページ" subtitle="選手呼び出し管理" isAdmin={true} />

      <main className="max-w-[1200px] mx-auto mt-8 px-4 md:px-8 relative">
        
        {/* 操作説明メッセージ */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border-2 border-theme-secondary/10 mb-6 animate-fade-in-up">
          <p className="font-bold text-theme-secondary/80 flex items-start gap-2 text-sm px-2">
            <span className="text-lg">💡</span>
            <span>
              <strong>【4チーム一括コントロール機能】</strong><br/>
              立順の小さい方から4チームずつカードにまとめて表示しています。右上のパネルを押すことで、その枠内のチーム全体を一気に進行させることができます。（※棄権したチームは自動的にスキップされます）
            </span>
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-theme-secondary text-white shadow-md"
                  : "bg-white border-2 border-theme-secondary/10 text-theme-secondary/60 hover:bg-theme-secondary/5"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 🌟 画面上部に追従する一括操作パネル（Sticky Header） */}
        <div className="sticky top-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-lg border-2 border-theme-secondary/20 mb-8 flex flex-col lg:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <span className={`font-black px-4 py-2 rounded-xl transition-colors ${selectedGroupIds.length > 0 ? "bg-theme-primary/10 text-theme-primary border border-theme-primary/30" : "bg-gray-100 text-gray-400 border border-gray-200"}`}>
              {selectedGroupIds.length} チーム選択中
            </span>
            {selectedGroupIds.length > 0 && (
              <button 
                onClick={() => setSelectedGroupIds([])} 
                className="text-sm font-bold text-gray-500 hover:text-gray-800 px-2 underline"
              >
                選択解除
              </button>
            )}
          </div>
          
          <div className="flex bg-gray-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto">
            <div className="text-[10px] font-bold text-gray-400 px-3 flex items-center whitespace-nowrap">
              選択したチームを変更 👉
            </div>
            <button
              onClick={() => handleBulkUpdateStatus("waiting")}
              disabled={selectedGroupIds.length === 0 || isBulkUpdating}
              className="px-4 py-2 text-sm font-bold rounded-lg text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all whitespace-nowrap"
            >
              待機に戻す
            </button>
            <button
              onClick={() => handleBulkUpdateStatus("calling")}
              disabled={selectedGroupIds.length === 0 || isBulkUpdating}
              className="px-4 py-2 text-sm font-black rounded-lg text-yellow-700 hover:bg-yellow-400 hover:shadow-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all whitespace-nowrap"
            >
              📢 呼出中
            </button>
            <button
              onClick={() => handleBulkUpdateStatus("shooting")}
              disabled={selectedGroupIds.length === 0 || isBulkUpdating}
              className="px-4 py-2 text-sm font-black rounded-lg text-theme-primary hover:bg-theme-primary hover:text-white hover:shadow-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-theme-primary disabled:hover:shadow-none transition-all whitespace-nowrap"
            >
              🎯 行射中
            </button>
          </div>
        </div>

        {/* チャンク（4チームの塊）リスト表示 */}
        {isLoading ? (
          <div className="text-center py-20 font-bold text-xl animate-pulse">データを読み込み中...</div>
        ) : (
          <div className="space-y-6">
            {chunkedGroups.length > 0 ? (
              chunkedGroups.map((chunk, chunkIndex) => {
                
                // チャンク内の全体ステータスを判定
                let chunkOverallStatus: CallStatus = "waiting";
                const isAnyShooting = chunk.some(g => g.members.some(m => !m.status?.is_withdrawn && m.status?.call_status === "shooting"));
                const isAnyCalling = chunk.some(g => g.members.some(m => !m.status?.is_withdrawn && m.status?.call_status === "calling"));
                
                if (isAnyShooting) chunkOverallStatus = "shooting";
                else if (isAnyCalling) chunkOverallStatus = "calling";

                const chunkIds = chunk.map(g => g.entry_group_id);
                const isAllSelected = chunkIds.every(id => selectedGroupIds.includes(id));
                
                // 🌟 修正: チャンク全体が棄権しているかどうかの判定
                const isChunkAllWithdrawn = chunk.every(g => g.members.every(m => m.status?.is_withdrawn));

                let cardClass = "bg-white border-theme-secondary/10 shadow-[0_4px_0_0_rgba(80,35,20,0.05)] hover:border-theme-secondary/30";
                if (isChunkAllWithdrawn) {
                  cardClass = "bg-gray-50 border-gray-200 opacity-80"; // チャンク全体が棄権の場合はグレーアウト
                } else if (isAllSelected) {
                  cardClass = "bg-[#8B1500]/5 border-[#8B1500] shadow-[0_4px_15px_rgba(139,21,0,0.15)] transform scale-[1.01]";
                } else if (chunkOverallStatus === "calling") {
                  cardClass = "bg-white border-yellow-400 shadow-[0_4px_0_0_rgba(250,204,21,0.2)]";
                } else if (chunkOverallStatus === "shooting") {
                  cardClass = "bg-white border-theme-primary/60 shadow-[0_4px_0_0_rgba(139,21,0,0.1)]";
                }

                const startBib = chunk[0].members[0].basic_info?.bib_number;
                const endBib = chunk[chunk.length - 1].members[0].basic_info?.bib_number;
                const bibRangeText = startBib === endBib ? `立順 ${startBib}` : `立順 ${startBib} 〜 ${endBib}`;

                return (
                  <div key={`chunk-${chunkIndex}`} className={`p-4 md:p-5 rounded-3xl border-2 transition-all duration-200 ${cardClass}`}>
                    
                    {/* カード上部：操作パネル */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-theme-secondary/10 pb-4 mb-4 gap-4">
                      
                      <div className="flex items-center gap-3">
                        <label className={`relative flex items-center p-2 rounded-full transition-colors ${isChunkAllWithdrawn ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-theme-secondary/5"}`}>
                          <input 
                            type="checkbox" 
                            checked={isAllSelected}
                            onChange={() => toggleChunkSelection(chunk)}
                            disabled={isChunkAllWithdrawn}
                            className="peer sr-only"
                          />
                          <div className="w-8 h-8 rounded-xl border-2 border-theme-secondary/30 bg-white peer-checked:bg-theme-primary peer-checked:border-theme-primary transition-all flex items-center justify-center shadow-inner">
                            {isAllSelected && (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                              </svg>
                            )}
                          </div>
                        </label>
                        <div>
                          <p className="text-[10px] font-bold text-theme-secondary/60">第 {chunkIndex + 1} グループ</p>
                          <h3 className={`text-xl font-black ${isChunkAllWithdrawn ? "text-gray-400" : "text-theme-secondary"}`}>{bibRangeText}</h3>
                        </div>
                      </div>

                      {/* このチャンク専用の4チーム一括変更ボタン */}
                      <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                        <span className="text-[10px] font-bold text-theme-secondary/60 mb-1 pl-2 md:pl-0">▼ この4チームを一括変更</span>
                        <StatusButtonGroup 
                          currentStatus={chunkOverallStatus} 
                          onStatusChange={(newStatus) => handleUpdateChunkStatus(chunk, newStatus)} 
                          disabled={isChunkAllWithdrawn}
                        />
                      </div>
                    </div>

                    {/* カード下部：4チームのコンパクトグリッド表示 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {chunk.map(group => {
                        const name = group.entry_type === "team" ? group.team_name : group.members[0].basic_info?.name;
                        const bib = group.members[0].basic_info?.bib_number;
                        const isCheckedIn = group.members.every(m => m.status?.is_checked_in);
                        // 🌟 修正: 個別チームの棄権判定
                        const isGroupWithdrawn = group.members.every(m => m.status?.is_withdrawn);
                        const groupCallStatus = group.members[0].status?.call_status;
                        
                        // 🌟 修正: 棄権時はグレーアウトを適用
                        const innerClass = isGroupWithdrawn
                          ? "border-gray-200 bg-gray-100/70 opacity-80"
                          : groupCallStatus === "calling" ? "border-yellow-400 bg-yellow-50"
                          : groupCallStatus === "shooting" ? "border-theme-primary/50 bg-theme-primary/5"
                          : "border-theme-secondary/10 bg-theme-bg/30";

                        return (
                          <div key={group.entry_group_id} className={`flex items-center justify-between p-3 rounded-xl border ${innerClass}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className={`text-sm font-black px-2 py-1 rounded shadow-sm min-w-[36px] text-center border ${isGroupWithdrawn ? "bg-gray-200 text-gray-400 border-gray-300" : "text-theme-primary bg-white border-theme-secondary/10"}`}>
                                {bib}
                              </span>
                              {/* 🌟 修正: 棄権時は取り消し線とバッジを追加 */}
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold truncate ${isGroupWithdrawn ? "text-gray-400 line-through" : "text-theme-secondary"}`} title={name}>
                                  {name}
                                </span>
                                {isGroupWithdrawn && (
                                  <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1 py-0.5 rounded w-fit mt-0.5">
                                    棄権
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {!isCheckedIn && !isGroupWithdrawn && (
                              <span className="text-[10px] text-red-500 font-bold border border-red-200 bg-red-50 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                未受付
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-theme-secondary/20 font-bold text-theme-secondary/60">
                該当する部門のデータがありません。<br/>（立順が振られていない、または入金が未承認の可能性があります）
              </div>
            )}
          </div>
        )}
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}

export default function AdminCallingPage() {
  return (
    <ErrorBoundary>
      <AdminCallingContent />
    </ErrorBoundary>
  );
}