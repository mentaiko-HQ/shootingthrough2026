"use client";

import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef } from "react";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, writeBatch, updateDoc } from "firebase/firestore";

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
    is_withdrawn?: boolean;
    is_substituted?: boolean;
  };
  notes?: string;
};

type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  is_checked_in: boolean;
  members: ParticipantDoc[];
};

type ScanState = "waiting" | "success" | "duplicate" | "error";

// --- 3. メインコンポーネント ---
function AdminReceptionContent() {
  const [groupedEntries, setGroupedEntries] = useState<EntryGroup[]>([]);
  const [activeTab, setActiveTab] = useState<"unregistered" | "registered">("unregistered");
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // QRスキャン用ステート
  const [scanState, setScanState] = useState<ScanState>("waiting");
  const [scanMessage, setScanMessage] = useState("QRコードリーダーで参加者の受付票をスキャンしてください。");
  const [scannedGroupName, setScannedGroupName] = useState<string | null>(null);

  // 選手変更モーダル用ステート
  const [subModal, setSubModal] = useState<{
    isOpen: boolean;
    memberId: string;
    currentName: string;
    newName: string;
    newNameKana: string;
  }>({ isOpen: false, memberId: "", currentName: "", newName: "", newNameKana: "" });

  const groupedEntriesRef = useRef<EntryGroup[]>([]);
  const isProcessingRef = useRef(false);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

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
                is_checked_in: true,
                members: [],
              });
            }
            groupsMap.get(groupId)?.members.push(item);
          });

          const groupsArray = Array.from(groupsMap.values());
          
          groupsArray.forEach((group) => {
            group.is_checked_in = group.members.every(m => m.status?.is_checked_in === true);
            
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
          groupedEntriesRef.current = groupsArray;
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

  // QRスキャン監視ロジック
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (subModal.isOpen || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) buffer = "";
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (buffer.length > 0) {
          e.preventDefault();
          processScannedCode(buffer);
          buffer = "";
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [subModal.isOpen]);

  const processScannedCode = async (scannedId: string) => {
    if (isProcessingRef.current) return;
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    const groups = groupedEntriesRef.current;
    const targetGroup = groups.find(g => g.entry_group_id === scannedId);

    if (!targetGroup) {
      setScanState("error");
      setScannedGroupName("該当データなし");
      setScanMessage("無効なQRコードです。手動受付で名前を検索してください。");
      resetScanUI();
      return;
    }

    const name = targetGroup.entry_type === "team" ? targetGroup.team_name : targetGroup.members[0].basic_info?.name || "不明";

    if (targetGroup.is_checked_in) {
      setScanState("duplicate");
      setScannedGroupName(name);
      setScanMessage("このQRコードは既に受付処理が完了しています。");
      resetScanUI();
      return;
    }

    setScanState("success");
    setScannedGroupName(name);
    setScanMessage("受付が完了しました！");
    
    await handleManualCheckIn(targetGroup, true, true);
    resetScanUI();
  };

  const resetScanUI = () => {
    scanTimeoutRef.current = setTimeout(() => {
      setScanState("waiting");
      setScannedGroupName(null);
      setScanMessage("QRコードリーダーで参加者の受付票をスキャンしてください。");
    }, 4000);
  };

  // 受付状態の更新（手動・自動共通）
  const handleManualCheckIn = async (group: EntryGroup, statusToSet: boolean, isFromScanner: boolean = false) => {
    if (isProcessing) return;
    setIsProcessing(true);
    isProcessingRef.current = true;

    try {
      const batch = writeBatch(db);
      group.members.forEach((member) => {
        const memberRef = doc(db, "participants", member.id);
        batch.update(memberRef, { "status.is_checked_in": statusToSet });
      });
      await batch.commit();

      const name = group.entry_type === "team" ? group.team_name : group.members[0].basic_info?.name;
      if (!isFromScanner) {
        const message = statusToSet ? `${name} の受付を完了しました` : `${name} の受付を取り消しました`;
        showToast(message, "success");
      }
    } catch (error) {
      const err = error as Error;
      console.error("❌ 受付ステータス更新エラー:", err.message, err.stack);
      if (isFromScanner) {
        setScanState("error");
        setScanMessage("データベースの更新に失敗しました。通信環境を確認してください。");
      } else {
        showToast("処理に失敗しました", "error");
      }
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  // グループ単位での棄権一括トグル更新
  const handleToggleGroupWithdraw = async (group: EntryGroup, currentIsWithdrawn: boolean) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      group.members.forEach((member) => {
        const memberRef = doc(db, "participants", member.id);
        batch.update(memberRef, { "status.is_withdrawn": !currentIsWithdrawn });
      });
      await batch.commit();

      const name = group.entry_type === "team" ? group.team_name : group.members[0].basic_info?.name;
      showToast(`${name} を ${!currentIsWithdrawn ? "棄権" : "棄権取消"} に設定しました`, "success");
    } catch (error) {
      console.error("❌ 棄権ステータス更新エラー:", error);
      showToast("ステータスの更新に失敗しました", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // 選手変更処理
  const handleSubstituteMember = async () => {
    if (!subModal.newName.trim()) {
      showToast("新しい名前を入力してください", "error");
      return;
    }
    
    setIsProcessing(true);
    try {
      const memberRef = doc(db, "participants", subModal.memberId);
      
      const targetGroup = groupedEntries.find(g => g.members.some(m => m.id === subModal.memberId));
      const targetMember = targetGroup?.members.find(m => m.id === subModal.memberId);
      const currentNotes = targetMember?.notes || "";
      const historyNote = `\n[選手変更] ${subModal.currentName} → ${subModal.newName}`;

      await updateDoc(memberRef, {
        "basic_info.name": subModal.newName.trim(),
        "basic_info.nameKana": subModal.newNameKana.trim(),
        "status.is_substituted": true,
        "notes": (currentNotes + historyNote).trim()
      });
      
      showToast("選手変更が完了しました", "success");
      setSubModal({ isOpen: false, memberId: "", currentName: "", newName: "", newNameKana: "" });
    } catch (error) {
      console.error("❌ 選手変更エラー:", error);
      showToast("処理に失敗しました", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const unregisteredGroups = groupedEntries.filter(g => !g.is_checked_in);
  const registeredGroups = groupedEntries.filter(g => g.is_checked_in);
  const displayGroups = activeTab === "unregistered" ? unregisteredGroups : registeredGroups;

  const getScanAreaStyle = () => {
    switch (scanState) {
      case "success": return "bg-green-50 border-green-400 shadow-[0_8px_30px_rgba(34,197,94,0.3)] transform scale-[1.02]";
      case "duplicate": return "bg-yellow-50 border-yellow-400 shadow-[0_8px_30px_rgba(250,204,21,0.3)] transform scale-[1.02]";
      case "error": return "bg-red-50 border-red-400 shadow-[0_8px_30px_rgba(239,68,68,0.3)] transform scale-[1.02]";
      default: return "bg-white border-theme-secondary/20 shadow-sm";
    }
  };

  const getScanIcon = () => {
    switch (scanState) {
      case "success": return "✅";
      case "duplicate": return "⚠️";
      case "error": return "❌";
      default: return "📱";
    }
  };

  const getScanTextColor = () => {
    switch (scanState) {
      case "success": return "text-green-700";
      case "duplicate": return "text-yellow-700";
      case "error": return "text-red-700";
      default: return "text-theme-secondary";
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-20 relative">
      <Header title="ADMIN" subtitle="当日受付・選手変更" isAdmin={true} />

      <main className="max-w-[1000px] mx-auto mt-8 px-4 md:px-8">

        {/* QRコード読み取り＆フィードバック領域 */}
        <div className={`p-8 md:p-12 rounded-3xl border-4 flex flex-col items-center justify-center text-center transition-all duration-300 mb-8 z-10 relative ${getScanAreaStyle()}`}>
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-sm transition-transform duration-300 ${scanState !== "waiting" ? "scale-110" : ""} ${
            scanState === "success" ? "bg-green-200" :
            scanState === "duplicate" ? "bg-yellow-200" :
            scanState === "error" ? "bg-red-200" : "bg-gray-100 border-4 border-dashed border-gray-300"
          }`}>
            {getScanIcon()}
          </div>
          <h2 className={`text-3xl md:text-4xl font-black mb-3 transition-colors ${getScanTextColor()}`}>
            {scannedGroupName ? scannedGroupName : "QRコード待機中"}
          </h2>
          <p className={`text-base md:text-lg font-bold transition-colors ${scanState !== "waiting" ? getScanTextColor() : "text-gray-400"}`}>
            {scanMessage}
          </p>
        </div>

        {/* リスト領域 */}
        <div className="bg-white rounded-3xl shadow-sm border-2 border-theme-secondary/10 overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          
          <div className="flex border-b-2 border-theme-secondary/10">
            <button
              onClick={() => setActiveTab("unregistered")}
              className={`flex-1 py-4 text-center font-black transition-colors ${
                activeTab === "unregistered" ? "bg-theme-secondary/5 text-theme-primary border-b-4 border-theme-primary" : "text-gray-400 hover:bg-gray-50 border-b-4 border-transparent"
              }`}
            >
              未受付 ({unregisteredGroups.length})
            </button>
            <button
              onClick={() => setActiveTab("registered")}
              className={`flex-1 py-4 text-center font-black transition-colors ${
                activeTab === "registered" ? "bg-green-50 text-green-700 border-b-4 border-green-500" : "text-gray-400 hover:bg-gray-50 border-b-4 border-transparent"
              }`}
            >
              受付済 ({registeredGroups.length})
            </button>
          </div>

          <div className="p-4 md:p-6 bg-gray-50 min-h-[400px]">
            {isLoading ? (
              <div className="text-center py-20 font-bold text-xl text-gray-400 animate-pulse">
                データを読み込み中...
              </div>
            ) : displayGroups.length > 0 ? (
              <div className="space-y-4">
                {displayGroups.map(group => {
                  const bib = group.members[0].basic_info?.bib_number;
                  const name = group.entry_type === "team" ? group.team_name : group.members[0].basic_info?.name;
                  const division = group.division;

                  // チーム単位の棄権フラグ
                  const isGroupWithdrawn = group.members.every(m => m.status?.is_withdrawn);
                  // チーム内にすでに「変更済」のメンバーがいるかどうか
                  const hasSubstitutedMember = group.members.some(m => m.status?.is_substituted);

                  return (
                    <div key={group.entry_group_id} className={`p-4 rounded-2xl border transition-all duration-200 ${
                      isGroupWithdrawn 
                        ? "bg-gray-100 border-gray-200 opacity-80 shadow-none" 
                        : "bg-white border-theme-secondary/10 shadow-sm hover:border-theme-secondary/30"
                    }`}>
                      
                      {/* グループヘッダー部分 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-2 rounded-xl text-center min-w-[60px] border ${isGroupWithdrawn ? "bg-gray-200 border-gray-300" : "bg-theme-bg border-theme-secondary/10"}`}>
                            <span className="block text-[10px] font-bold text-gray-500">立順</span>
                            <span className={`block text-xl font-black ${isGroupWithdrawn ? "text-gray-500" : "text-theme-primary"}`}>{bib}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 mb-0.5">{division}</p>
                            <h3 className={`text-lg font-black flex items-center gap-2 ${isGroupWithdrawn ? "text-gray-500 line-through" : "text-theme-secondary"}`}>
                              {name}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                                isGroupWithdrawn ? "bg-gray-400" : group.entry_type === "team" ? "bg-[#8B1500]" : "bg-[#D35400]"
                              }`}>
                                {group.entry_type === "team" ? "団体" : "個人"}
                              </span>
                              {isGroupWithdrawn && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">棄権</span>
                              )}
                            </h3>
                          </div>
                        </div>

                        {/* 🌟 棄権ボタンと受付ボタンの配置 */}
                        <div className="flex justify-end gap-2 mt-2 sm:mt-0">
                          <button
                            onClick={() => handleToggleGroupWithdraw(group, isGroupWithdrawn)}
                            disabled={isProcessing}
                            className={`px-4 py-2 text-sm font-bold border-2 rounded-full transition-colors disabled:opacity-50 ${
                              isGroupWithdrawn 
                                ? "bg-white text-gray-500 border-gray-300 hover:bg-gray-50" 
                                : "bg-white text-red-500 border-red-200 hover:bg-red-50"
                            }`}
                          >
                            {isGroupWithdrawn ? "棄権取消" : "棄権にする"}
                          </button>

                          {activeTab === "unregistered" ? (
                            // 🌟 修正ポイント：「受付」ボタンの視認性向上
                            <button
                              onClick={() => handleManualCheckIn(group, true)}
                              disabled={isProcessing || isGroupWithdrawn}
                              className="px-6 py-2 md:px-8 bg-theme-primary text-white font-black rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:bg-gray-300 disabled:shadow-none disabled:transform-none"
                            >
                              受付
                            </button>
                          ) : (
                            // 🌟 修正ポイント：「受付取消」ボタンの調整
                            <button
                              onClick={() => handleManualCheckIn(group, false)}
                              disabled={isProcessing || isGroupWithdrawn}
                              className="px-4 py-2 md:px-6 bg-white text-gray-500 font-bold border-2 border-gray-200 rounded-full hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50 text-sm"
                            >
                              受付取消
                            </button>
                          )}
                        </div>
                      </div>

                      {/* メンバー一覧と選手変更領域 */}
                      {group.entry_type === "team" && (
                        <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {group.members.map(member => {
                            const isSubstituted = !!member.status?.is_substituted;
                            
                            return (
                              <div key={member.id} className="flex flex-col gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded w-8 text-center">
                                    {member.basic_info?.position || "-"}
                                  </span>
                                  <span className={`text-sm font-bold truncate ${isGroupWithdrawn ? "text-gray-400 line-through" : "text-theme-secondary"}`}>
                                    {member.basic_info?.name}
                                  </span>
                                  
                                  <div className="flex gap-1 ml-auto shrink-0">
                                    {isSubstituted && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">変更済</span>}
                                  </div>
                                </div>

                                <div className="flex items-center justify-end mt-auto pt-1">
                                  {!isGroupWithdrawn && (
                                    <button
                                      onClick={() => setSubModal({
                                        isOpen: true,
                                        memberId: member.id,
                                        currentName: member.basic_info?.name || "",
                                        newName: "",
                                        newNameKana: ""
                                      })}
                                      disabled={hasSubstitutedMember && !isSubstituted}
                                      className="w-full text-xs py-1.5 bg-white text-blue-600 border border-blue-200 font-bold rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:cursor-not-allowed"
                                      title={hasSubstitutedMember && !isSubstituted ? "選手変更は1チーム1名までです" : ""}
                                    >
                                      選手変更
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 font-bold text-gray-400">
                {activeTab === "unregistered" ? "未受付のデータはありません" : "受付済みのデータはありません"}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* 選手変更モーダル */}
      {subModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border-4 border-blue-100">
            <div className="bg-blue-50 p-6 border-b border-blue-100">
              <h3 className="text-xl font-black text-blue-800 flex items-center gap-2">
                <span>🔄</span> 当日選手変更
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm">
                <span className="font-bold text-gray-500 block mb-1">変更前の選手:</span>
                <span className="font-black text-gray-800 text-lg">{subModal.currentName}</span>
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-secondary mb-1">新しい選手の名前（必須）</label>
                <input
                  type="text"
                  placeholder="例：山田 太郎"
                  value={subModal.newName}
                  onChange={(e) => setSubModal({ ...subModal, newName: e.target.value })}
                  className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-400 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-secondary mb-1">新しい選手のふりがな</label>
                <input
                  type="text"
                  placeholder="例：やまだ たろう"
                  value={subModal.newNameKana}
                  onChange={(e) => setSubModal({ ...subModal, newNameKana: e.target.value })}
                  className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-400 outline-none font-bold"
                />
              </div>

              <p className="text-xs font-bold text-red-500 mt-2">
                ※変更は1チーム1名までです。実行すると取り消しできません。
              </p>
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setSubModal({ ...subModal, isOpen: false })}
                disabled={isProcessing}
                className="px-5 py-2.5 font-bold text-theme-secondary/60 bg-white border-2 border-gray-200 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubstituteMember}
                disabled={!subModal.newName.trim() || isProcessing}
                className="px-5 py-2.5 font-black text-white bg-blue-600 rounded-xl shadow-[0_4px_0_0_rgba(37,99,235,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(37,99,235,1)] transition-all disabled:bg-blue-300 disabled:shadow-none disabled:translate-y-[4px]"
              >
                {isProcessing ? "更新中..." : "変更を確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} />
    </div>
  );
}

export default function AdminReceptionPage() {
  return (
    <ErrorBoundary>
      <AdminReceptionContent />
    </ErrorBoundary>
  );
}