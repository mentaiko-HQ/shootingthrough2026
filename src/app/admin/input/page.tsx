"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";

// 分割したファイル群からインポート
import { 
  CallStatus, ParticipantDoc, EntryGroup, MainTabType, Handlers,
  MAIN_TABS, TAB_GROUPS, SUB_TABS, 
  checkYosenPass, checkIndividualYosenPass, isMatchingIndividualSubTab 
} from "./shared";

import { 
  ErrorBoundary, GroupCard, TeamConfirmTable, IndConfirmTable 
} from "./components";

// ============================================================================
// カスタムフック (データ通信と更新ロジックの分離)
// ============================================================================
function useParticipantsData(showToast: (text: string, type: "success" | "error") => void) {
  const [groupedEntries, setGroupedEntries] = useState<EntryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            const bibA = a.members[0]?.basic_info?.bib_number || "";
            const bibB = b.members[0]?.basic_info?.bib_number || "";
            if (!bibA && !bibB) return 0;
            if (!bibA) return 1;
            if (!bibB) return -1;
            const numA = parseInt(bibA, 10);
            const numB = parseInt(bibB, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return bibA.localeCompare(bibB);
          });

          setGroupedEntries(groupsArray);
          setIsLoading(false);
        } catch (error) {
          const err = error as Error;
          console.error("❌ データの解析中にエラーが発生しました:", err.message, err.stack);
          showToast("データの解析中にエラーが発生しました", "error");
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("❌ Firestore取得エラー:", error);
        showToast("データの取得に失敗しました", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  const handleScoreUpdate = useCallback(async (memberId: string, tab: MainTabType, val: number) => {
    try {
      const field = tab === "team_kessho" ? "kessho" : "yosen";
      await updateDoc(doc(db, "participants", memberId), { [`results.${field}`]: val });
    } catch (error) {
      console.error("❌ スコア更新エラー:", error);
      showToast("更新に失敗しました", "error");
    }
  }, [showToast]);

  const handleIzumeAdd = useCallback(async (memberId: string, currentIzume: string[], result: string) => {
    try {
      await updateDoc(doc(db, "participants", memberId), { "results.izume": [...currentIzume, result] });
    } catch (error) {
      console.error("❌ 射詰追加エラー:", error);
      showToast("更新に失敗しました", "error");
    }
  }, [showToast]);

  const handleIzumePop = useCallback(async (memberId: string, currentIzume: string[]) => {
    if (!currentIzume || currentIzume.length === 0) return;
    try {
      await updateDoc(doc(db, "participants", memberId), { "results.izume": currentIzume.slice(0, -1) });
    } catch (error) {
      console.error("❌ 射詰取り消しエラー:", error);
      showToast("更新に失敗しました", "error");
    }
  }, [showToast]);

  const handleEnkinUpdate = useCallback(async (memberId: string, val: string) => {
    try {
      await updateDoc(doc(db, "participants", memberId), { "results.enkin": val });
    } catch (error) {
      console.error("❌ 遠近更新エラー:", error);
      showToast("更新に失敗しました", "error");
    }
  }, [showToast]);

  return {
    groupedEntries,
    isLoading,
    handleScoreUpdate,
    handleIzumeAdd,
    handleIzumePop,
    handleEnkinUpdate
  };
}

// ============================================================================
// メインコンポーネント (状態管理とルーティング)
// ============================================================================
function AdminInputContent() {
  const [mainTab, setMainTab] = useState<MainTabType>("yosen");
  const [subTab, setSubTab] = useState<string>("団体の部（男子）");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isRuleOpen, setIsRuleOpen] = useState(false);

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const { groupedEntries, isLoading, ...handlers } = useParticipantsData(showToast);

  const visibleSubTabs = useMemo(() => SUB_TABS.filter(tab => {
    if (mainTab === "team_kessho" || mainTab === "team_izume" || mainTab === "confirm") return tab.type === "team";
    if (mainTab === "ind_kessho" || mainTab === "ind_confirm") return tab.type === "individual";
    return true; 
  }), [mainTab]);

  const sortedGroups = useMemo(() => {
    let targetGroups: EntryGroup[] = [];

    if (mainTab === "ind_kessho" || mainTab === "ind_confirm") {
      groupedEntries.forEach(g => {
        g.members.forEach(m => {
          if (checkIndividualYosenPass(m) && isMatchingIndividualSubTab(m, g, subTab)) {
            targetGroups.push({
              ...g,
              entry_group_id: `${g.entry_group_id}_${m.id}`,
              members: [m]
            });
          }
        });
      });
    } else {
      targetGroups = groupedEntries.filter((g) => {
        if ((mainTab === "team_kessho" || mainTab === "team_izume" || mainTab === "confirm") && !subTab.includes("団体")) return false;
        if (g.division !== subTab) return false;
        if (mainTab === "team_kessho" || mainTab === "team_izume" || mainTab === "confirm") return checkYosenPass(g);
        return true;
      });
    }

    if (mainTab === "ind_kessho" || mainTab === "ind_confirm" || mainTab === "team_izume" || mainTab === "confirm") {
      return targetGroups.sort((a, b) => {
        let aScore = 0, bScore = 0;
        
        if (mainTab === "team_izume" || mainTab === "confirm") {
          aScore = a.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
          bScore = b.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
          
          if (aScore !== bScore) {
            return bScore - aScore;
          }
          if (mainTab === "confirm") {
            const aIzumeScore = a.members.reduce((sum, m) => sum + (m.results?.izume?.filter(res => res === "〇").length || 0), 0);
            const bIzumeScore = b.members.reduce((sum, m) => sum + (m.results?.izume?.filter(res => res === "〇").length || 0), 0);
            if (aIzumeScore !== bIzumeScore) return bIzumeScore - aIzumeScore;
          }
        } else {
          aScore = Math.max(...a.members.filter(m => checkIndividualYosenPass(m)).map(m => m.results?.yosen || 0));
          bScore = Math.max(...b.members.filter(m => checkIndividualYosenPass(m)).map(m => m.results?.yosen || 0));
          if (aScore !== bScore) return bScore - aScore; 
        }
        
        const bibA = parseInt(a.members[0]?.basic_info?.bib_number || "0", 10);
        const bibB = parseInt(b.members[0]?.basic_info?.bib_number || "0", 10);
        return bibA - bibB; 
      });
    }
    return targetGroups;
  }, [groupedEntries, mainTab, subTab]);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-40">
      <Header title="大会管理ページ" subtitle="大会成績入力" isAdmin={true} />

      <main className="max-w-[1200px] mx-auto mt-8 px-4 md:px-8">
        
        <div className="mb-6 animate-fade-in-up">
          <button onClick={() => setIsRuleOpen(!isRuleOpen)} className="w-full flex items-center justify-between p-4 bg-white border-2 border-theme-secondary/10 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors">
            <span className="font-black text-theme-secondary flex items-center gap-2 text-sm md:text-base"><span>📋</span> 競技方法（予選通過ライン・順位決定）</span>
            <span className="text-gray-400 font-bold text-xs md:text-sm">{isRuleOpen ? "▲ 閉じる" : "▼ 開いて確認"}</span>
          </button>
          
          {isRuleOpen && (
            <div className="mt-3 p-5 md:p-6 bg-white border-2 border-theme-secondary/10 rounded-2xl shadow-sm text-sm md:text-base font-bold text-theme-secondary/80 leading-relaxed animate-fade-in-up">
              <h4 className="font-black text-theme-primary mb-2 border-b-2 border-theme-secondary/10 pb-2 flex items-center gap-2"><span>👥</span> (1) 団体の部</h4>
              <p className="mb-5 pl-2 md:pl-4">各選手立射で４射計１２射を行い、<span className="text-red-600 bg-red-50 px-1 rounded">男子の部は８中以上・女子の部は６中以上</span>を予選通過チームとする。<br />決勝戦は各選手立射で２射計６射を行い、的中上位から順位を決定する。同中の場合１本競射を行う。</p>
              <h4 className="font-black text-[#D35400] mb-2 border-b-2 border-theme-secondary/10 pb-2 flex items-center gap-2"><span>👤</span> (2) 個人の部</h4>
              <p className="pl-2 md:pl-4">各選手立射で４射を行い、<span className="text-red-600 bg-red-50 px-1 rounded">男子は４中、女子は３中、シニアは男子３中、女子２中以上</span>を予選通過とする。<br /><span className="text-xs text-theme-secondary/60 block my-1">（団体戦出場者の個人成績は団体予選の個人成績をもって、これにあてる。）</span>決勝は射詰により順位を決定する。ただし、優勝決定以外は遠近法による。</p>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className={`flex-1 p-2 md:p-3 rounded-3xl border-2 ${group.colorClass}`}>
              <div className={`text-[11px] md:text-xs font-black mb-2 px-2 ${group.textClass}`}>
                {group.title}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.tabs.map(tabId => {
                  const tab = MAIN_TABS.find(t => t.id === tabId)!;
                  const isActive = mainTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setMainTab(tab.id as MainTabType);
                        if (tab.id === "team_kessho" || tab.id === "team_izume" || tab.id === "confirm") {
                          if (!subTab.includes("団体")) setSubTab("団体の部（男子）");
                        } else if (tab.id === "ind_kessho" || tab.id === "ind_confirm") {
                          if (!subTab.includes("個人")) setSubTab("個人の部（男子）");
                        }
                      }}
                      className={`flex-1 min-w-[100px] p-2 md:p-3 rounded-2xl transition-all flex flex-col justify-center items-center ${
                        isActive 
                          ? "bg-theme-primary text-white shadow-[0_4px_0_0_rgba(139,21,0,1)] translate-y-0" 
                          : "bg-white text-theme-secondary/60 shadow-sm border border-transparent hover:border-theme-secondary/20 translate-y-[2px] hover:bg-white/80"
                      }`}
                    >
                      <div className="font-black text-xs md:text-sm whitespace-nowrap">{tab.label}</div>
                      <div className={`text-[10px] font-bold mt-1 hidden xl:block ${isActive ? "text-white/80" : "text-theme-secondary/50"}`}>{tab.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-3 md:p-4 rounded-3xl shadow-sm border-2 border-theme-secondary/10 mb-8 animate-fade-in-up flex overflow-x-auto scrollbar-hide">
          <div className="flex flex-nowrap gap-2 min-w-max">
            {visibleSubTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-4 py-2 md:px-5 md:py-3 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 ${subTab === tab.id ? "bg-theme-secondary text-white shadow-md" : "bg-theme-bg text-theme-secondary/60 hover:bg-theme-secondary/10"}`}
              >
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 font-bold text-xl animate-pulse text-gray-400">データを読み込み中...</div>
        ) : (
          <div className="space-y-4 animate-fade-in-up">
            {sortedGroups.length > 0 ? (
              mainTab === "confirm" ? (
                <TeamConfirmTable groups={sortedGroups} />
              ) : mainTab === "ind_confirm" ? (
                <IndConfirmTable groups={sortedGroups} />
              ) : (
                sortedGroups.map((group, index) => {
                  let showScoreHeader = false;
                  let currentTotal = 0;
                  
                  if (mainTab === "team_izume") {
                    currentTotal = group.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
                    const prevGroup = index > 0 ? sortedGroups[index - 1] : null;
                    const prevTotal = prevGroup ? prevGroup.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0) : null;
                    showScoreHeader = currentTotal !== prevTotal;
                  } else if (mainTab === "ind_kessho") {
                    currentTotal = Math.max(...group.members.filter(m => checkIndividualYosenPass(m)).map(m => m.results?.yosen || 0));
                    const prevGroup = index > 0 ? sortedGroups[index - 1] : null;
                    const prevTotal = prevGroup ? Math.max(...prevGroup.members.filter(m => checkIndividualYosenPass(m)).map(m => m.results?.yosen || 0)) : null;
                    showScoreHeader = currentTotal !== prevTotal;
                  }

                  // 🌟 12名（4チームまたは個人12人）ごとのチャンクヘッダー判定
                  const chunkSize = subTab.includes("個人") ? 12 : 4;
                  const isChunkStart = (mainTab === "yosen" || mainTab === "team_kessho") && index % chunkSize === 0;
                  const endGroupIndex = Math.min(index + chunkSize - 1, sortedGroups.length - 1);
                  const endBibNumber = sortedGroups[endGroupIndex]?.members[0]?.basic_info?.bib_number;

                  return (
                    <React.Fragment key={group.entry_group_id}>
                      
                      {/* 🚩 グループ区切り（ディバイダー）の表示 */}
                      {isChunkStart && (
                        <div className="w-full bg-theme-secondary/5 border-l-4 border-theme-secondary text-theme-secondary font-black py-2.5 px-4 rounded-r-xl mt-12 mb-4 text-base md:text-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in-up">
                          <div className="flex items-center gap-2">
                            <span>🚩</span> 第 {Math.floor(index / chunkSize) + 1} グループ
                          </div>
                          <span className="text-xs font-bold text-theme-secondary/60 bg-white px-3 py-1.5 rounded shadow-sm border border-theme-secondary/10">
                            立順: {group.members[0]?.basic_info?.bib_number} 〜 {endBibNumber}
                          </span>
                        </div>
                      )}

                      {showScoreHeader && mainTab === "team_izume" && (
                        <div className="w-full bg-[#8B1500]/10 border-l-4 border-[#8B1500] text-[#8B1500] font-black py-2.5 px-4 rounded-r-xl mt-8 mb-4 text-base md:text-lg shadow-sm flex items-center gap-2">
                          <span>🎯</span> 団体決勝 {currentTotal}中 のチーム
                        </div>
                      )}
                      {showScoreHeader && mainTab === "ind_kessho" && (
                        <div className="w-full bg-[#D35400]/10 border-l-4 border-[#D35400] text-[#D35400] font-black py-2.5 px-4 rounded-r-xl mt-8 mb-4 text-base md:text-lg shadow-sm flex items-center gap-2">
                          <span>🎯</span> 予選 {currentTotal}中 の選手
                        </div>
                      )}
                      
                      <GroupCard group={group} mainTab={mainTab} handlers={handlers} />
                      
                    </React.Fragment>
                  );
                })
              )
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-300 font-bold text-gray-400">該当する部門のデータがありません。</div>
            )}
          </div>
        )}
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}

export default function AdminInputPage() {
  return (
    <ErrorBoundary>
      <AdminInputContent />
    </ErrorBoundary>
  );
}