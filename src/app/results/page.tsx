// src/app/results/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";

// 分割したファイル群からインポート
import { 
  ParticipantDoc, EntryGroup, MainTabType, 
  MAIN_TABS, TAB_GROUPS, SUB_TABS, 
  checkYosenPass, checkIndividualYosenPass, isMatchingIndividualSubTab 
} from "./shared";

import { 
  ErrorBoundary, GroupCard, TeamConfirmTable, IndConfirmTable 
} from "./components";

// ============================================================================
// カスタムフック (データ取得ロジックの分離)
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

  return {
    groupedEntries,
    isLoading
  };
}

// ============================================================================
// メインコンポーネント (状態管理とルーティング)
// ============================================================================
function ResultsContent() {
  const [mainTab, setMainTab] = useState<MainTabType>("yosen");
  const [subTab, setSubTab] = useState<string>("団体の部（男子）");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isRuleOpen, setIsRuleOpen] = useState(false);

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const { groupedEntries, isLoading } = useParticipantsData(showToast);

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
          aScore = a.members[0]?.results?.yosen || 0;
          bScore = b.members[0]?.results?.yosen || 0;
          if (aScore !== bScore) return bScore - aScore; 
        }
        
        const bibA = parseInt(a.members[0]?.basic_info?.bib_number || "0", 10);
        const bibB = parseInt(b.members[0]?.basic_info?.bib_number || "0", 10);
        return bibA - bibB; 
      });
    } else if (mainTab === "yosen") {
      return targetGroups.sort((a, b) => {
        const bibA = a.members[0]?.basic_info?.bib_number || "";
        const bibB = b.members[0]?.basic_info?.bib_number || "";
        if (!bibA && !bibB) return 0;
        if (!bibA) return 1;
        if (!bibB) return -1;
        const numA = parseInt(bibA, 10);
        const numB = parseInt(bibB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
        }
        return bibA.localeCompare(bibB);
      });
    }
    return targetGroups;
  }, [groupedEntries, mainTab, subTab]);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-20 md:pb-40">
      <Header title="大会成績" subtitle="第100回 勇気凛々杯争奪弓道大会" isAdmin={false} />

      <main className="max-w-[1200px] mx-auto mt-4 md:mt-8 px-2 md:px-8">
        
        <div className="mb-4 md:mb-6 animate-fade-in-up">
          <button onClick={() => setIsRuleOpen(!isRuleOpen)} className="w-full flex items-center justify-between p-3 md:p-4 bg-white border border-theme-secondary/10 rounded-xl md:rounded-2xl shadow-sm hover:bg-gray-50 transition-colors">
            <span className="font-black text-theme-secondary flex items-center gap-1.5 md:gap-2 text-xs md:text-base"><span>📋</span> 競技方法（ルール）</span>
            <span className="text-gray-400 font-bold text-[10px] md:text-sm">{isRuleOpen ? "▲ 閉じる" : "▼ 開いて確認"}</span>
          </button>
          
          {isRuleOpen && (
            <div className="mt-2 p-3 md:p-6 bg-white border border-theme-secondary/10 rounded-xl md:rounded-2xl shadow-sm text-xs md:text-base font-bold text-theme-secondary/80 leading-relaxed animate-fade-in-up">
              <h4 className="font-black text-theme-primary mb-1 md:mb-2 border-b border-theme-secondary/10 pb-1 md:pb-2 flex items-center gap-1.5"><span>👥</span> (1) 団体の部</h4>
              <p className="mb-3 md:mb-5 pl-1 md:pl-4 text-[10px] md:text-base">各選手立射で４射計１２射を行い、<span className="text-red-600 bg-red-50 px-1 rounded">男子の部は８中以上・女子の部は６中以上</span>を予選通過チームとする。<br />決勝戦は各選手立射で２射計６射を行い、的中上位から順位を決定する。同中の場合１本競射を行う。</p>
              <h4 className="font-black text-[#D35400] mb-1 md:mb-2 border-b border-theme-secondary/10 pb-1 md:pb-2 flex items-center gap-1.5"><span>👤</span> (2) 個人の部</h4>
              <p className="pl-1 md:pl-4 text-[10px] md:text-base">各選手立射で４射を行い、<span className="text-red-600 bg-red-50 px-1 rounded">男子は４中、女子は３中、シニアは男子３中、女子２中以上</span>を予選通過とする。<br /><span className="text-[8px] md:text-xs text-theme-secondary/60 block my-1">（団体戦出場者の個人成績は団体予選の個人成績をもって、これにあてる。）</span>決勝は射詰により順位を決定する。ただし、優勝決定以外は遠近法による。</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-4 md:mb-6">
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className={`flex-1 p-1.5 md:p-3 rounded-xl md:rounded-3xl border border-gray-200 md:border-2 ${group.colorClass}`}>
              <div className={`text-[9px] md:text-xs font-black mb-1 md:mb-2 px-1 md:px-2 ${group.textClass}`}>
                {group.title}
              </div>
              <div className="flex flex-wrap gap-1 md:gap-2">
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
                      className={`flex-1 min-w-[70px] md:min-w-[100px] p-1.5 md:p-3 rounded-lg md:rounded-2xl transition-all flex flex-col justify-center items-center ${
                        isActive 
                          ? "bg-theme-primary text-white shadow-[0_2px_0_0_rgba(139,21,0,1)] md:shadow-[0_4px_0_0_rgba(139,21,0,1)] translate-y-0" 
                          : "bg-white text-theme-secondary/60 shadow-sm border border-transparent hover:border-theme-secondary/20 translate-y-[1px] md:translate-y-[2px] hover:bg-white/80"
                      }`}
                    >
                      <div className="font-black text-[10px] md:text-sm whitespace-nowrap">{tab.label}</div>
                      <div className={`text-[8px] md:text-[10px] font-bold mt-0.5 md:mt-1 hidden lg:block ${isActive ? "text-white/80" : "text-theme-secondary/50"}`}>{tab.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-2 md:p-4 rounded-xl md:rounded-3xl shadow-sm border border-theme-secondary/10 mb-4 md:mb-8 animate-fade-in-up flex overflow-x-auto scrollbar-hide">
          <div className="flex flex-nowrap gap-1.5 md:gap-2 min-w-max">
            {visibleSubTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 md:px-5 md:py-3 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm transition-all flex items-center gap-1 md:gap-2 whitespace-nowrap ${subTab === tab.id ? "bg-theme-secondary text-white shadow-sm" : "bg-theme-bg text-theme-secondary/60 hover:bg-theme-secondary/10"}`}
              >
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 md:py-20 font-bold text-sm md:text-xl animate-pulse text-gray-400">データを読み込み中...</div>
        ) : (
          <div className="space-y-3 md:space-y-4 animate-fade-in-up">
            {sortedGroups.length > 0 ? (
              mainTab === "confirm" ? (
                <TeamConfirmTable groups={sortedGroups} />
              ) : mainTab === "ind_confirm" ? (
                <IndConfirmTable groups={sortedGroups} />
              ) : (
                sortedGroups.map((group, index) => {
                  let showHeader = false;
                  let currentTotal = 0;
                  
                  if (mainTab === "team_izume") {
                    currentTotal = group.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
                    const prevGroup = index > 0 ? sortedGroups[index - 1] : null;
                    const prevTotal = prevGroup ? prevGroup.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0) : null;
                    showHeader = currentTotal !== prevTotal;
                  } else if (mainTab === "ind_kessho") {
                    currentTotal = group.members[0]?.results?.yosen || 0;
                    const prevGroup = index > 0 ? sortedGroups[index - 1] : null;
                    const prevTotal = prevGroup ? prevGroup.members[0]?.results?.yosen || 0 : null;
                    showHeader = currentTotal !== prevTotal;
                  }

                  return (
                    <React.Fragment key={group.entry_group_id}>
                      {showHeader && mainTab === "team_izume" && (
                        <div className="w-full bg-[#8B1500]/10 border-l-4 border-[#8B1500] text-[#8B1500] font-black py-1.5 md:py-2.5 px-3 md:px-4 rounded-r-lg md:rounded-r-xl mt-4 md:mt-8 mb-2 md:mb-4 text-sm md:text-lg shadow-sm flex items-center gap-1.5">
                          <span>🎯</span> 団体決勝 {currentTotal}中 のチーム
                        </div>
                      )}
                      {showHeader && mainTab === "ind_kessho" && (
                        <div className="w-full bg-[#D35400]/10 border-l-4 border-[#D35400] text-[#D35400] font-black py-1.5 md:py-2.5 px-3 md:px-4 rounded-r-lg md:rounded-r-xl mt-4 md:mt-8 mb-2 md:mb-4 text-sm md:text-lg shadow-sm flex items-center gap-1.5">
                          <span>🎯</span> 予選 {currentTotal}中 の選手
                        </div>
                      )}
                      <GroupCard group={group} mainTab={mainTab} />
                    </React.Fragment>
                  );
                })
              )
            ) : (
              <div className="text-center py-10 md:py-20 bg-white rounded-xl md:rounded-3xl border-2 border-dashed border-gray-300 font-bold text-xs md:text-base text-gray-400">該当する部門のデータがありません。</div>
            )}
          </div>
        )}
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <ErrorBoundary>
      <ResultsContent />
    </ErrorBoundary>
  );
}