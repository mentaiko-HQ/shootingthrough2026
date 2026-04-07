"use client";

import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

// ============================================================================
// 1. Error Boundary（エラーキャッチ専用コンポーネント）
// ============================================================================
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("❌ 描画エラー詳細:", error.message, errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
          <div className="bg-white border-2 border-theme-secondary/10 p-6 rounded-[24px] w-full max-w-lg shadow-sm">
            <h2 className="font-black text-red-700 text-xl mb-2">システムエラー</h2>
            <p className="text-theme-secondary/80 font-bold text-sm mb-4">画面の表示中に問題が発生しました。リロードをお試しください。</p>
            <details className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <summary className="text-xs font-bold text-gray-500 cursor-pointer outline-none hover:opacity-70">
                エラー詳細を表示
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

// ============================================================================
// 2. 型定義
// ============================================================================
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
    team_name: string;
  };
  payment_info?: { status: "pending" | "approved" };
  status?: {
    call_status?: CallStatus;
    is_withdrawn?: boolean;
  };
};

type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  members: ParticipantDoc[];
};

// ============================================================================
// 3. メインコンポーネント
// ============================================================================
function DisplayContent() {
  const [shootingGroups, setShootingGroups] = useState<EntryGroup[]>([]);
  const [callingGroups, setCallingGroups] = useState<EntryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const participantsRef = collection(db, "participants");
    const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
      try {
        const rawData: ParticipantDoc[] = [];
        snapshot.forEach((docSnap) => {
          rawData.push({ id: docSnap.id, ...docSnap.data() } as ParticipantDoc);
        });

        const groupsMap = new Map<string, EntryGroup>();
        rawData.forEach((item) => {
          if (!item.basic_info || item.payment_info?.status !== "approved") return;
          const groupId = item.entry_group_id || `fallback-group-${item.id}`;
          if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
              entry_group_id: groupId,
              entry_type: item.basic_info.entry_type || "individual",
              team_name: item.basic_info.team_name || "名称未設定",
              division: item.basic_info.division || "未分類",
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
          const bibA = parseInt(a.members[0]?.basic_info?.bib_number || "0", 10);
          const bibB = parseInt(b.members[0]?.basic_info?.bib_number || "0", 10);
          return bibA - bibB;
        });

        const currentShooting: EntryGroup[] = [];
        const currentCalling: EntryGroup[] = [];

        groupsArray.forEach((group) => {
          // グループ全員が棄権しているかを判定
          const isGroupWithdrawn = group.members.every(m => m.status?.is_withdrawn);
          const teamStatus = group.members[0]?.status?.call_status || "waiting";

          // 🌟 棄権したチームは非表示にせず、右側の「呼出中」リストの中に混ぜて表示する
          if (isGroupWithdrawn) {
            currentCalling.push(group);
          } else if (teamStatus === "shooting") {
            currentShooting.push(group);
          } else if (teamStatus === "calling") {
            currentCalling.push(group);
          }
        });

        setShootingGroups(currentShooting);
        setCallingGroups(currentCalling);
        setIsLoading(false);
      } catch (error) {
        console.error("❌ データ解析エラー:", error);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const createColumns = (groups: EntryGroup[], maxWeight: number = 36) => {
    const cols: EntryGroup[][] = [];
    let currentCol: EntryGroup[] = [];
    let currentWeight = 0;
    
    groups.forEach(g => {
      const weight = g.entry_type === "team" ? 9 : 1;
      if (currentWeight + weight > maxWeight && currentCol.length > 0) {
        cols.push(currentCol);
        currentCol = [g];
        currentWeight = weight;
      } else {
        currentCol.push(g);
        currentWeight += weight;
      }
    });
    if (currentCol.length > 0) cols.push(currentCol);
    return cols;
  };

  const callingColumns = createColumns(callingGroups, 36);

  // --- 表示用カードコンポーネント ---
  const DisplayCard = ({ group, type }: { group: EntryGroup, type: "shooting" | "calling" }) => {
    const bib = group.members[0]?.basic_info?.bib_number;
    const name = group.entry_type === "team" ? group.team_name : group.members[0]?.basic_info?.name;
    const division = group.division;
    const isTeam = group.entry_type === "team";
    
    // メンバー全員が棄権しているか
    const isWithdrawn = group.members.every(m => m.status?.is_withdrawn);

    let bgClass = "";
    let bibBgClass = "";
    let textClass = "";

    // 🌟 状態に応じたデザインの振り分け
    if (isWithdrawn) {
      // 棄権：透明度を下げ、グレースケールにし、取り消し線を引く
      bgClass = "bg-gray-100 border border-gray-200 opacity-60";
      bibBgClass = "bg-gray-200 text-gray-400";
      textClass = "text-gray-400 line-through";
    } else if (type === "shooting") {
      // 行射中：テーマカラー（緑）で塗りつぶし、白文字で目立たせる
      bgClass = "bg-theme-primary border-none shadow-md";
      bibBgClass = "bg-white/20 text-white";
      textClass = "text-white";
    } else if (type === "calling") {
      // 呼出中：黄色で点滅させ、注意を引く
      bgClass = "bg-yellow-50 border border-yellow-200 shadow-sm animate-pulse";
      bibBgClass = "bg-yellow-400 text-yellow-900";
      textClass = "text-yellow-800";
    } else {
      bgClass = "bg-white border border-theme-secondary/10 shadow-sm";
      bibBgClass = "bg-theme-bg text-theme-primary border border-theme-secondary/5";
      textClass = "text-theme-secondary";
    }

    const heightPercent = isTeam ? "25%" : "calc(100% / 36)";
    const wrapperPadding = isTeam ? "p-1 md:p-2" : "p-0.5";

    if (isTeam) {
      // 🌟 チーム用レイアウト
      return (
        <div style={{ height: heightPercent }} className={`w-full shrink-0 ${wrapperPadding}`}>
          <div className={`w-full h-full p-3 md:p-4 lg:p-6 rounded-[20px] md:rounded-[24px] flex items-center gap-4 lg:gap-6 transition-all duration-300 overflow-hidden ${bgClass}`}>
            <div className={`w-20 md:w-28 lg:w-36 shrink-0 h-full rounded-[16px] flex flex-col items-center justify-center ${bibBgClass}`}>
              <span className="text-[12px] md:text-sm lg:text-base font-bold opacity-80 mb-1 leading-none">立順</span>
              <span className="text-3xl md:text-5xl lg:text-7xl font-black leading-none">{bib || "-"}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
              <p className={`font-bold text-sm md:text-lg lg:text-xl mb-1 md:mb-2 truncate leading-none ${type === "shooting" ? "text-white/80" : "text-gray-500"}`}>{division}</p>
              <h3 className={`text-2xl md:text-4xl lg:text-5xl font-black truncate leading-tight ${textClass}`}>{name}</h3>
            </div>
            
            {/* 🌟 状態バッジの表示 */}
            {isWithdrawn ? (
              <span className="text-lg md:text-2xl lg:text-3xl font-black bg-gray-200 text-gray-500 border border-gray-300 px-4 py-2 lg:px-6 lg:py-3 rounded-full shrink-0 shadow-none">棄権</span>
            ) : type === "calling" && (
              <span className="text-lg md:text-2xl lg:text-3xl font-black bg-yellow-400 text-yellow-900 px-4 py-2 lg:px-6 lg:py-3 rounded-full shrink-0 shadow-sm">呼出</span>
            )}
          </div>
        </div>
      );
    } else {
      // 🌟 個人用レイアウト
      return (
        <div style={{ height: heightPercent }} className={`w-full shrink-0 ${wrapperPadding}`}>
          <div className={`w-full h-full px-2 py-0 md:px-3 rounded-lg flex items-center gap-3 transition-all duration-300 overflow-hidden ${bgClass}`}>
            <div className={`w-12 md:w-16 lg:w-20 shrink-0 h-[90%] rounded flex items-center justify-center ${bibBgClass}`}>
              <span className="text-lg md:text-xl lg:text-3xl font-black leading-none">{bib || "-"}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden h-full">
              <p className={`font-bold text-xs md:text-sm lg:text-base truncate shrink-0 leading-none ${type === "shooting" ? "text-white/80" : "text-gray-500"}`}>{division}</p>
              <h3 className={`text-base md:text-xl lg:text-2xl font-black truncate leading-none ${textClass}`}>{name}</h3>
            </div>
            
            {/* 🌟 状態バッジの表示 */}
            {isWithdrawn ? (
              <span className="text-xs md:text-sm lg:text-base font-black bg-gray-200 text-gray-500 border border-gray-300 px-2 py-1 md:px-3 md:py-1.5 rounded shrink-0 leading-none">棄権</span>
            ) : type === "calling" && (
              <span className="text-xs md:text-sm lg:text-base font-black bg-yellow-400 text-yellow-900 px-2 py-1 md:px-3 md:py-1.5 rounded shrink-0 leading-none">呼出</span>
            )}
          </div>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="text-theme-primary/60 text-2xl md:text-4xl font-black animate-pulse">システムを起動中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-theme-bg text-theme-secondary font-sans flex flex-col p-4 md:p-6 overflow-hidden selection:bg-transparent">
      
      <header className="flex justify-between items-end mb-4 px-2 shrink-0">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-theme-secondary/60 tracking-widest">進行状況</h1>
      </header>

      {/* 4等分レイアウト（左1/4：右3/4） */}
      <div className="flex-1 flex gap-4 md:gap-6 overflow-hidden min-h-0">
        
        {/* 左側：行射中 (1/4幅) */}
        <div className="w-1/4 flex-shrink-0 bg-white rounded-[24px] border border-theme-primary/10 flex flex-col overflow-hidden shadow-[0_8px_30px_rgb(57,108,84,0.12)] h-full">
          <div className="bg-theme-primary/5 p-4 md:p-5 border-b border-theme-primary/10 shrink-0">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-theme-primary flex items-center justify-center gap-2">
              <span>🎯</span> 行射中
            </h2>
          </div>
          
          <div className="flex-1 p-1 md:p-2 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col h-full">
              {shootingGroups.map(group => (
                <DisplayCard key={group.entry_group_id} group={group} type="shooting" />
              ))}
              {shootingGroups.length === 0 && (
                <div className="h-full flex items-center justify-center text-theme-primary/40 text-xl lg:text-2xl font-bold">
                  行射中の選手はいません
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：呼出中および棄権 (3/4幅) */}
        <div className="w-3/4 flex-shrink-0 bg-white rounded-[24px] border border-yellow-200/50 flex flex-col overflow-hidden shadow-[0_8px_30px_rgb(250,204,21,0.12)] h-full relative">
          <div className="bg-yellow-50 p-4 md:p-5 border-b border-yellow-100 shrink-0">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-yellow-700 flex items-center justify-center gap-2">
              <span className="animate-pulse">📢</span> 呼出中
            </h2>
          </div>
          
          <div className="flex-1 p-1 md:p-2 overflow-x-auto overflow-y-hidden scrollbar-hide">
            <div className="flex h-full">
              {callingColumns.map((col, idx) => (
                <div key={idx} className="w-[calc((100%-1rem)/3)] md:w-[calc((100%-2rem)/3)] flex-shrink-0 flex flex-col h-full mr-2 md:mr-4">
                  {col.map(group => {
                    return <DisplayCard key={group.entry_group_id} group={group} type="calling" />;
                  })}
                </div>
              ))}
              {callingColumns.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl lg:text-2xl font-bold">
                  呼出中の選手はいません
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default function DisplayPage() {
  return (
    <ErrorBoundary>
      <DisplayContent />
    </ErrorBoundary>
  );
}