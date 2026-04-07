// src/app/admin/input/components.tsx

"use client";

import React, { Component, ErrorInfo, ReactNode, useMemo } from "react";
import { EntryGroup, GroupCardProps, checkYosenPass, checkIndividualYosenPass } from "./shared";

// ============================================================================
// Error Boundary（エラーキャッチ専用コンポーネント）
// ============================================================================
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
              <summary className="text-xs font-bold text-red-500 cursor-pointer outline-none hover:opacity-70">エラー詳細を表示</summary>
              <pre className="text-[10px] text-red-400 mt-2 whitespace-pre-wrap overflow-auto max-h-40">{this.state.error?.stack || this.state.error?.message}</pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 分割されたUIコンポーネント (無駄な再描画を防ぐ React.memo 化)
// ============================================================================

export const ScoreButtons = React.memo(({ currentScore, maxScore, onUpdate }: { currentScore: number | undefined; maxScore: number; onUpdate: (val: number) => void; }) => (
  <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
    {Array.from({ length: maxScore + 1 }, (_, i) => i).map(val => {
      const isSelected = currentScore === val;
      return (
        <button
          key={val}
          onClick={() => onUpdate(val)}
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-black rounded-xl transition-all text-lg sm:text-xl ${
            isSelected ? "bg-theme-primary text-white shadow-md transform scale-105" : "bg-white text-gray-400 border border-gray-200 hover:bg-theme-primary/10 hover:text-theme-primary hover:border-theme-primary/30 shadow-sm"
          }`}
        >
          {val}
        </button>
      );
    })}
  </div>
));
ScoreButtons.displayName = "ScoreButtons";

const areGroupsEqual = (prevProps: GroupCardProps, nextProps: GroupCardProps) => {
  return prevProps.mainTab === nextProps.mainTab && JSON.stringify(prevProps.group) === JSON.stringify(nextProps.group);
};

export const GroupCard = React.memo(({ group, mainTab, handlers }: GroupCardProps) => {
  const isGroupWithdrawn = group.members.every(m => m.status?.is_withdrawn);
  const bib = group.members[0]?.basic_info?.bib_number;
  const name = group.entry_type === "team" ? group.team_name : group.members[0]?.basic_info?.name;

  const cardClass = isGroupWithdrawn
    ? "bg-gray-100 border-gray-200 opacity-70"
    : "bg-white border-theme-secondary/10 shadow-[0_4px_0_0_rgba(80,35,20,0.05)] hover:border-theme-secondary/30";

  const totalYosenScore = group.members.reduce((sum, m) => sum + (m.results?.yosen || 0), 0);
  const totalKesshoScore = group.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
  const totalIzumeScore = group.members.reduce((sum, m) => sum + (m.results?.izume?.filter(res => res === "〇").length || 0), 0);

  const isTeamPassed = mainTab === "yosen" && checkYosenPass(group);

  return (
    <div className={`p-4 md:p-6 rounded-3xl border-2 mb-6 transition-all ${cardClass}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-theme-secondary/10 pb-4 mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl text-center min-w-[70px] border ${isGroupWithdrawn ? "bg-gray-200 border-gray-300" : "bg-theme-bg border-theme-secondary/20"}`}>
            <span className="block text-[10px] font-bold opacity-60">立順</span>
            <span className={`block text-xl font-black ${isGroupWithdrawn ? "text-gray-500" : "text-theme-primary"}`}>{bib || "-"}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-0.5">{group.division}</p>
            <h3 className={`text-xl font-black flex items-center gap-2 flex-wrap ${isGroupWithdrawn ? "text-gray-500 line-through" : "text-theme-secondary"}`}>
              {name}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${isGroupWithdrawn ? "bg-gray-400" : group.entry_type === "team" ? "bg-[#8B1500]" : "bg-[#D35400]"}`}>{group.entry_type === "team" ? "団体" : "個人"}</span>
              {isGroupWithdrawn && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">棄権</span>}
              {isTeamPassed && !isGroupWithdrawn && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-300">🎉 団体通過</span>}
            </h3>
          </div>
        </div>
        {!isGroupWithdrawn && mainTab !== "ind_kessho" && (
          <div className="text-right bg-gray-50 px-5 py-2.5 rounded-2xl border border-gray-200 shadow-inner flex items-center gap-3">
            <span className="block text-xs font-bold text-gray-500">{mainTab === "yosen" ? "予選合計" : mainTab === "team_izume" ? "射詰合計" : "決勝合計"}</span>
            <span className="text-2xl font-black text-theme-primary tracking-tighter">{mainTab === "yosen" ? totalYosenScore : mainTab === "team_izume" ? totalIzumeScore : totalKesshoScore} <span className="text-sm">中</span></span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {group.members.map((member) => {
          const isWithdrawn = !!member.status?.is_withdrawn;
          const isIndividualPassed = checkIndividualYosenPass(member);
          
          if (mainTab === "ind_kessho" && !isIndividualPassed) return null;

          const currentScore = mainTab === "team_kessho" ? member.results?.kessho : member.results?.yosen;
          const maxScore = mainTab === "team_kessho" ? 2 : 4;
          
          return (
            <div key={member.id} className={`flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 rounded-2xl border ${isWithdrawn ? "bg-gray-100 border-gray-200" : "bg-white shadow-sm border-theme-secondary/10"}`}>
              <div className="flex items-center gap-3 w-full xl:w-auto">
                {group.entry_type === "team" && <span className={`w-12 text-center font-black py-2 rounded-xl text-xs ${isWithdrawn ? "bg-gray-200 text-gray-500" : "bg-theme-primary/10 text-theme-primary"}`}>{member.basic_info?.position || "-"}</span>}
                <div className="min-w-[140px]">
                  <p className="text-[10px] text-gray-500 font-bold">{member.basic_info?.nameKana || "フリガナなし"}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-lg font-black ${isWithdrawn ? "text-gray-500 line-through" : "text-theme-secondary"}`}>{member.basic_info?.name || "名前なし"}</p>
                    {isIndividualPassed && !isWithdrawn && mainTab === "yosen" && <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-300 whitespace-nowrap">👤 個人通過</span>}
                    {member.basic_info?.isSenior && !isWithdrawn && group.entry_type === "team" && <span className="px-1.5 py-0.5 bg-[#D35400]/10 text-[#D35400] border border-[#D35400]/30 rounded text-[10px] font-bold whitespace-nowrap">シニア</span>}
                  </div>
                </div>
                
                {!isWithdrawn && mainTab === "ind_kessho" && (
                  <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 ml-2">
                    予選: {member.results?.yosen ?? "-"} 中
                  </div>
                )}
              </div>

              {!isWithdrawn && (
                <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
                  
                  {(mainTab === "yosen" || mainTab === "team_kessho") && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 whitespace-nowrap hidden sm:block">{mainTab === "yosen" ? "的中数" : "決勝的中"}:</span>
                      <ScoreButtons currentScore={currentScore} maxScore={maxScore} onUpdate={(val) => handlers.handleScoreUpdate(member.id, mainTab, val)} />
                    </div>
                  )}

                  {mainTab === "team_izume" && (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                      <div className="flex items-center gap-1 min-h-[40px] bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                        <span className="text-xs font-bold text-gray-500 mr-2">履歴:</span>
                        {!member.results?.izume || member.results.izume.length === 0 ? (
                          <span className="text-xs text-gray-400 font-bold">未入力</span>
                        ) : (
                          member.results.izume.map((res, i) => <span key={i} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black text-white ${res === "〇" ? "bg-red-500 shadow-sm" : "bg-gray-400"}`}>{res}</span>)
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handlers.handleIzumeAdd(member.id, member.results?.izume || [], "〇")} className="w-12 h-10 sm:w-14 sm:h-12 bg-red-50 border-2 border-red-200 text-red-600 font-black rounded-xl shadow-sm hover:bg-red-100 transition-colors text-lg">〇</button>
                        <button onClick={() => handlers.handleIzumeAdd(member.id, member.results?.izume || [], "✕")} className="w-12 h-10 sm:w-14 sm:h-12 bg-gray-50 border-2 border-gray-300 text-gray-600 font-black rounded-xl shadow-sm hover:bg-gray-100 transition-colors text-lg">✕</button>
                        <button onClick={() => handlers.handleIzumePop(member.id, member.results?.izume || [])} disabled={!member.results?.izume || member.results.izume.length === 0} className="px-3 h-10 sm:h-12 bg-white border-2 border-gray-200 text-gray-500 text-xs font-bold rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors">戻す</button>
                      </div>
                    </div>
                  )}

                  {mainTab === "ind_kessho" && (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 min-h-[36px] bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          <span className="text-[10px] font-bold text-gray-500 mr-1">射詰:</span>
                          {!member.results?.izume || member.results.izume.length === 0 ? (
                            <span className="text-[10px] text-gray-400 font-bold">未入力</span>
                          ) : (
                            member.results.izume.map((res, i) => <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black text-white ${res === "〇" ? "bg-red-500 shadow-sm" : "bg-gray-400"}`}>{res}</span>)
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handlers.handleIzumeAdd(member.id, member.results?.izume || [], "〇")} className="w-10 h-9 sm:w-12 sm:h-10 bg-red-50 border-2 border-red-200 text-red-600 font-black rounded-lg shadow-sm hover:bg-red-100 transition-colors text-base">〇</button>
                          <button onClick={() => handlers.handleIzumeAdd(member.id, member.results?.izume || [], "✕")} className="w-10 h-9 sm:w-12 sm:h-10 bg-gray-50 border-2 border-gray-300 text-gray-600 font-black rounded-lg shadow-sm hover:bg-gray-100 transition-colors text-base">✕</button>
                          <button onClick={() => handlers.handleIzumePop(member.id, member.results?.izume || [])} disabled={!member.results?.izume || member.results.izume.length === 0} className="px-2 h-9 sm:h-10 bg-white border-2 border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors">戻す</button>
                        </div>
                      </div>
                      <div className="hidden sm:block w-px h-10 bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 whitespace-nowrap">遠近:</span>
                        <input type="text" value={member.results?.enkin || ""} onChange={(e) => handlers.handleEnkinUpdate(member.id, e.target.value)} placeholder="例: 1位" className="w-20 p-2 bg-white border-2 border-gray-200 rounded-lg outline-none focus:border-theme-primary text-xs font-bold text-center shadow-inner" />
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}, areGroupsEqual);
GroupCard.displayName = "GroupCard";

export const TeamConfirmTable = React.memo(({ groups }: { groups: EntryGroup[] }) => {
  const rankedGroups = useMemo(() => {
    const result = [];
    let currentRank = 1;
    let previousKessho = -1;
    let previousIzume = -1;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const totalKesshoScore = group.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
      const totalIzumeScore = group.members.reduce((sum, m) => sum + (m.results?.izume?.filter(res => res === "〇").length || 0), 0);

      if (i > 0) {
        if (totalKesshoScore !== previousKessho || totalIzumeScore !== previousIzume) {
          currentRank = i + 1;
        }
      }
      previousKessho = totalKesshoScore;
      previousIzume = totalIzumeScore;

      result.push({ ...group, rank: currentRank, totalKesshoScore, totalIzumeScore });
    }
    return result;
  }, [groups]);

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return <span className="inline-flex items-center justify-center bg-yellow-100 text-yellow-700 border-2 border-yellow-400 px-3 py-1 rounded-xl shadow-sm text-base md:text-lg whitespace-nowrap font-black">🥇 優勝</span>;
    if (rank === 2) return <span className="inline-flex items-center justify-center bg-gray-100 text-gray-600 border-2 border-gray-300 px-3 py-1 rounded-xl shadow-sm text-sm md:text-base whitespace-nowrap font-black">🥈 第2位</span>;
    if (rank === 3) return <span className="inline-flex items-center justify-center bg-[#D35400]/10 text-[#D35400] border-2 border-[#D35400]/30 px-3 py-1 rounded-xl shadow-sm text-sm md:text-base whitespace-nowrap font-black">🥉 第3位</span>;
    return <span className="text-gray-400 font-bold text-lg">{rank}位</span>;
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-theme-secondary/10 overflow-hidden shadow-sm animate-fade-in-up">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-theme-bg/50 border-b-2 border-theme-secondary/10">
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">最終順位</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">立順</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap">チーム名</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">決勝合計</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap">射詰詳細（大前・中・落）</th>
              <th className="p-4 text-theme-primary font-black text-sm whitespace-nowrap text-center">射詰合計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankedGroups.map(group => (
              <tr key={group.entry_group_id} className={`hover:bg-gray-50 transition-colors ${group.rank === 1 ? 'bg-yellow-50/40' : ''}`}>
                <td className="p-4 font-black text-center">{renderRankBadge(group.rank)}</td>
                <td className="p-4 font-black text-theme-secondary text-center">{group.members[0]?.basic_info?.bib_number || "-"}</td>
                <td className="p-4 font-black text-theme-secondary text-lg">{group.team_name}</td>
                <td className="p-4 font-black text-theme-secondary text-center text-xl">{group.totalKesshoScore} 中</td>
                <td className="p-4">
                  <div className="flex gap-4">
                    {group.members.map(m => (
                      <div key={m.id} className="flex items-center gap-1 text-xs">
                        <span className="font-bold text-gray-400">{m.basic_info?.position || "-"}:</span>
                        <span className={`font-black tracking-widest text-base ${m.results?.izume?.length ? "text-theme-secondary" : "text-gray-300"}`}>
                          {m.results?.izume?.length ? m.results.izume.join("") : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-4 font-black text-theme-primary text-center text-2xl bg-theme-primary/5">{group.totalIzumeScore} 中</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
TeamConfirmTable.displayName = "TeamConfirmTable";

export const IndConfirmTable = React.memo(({ groups }: { groups: EntryGroup[] }) => {
  const rankedMembers = useMemo(() => {
    const flatMembers = groups.flatMap(g => g.members.filter(m => checkIndividualYosenPass(m)).map(m => ({
      ...m,
      display_team_name: g.entry_type === "team" ? g.team_name : null
    })));

    const membersData = flatMembers.map(m => {
      const yosenScore = m.results?.yosen || 0;
      const izumeScore = m.results?.izume?.filter(res => res === "〇").length || 0;
      const enkinStr = m.results?.enkin || "";
      const enkinNum = parseInt(enkinStr.replace(/[^0-9]/g, ""), 10);
      const enkinRank = isNaN(enkinNum) ? 999 : enkinNum;

      return { ...m, yosenScore, izumeScore, enkinRank };
    });

    membersData.sort((a, b) => {
      if (a.yosenScore !== b.yosenScore) return b.yosenScore - a.yosenScore;
      if (a.izumeScore !== b.izumeScore) return b.izumeScore - a.izumeScore;
      if (a.enkinRank !== b.enkinRank) return a.enkinRank - b.enkinRank;

      const bibA = parseInt(a.basic_info?.bib_number || "0", 10);
      const bibB = parseInt(b.basic_info?.bib_number || "0", 10);
      return bibA - bibB;
    });

    const result = [];
    let currentRank = 1;
    let prevYosen = -1;
    let prevIzume = -1;
    let prevEnkin = -1;

    for (let i = 0; i < membersData.length; i++) {
      const m = membersData[i];
      if (i > 0) {
        if (m.yosenScore !== prevYosen || m.izumeScore !== prevIzume || m.enkinRank !== prevEnkin) {
          currentRank = i + 1;
        }
      }
      prevYosen = m.yosenScore;
      prevIzume = m.izumeScore;
      prevEnkin = m.enkinRank;

      result.push({ ...m, rank: currentRank });
    }

    return result;
  }, [groups]);

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return <span className="inline-flex items-center justify-center bg-yellow-100 text-yellow-700 border-2 border-yellow-400 px-3 py-1 rounded-xl shadow-sm text-base md:text-lg whitespace-nowrap font-black">🥇 優勝</span>;
    if (rank === 2) return <span className="inline-flex items-center justify-center bg-gray-100 text-gray-600 border-2 border-gray-300 px-3 py-1 rounded-xl shadow-sm text-sm md:text-base whitespace-nowrap font-black">🥈 第2位</span>;
    if (rank === 3) return <span className="inline-flex items-center justify-center bg-[#D35400]/10 text-[#D35400] border-2 border-[#D35400]/30 px-3 py-1 rounded-xl shadow-sm text-sm md:text-base whitespace-nowrap font-black">🥉 第3位</span>;
    return <span className="text-gray-400 font-bold text-lg">{rank}位</span>;
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-theme-secondary/10 overflow-hidden shadow-sm animate-fade-in-up">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-theme-bg/50 border-b-2 border-theme-secondary/10">
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">最終順位</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">立順</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap">氏名</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap text-center">予選的中</th>
              <th className="p-4 text-theme-secondary font-black text-sm whitespace-nowrap">射詰詳細</th>
              <th className="p-4 text-theme-primary font-black text-sm whitespace-nowrap text-center">射詰合計</th>
              <th className="p-4 text-theme-primary font-black text-sm whitespace-nowrap text-center">遠近順位</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankedMembers.map(m => (
              <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${m.rank === 1 ? 'bg-yellow-50/40' : ''}`}>
                <td className="p-4 font-black text-center">{renderRankBadge(m.rank)}</td>
                <td className="p-4 font-black text-theme-secondary text-center">{m.basic_info?.bib_number || "-"}</td>
                <td className="p-4 font-black text-theme-secondary">
                  <div className="text-lg">{m.basic_info?.name}</div>
                  {m.display_team_name && <div className="text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 inline-block mt-1">{m.display_team_name}</div>}
                </td>
                <td className="p-4 font-black text-theme-secondary text-center text-xl">{m.yosenScore} 中</td>
                <td className="p-4 font-black tracking-widest text-base text-theme-secondary">
                  {m.results?.izume?.length ? m.results.izume.join("") : "-"}
                </td>
                <td className="p-4 font-black text-theme-primary text-center text-2xl bg-theme-primary/5">{m.izumeScore} 中</td>
                <td className="p-4 font-black text-theme-secondary text-center text-lg">{m.results?.enkin || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
IndConfirmTable.displayName = "IndConfirmTable";