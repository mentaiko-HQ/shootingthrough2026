// src/app/results/components.tsx

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
          <div className="bg-red-50 border-2 border-red-200 p-4 md:p-6 rounded-[24px] max-w-lg w-full shadow-sm">
            <h2 className="text-red-700 font-black text-lg md:text-xl mb-2">システムエラーが発生しました</h2>
            <p className="text-red-600 font-bold text-xs md:text-sm mb-4">画面の表示中に問題が発生しました。リロードをお試しください。</p>
            <details className="bg-white p-2 md:p-3 rounded-xl border border-red-100">
              <summary className="text-[10px] md:text-xs font-bold text-red-500 cursor-pointer outline-none hover:opacity-70">エラー詳細を表示</summary>
              <pre className="text-[8px] md:text-[10px] text-red-400 mt-2 whitespace-pre-wrap overflow-auto max-h-40">{this.state.error?.stack || this.state.error?.message}</pre>
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

const areGroupsEqual = (prevProps: GroupCardProps, nextProps: GroupCardProps) => {
  return prevProps.mainTab === nextProps.mainTab && JSON.stringify(prevProps.group) === JSON.stringify(nextProps.group);
};

export const GroupCard = React.memo(({ group, mainTab }: GroupCardProps) => {
  const isGroupWithdrawn = group.members.every(m => m.status?.is_withdrawn);
  const bib = group.members[0]?.basic_info?.bib_number;
  const name = group.entry_type === "team" ? group.team_name : group.members[0]?.basic_info?.name;

  const activeMembers = group.members.filter(m => !m.status?.is_withdrawn);
  const statuses = activeMembers.map(m => m.status?.call_status || "waiting");
  const overallStatus = statuses.includes("shooting") ? "shooting" 
                      : statuses.includes("calling") ? "calling" 
                      : "waiting";

  const cardClass = isGroupWithdrawn
    ? "bg-gray-100 border-gray-200 opacity-70"
    : "bg-white border-theme-secondary/10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:border-theme-secondary/30";

  const totalYosenScore = group.members.reduce((sum, m) => sum + (m.results?.yosen || 0), 0);
  const totalKesshoScore = group.members.reduce((sum, m) => sum + (m.results?.kessho || 0), 0);
  const totalIzumeScore = group.members.reduce((sum, m) => sum + (m.results?.izume?.filter(res => res === "〇").length || 0), 0);

  const isTeamPassed = mainTab === "yosen" && checkYosenPass(group);

  return (
    <div className={`p-4 md:p-5 rounded-[24px] border transition-all ${cardClass}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-theme-secondary/5 pb-4 mb-4 gap-3 md:gap-4">
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`px-2 py-1 md:px-4 md:py-2 rounded-[16px] text-center min-w-[50px] md:min-w-[70px] border ${isGroupWithdrawn ? "bg-gray-200 border-gray-300" : "bg-theme-bg border-theme-secondary/10"}`}>
            <span className="block text-[8px] md:text-[10px] font-bold opacity-60 leading-none mb-0.5">立順</span>
            <span className={`block text-lg md:text-xl font-black leading-none ${isGroupWithdrawn ? "text-gray-500" : "text-theme-primary"}`}>{bib || "-"}</span>
          </div>
          <div>
            <p className="text-[8px] md:text-[10px] font-bold text-gray-500 mb-0.5 leading-none">{group.division}</p>
            <h3 className={`text-base md:text-xl font-black flex items-center gap-1.5 md:gap-2 flex-wrap ${isGroupWithdrawn ? "text-gray-500 line-through" : "text-theme-secondary"}`}>
              {name}
              
              <span className={`px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold ${isGroupWithdrawn ? "bg-gray-400 text-white" : "bg-theme-secondary/10 text-theme-secondary"}`}>
                {group.entry_type === "team" ? "団体" : "個人"}
              </span>

              {isGroupWithdrawn ? (
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-bold bg-gray-200 text-gray-500 border border-gray-300">棄権</span>
              ) : overallStatus === "shooting" ? (
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black bg-theme-primary text-white shadow-sm flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full"></span>行射中
                </span>
              ) : overallStatus === "calling" ? (
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black bg-yellow-400 text-yellow-900 shadow-sm flex items-center gap-1.5 animate-pulse">
                  📢 呼出中
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-bold bg-theme-bg text-theme-secondary/60 border border-theme-secondary/10">
                  待機
                </span>
              )}

              {isTeamPassed && !isGroupWithdrawn && <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-bold bg-green-100 text-green-700 border border-green-300">🎉 団体通過</span>}
            </h3>
          </div>
        </div>
        
        {!isGroupWithdrawn && mainTab !== "ind_kessho" && group.entry_type === "team" && (
          <div className="w-full sm:w-auto text-right bg-theme-bg/50 px-4 py-2 md:px-5 md:py-2.5 rounded-[16px] border border-theme-secondary/5 shadow-inner flex items-center justify-between sm:justify-end gap-2 md:gap-3">
            <span className="block text-[10px] md:text-xs font-bold text-theme-secondary/60">{mainTab === "yosen" ? "予選合計" : mainTab === "team_izume" ? "射詰合計" : "決勝合計"}</span>
            <span className="text-xl md:text-2xl font-black text-theme-primary tracking-tighter">{mainTab === "yosen" ? totalYosenScore : mainTab === "team_izume" ? totalIzumeScore : totalKesshoScore} <span className="text-xs md:text-sm font-bold">中</span></span>
          </div>
        )}
      </div>

      <div className="space-y-2 md:space-y-3">
        {group.members.map((member) => {
          const isWithdrawn = !!member.status?.is_withdrawn;
          const isIndividualPassed = checkIndividualYosenPass(member);
          const callStatus = member.status?.call_status || "waiting";
          
          if (mainTab === "ind_kessho" && !isIndividualPassed) return null;

          const currentScore = mainTab === "team_kessho" ? member.results?.kessho : member.results?.yosen;
          
          return (
            <div key={member.id} className={`flex flex-row items-center justify-between gap-2 p-2 md:p-3 rounded-[16px] border ${isWithdrawn ? "bg-gray-100 border-gray-200" : "bg-white shadow-sm border-theme-secondary/5 hover:bg-gray-50/50"}`}>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {group.entry_type === "team" && <span className={`flex-shrink-0 w-8 md:w-10 text-center font-black py-1 md:py-1.5 rounded-xl text-[10px] md:text-xs ${isWithdrawn ? "bg-gray-200 text-gray-500" : "bg-theme-primary/5 text-theme-primary"}`}>{member.basic_info?.position || "-"}</span>}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[8px] md:text-[10px] text-gray-400 font-bold truncate leading-none mb-0.5">{member.basic_info?.nameKana || "フリガナなし"}</p>
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm md:text-base font-black truncate max-w-[100px] sm:max-w-none ${isWithdrawn ? "text-gray-500 line-through" : "text-theme-secondary"}`}>{member.basic_info?.name || "名前なし"}</p>
                    
                    {!isWithdrawn && callStatus === "shooting" && (
                      <span className="text-[10px] md:text-xs font-bold text-theme-primary bg-theme-primary/10 px-2 py-1 rounded-full shrink-0">行射中</span>
                    )}
                    {!isWithdrawn && callStatus === "calling" && (
                      <span className="text-[10px] md:text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full shrink-0">呼出中</span>
                    )}

                    {isIndividualPassed && !isWithdrawn && mainTab === "yosen" && <span className="flex-shrink-0 text-[10px] md:text-xs font-black text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-300 whitespace-nowrap">👤 個人通過</span>}
                    {member.basic_info?.isSenior && !isWithdrawn && group.entry_type === "team" && <span className="flex-shrink-0 px-2 py-1 bg-[#D35400]/10 text-[#D35400] border border-[#D35400]/20 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap">シニア</span>}
                  </div>
                </div>
                
                {!isWithdrawn && mainTab === "ind_kessho" && (
                  <div className="flex-shrink-0 bg-theme-bg px-2 py-1 rounded-lg border border-theme-secondary/10 text-[10px] md:text-xs font-bold text-theme-secondary/70 whitespace-nowrap">
                    予選: {member.results?.yosen ?? "-"} 中
                  </div>
                )}
              </div>

              {!isWithdrawn && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  
                  {(mainTab === "yosen" || mainTab === "team_kessho") && (
                    <div className="bg-theme-bg px-2 py-1 md:px-3 md:py-1.5 rounded-xl border border-theme-secondary/10 min-w-[40px] md:min-w-[60px] text-center flex items-baseline justify-center gap-0.5 md:gap-1">
                      <span className="text-sm md:text-lg font-black text-theme-secondary leading-none">{currentScore ?? "-"}</span>
                      <span className="text-[8px] md:text-[10px] font-bold text-theme-secondary/40">中</span>
                    </div>
                  )}

                  {mainTab === "team_izume" && (
                    <div className="bg-theme-bg px-2 py-1 md:px-3 md:py-1.5 rounded-xl border border-theme-secondary/10 flex items-center gap-1 md:gap-2">
                      <span className="text-[8px] md:text-[10px] font-bold text-theme-secondary/50 hidden sm:block">射詰</span>
                      <div className="flex items-center gap-0.5 md:gap-1 min-h-[16px] md:min-h-[24px]">
                        {!member.results?.izume || member.results.izume.length === 0 ? (
                          <span className="text-[10px] md:text-xs text-theme-secondary/40 font-bold">未</span>
                        ) : (
                          member.results.izume.map((res, i) => <span key={i} className={`w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full text-[8px] md:text-[10px] font-black text-white ${res === "〇" ? "bg-red-500 shadow-sm" : "bg-gray-400"}`}>{res}</span>)
                        )}
                      </div>
                    </div>
                  )}

                  {mainTab === "ind_kessho" && (
                    <div className="flex items-center gap-1 md:gap-2 bg-theme-bg/50 p-1 md:p-1.5 rounded-xl border border-theme-secondary/5">
                      <div className="bg-white px-1.5 md:px-2 py-1 rounded-lg border border-theme-secondary/10 shadow-sm flex items-center gap-1 md:gap-2">
                        <span className="text-[8px] md:text-[10px] font-bold text-theme-secondary/50 hidden sm:inline">射詰</span>
                        <div className="flex items-center gap-0.5 md:gap-1 min-h-[16px] md:min-h-[20px]">
                          {!member.results?.izume || member.results.izume.length === 0 ? (
                            <span className="text-[8px] md:text-[10px] text-theme-secondary/40 font-bold">未</span>
                          ) : (
                            member.results.izume.map((res, i) => <span key={i} className={`w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full text-[8px] md:text-[10px] font-black text-white ${res === "〇" ? "bg-red-500 shadow-sm" : "bg-gray-400"}`}>{res}</span>)
                          )}
                        </div>
                      </div>
                      <div className="w-px h-4 md:h-6 bg-theme-secondary/10"></div>
                      <div className="bg-white px-1.5 md:px-2 py-1 rounded-lg border border-theme-secondary/10 shadow-sm min-w-[30px] md:min-w-[40px] text-center">
                        <span className="block text-[8px] md:text-[10px] font-bold text-theme-secondary/50 leading-none mb-0.5">遠近</span>
                        <span className="text-xs md:text-sm font-black text-theme-secondary leading-none">{member.results?.enkin || "-"}</span>
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
    if (rank === 1) return <span className="inline-flex items-center justify-center bg-yellow-100 text-yellow-700 border border-yellow-400 px-2 py-0.5 rounded-lg shadow-sm text-xs md:text-sm whitespace-nowrap font-black">🥇 優勝</span>;
    if (rank === 2) return <span className="inline-flex items-center justify-center bg-gray-100 text-gray-600 border border-gray-300 px-2 py-0.5 rounded-lg shadow-sm text-[10px] md:text-xs whitespace-nowrap font-black">🥈 第2位</span>;
    if (rank === 3) return <span className="inline-flex items-center justify-center bg-[#D35400]/10 text-[#D35400] border border-[#D35400]/30 px-2 py-0.5 rounded-lg shadow-sm text-[10px] md:text-xs whitespace-nowrap font-black">🥉 第3位</span>;
    return <span className="text-gray-400 font-bold text-xs md:text-sm">{rank}位</span>;
  };

  return (
    <div className="bg-white rounded-xl md:rounded-[24px] border border-theme-secondary/10 overflow-hidden shadow-sm animate-fade-in-up">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-[800px]">
          <thead>
            <tr className="bg-theme-bg/50 border-b border-theme-secondary/10">
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">順位</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">立順</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap">チーム名</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">決勝合計</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap">射詰詳細（大前・中・落）</th>
              <th className="p-2 md:p-3 text-theme-primary font-black text-[10px] md:text-sm whitespace-nowrap text-center">射詰合計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankedGroups.map(group => (
              <tr key={group.entry_group_id} className={`hover:bg-gray-50 transition-colors ${group.rank === 1 ? 'bg-yellow-50/40' : ''}`}>
                <td className="p-2 md:p-3 font-black text-center">{renderRankBadge(group.rank)}</td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-center text-xs md:text-sm">{group.members[0]?.basic_info?.bib_number || "-"}</td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-xs md:text-sm max-w-[150px] truncate" title={group.team_name}>{group.team_name}</td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-center text-sm md:text-base">{group.totalKesshoScore} <span className="text-[10px] font-normal">中</span></td>
                <td className="p-2 md:p-3">
                  <div className="flex gap-2 md:gap-4 flex-wrap">
                    {group.members.map(m => (
                      <div key={m.id} className="flex items-center gap-1 text-[10px] md:text-xs">
                        <span className="font-bold text-gray-400">{m.basic_info?.position || "-"}:</span>
                        <span className={`font-black tracking-widest ${m.results?.izume?.length ? "text-theme-secondary" : "text-gray-300"}`}>
                          {m.results?.izume?.length ? m.results.izume.join("") : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2 md:p-3 font-black text-theme-primary text-center text-base md:text-lg bg-theme-primary/5">{group.totalIzumeScore} <span className="text-[10px] font-normal">中</span></td>
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
    if (rank === 1) return <span className="inline-flex items-center justify-center bg-yellow-100 text-yellow-700 border border-yellow-400 px-2 py-0.5 rounded-lg shadow-sm text-xs md:text-sm whitespace-nowrap font-black">🥇 優勝</span>;
    if (rank === 2) return <span className="inline-flex items-center justify-center bg-gray-100 text-gray-600 border border-gray-300 px-2 py-0.5 rounded-lg shadow-sm text-[10px] md:text-xs whitespace-nowrap font-black">🥈 第2位</span>;
    if (rank === 3) return <span className="inline-flex items-center justify-center bg-[#D35400]/10 text-[#D35400] border border-[#D35400]/30 px-2 py-0.5 rounded-lg shadow-sm text-[10px] md:text-xs whitespace-nowrap font-black">🥉 第3位</span>;
    return <span className="text-gray-400 font-bold text-xs md:text-sm">{rank}位</span>;
  };

  return (
    <div className="bg-white rounded-xl md:rounded-[24px] border border-theme-secondary/10 overflow-hidden shadow-sm animate-fade-in-up">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-[800px]">
          <thead>
            <tr className="bg-theme-bg/50 border-b border-theme-secondary/10">
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">順位</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">立順</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap">氏名</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap text-center">予選的中</th>
              <th className="p-2 md:p-3 text-theme-secondary font-black text-[10px] md:text-sm whitespace-nowrap">射詰詳細</th>
              <th className="p-2 md:p-3 text-theme-primary font-black text-[10px] md:text-sm whitespace-nowrap text-center">射詰合計</th>
              <th className="p-2 md:p-3 text-theme-primary font-black text-[10px] md:text-sm whitespace-nowrap text-center">遠近</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankedMembers.map(m => (
              <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${m.rank === 1 ? 'bg-yellow-50/40' : ''}`}>
                <td className="p-2 md:p-3 font-black text-center">{renderRankBadge(m.rank)}</td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-center text-xs md:text-sm">{m.basic_info?.bib_number || "-"}</td>
                <td className="p-2 md:p-3 font-black text-theme-secondary">
                  <div className="text-xs md:text-base">{m.basic_info?.name}</div>
                  {m.display_team_name && <div className="text-[8px] md:text-[10px] text-gray-500 font-bold bg-gray-100 px-1 py-0.5 rounded border border-gray-200 inline-block mt-0.5 truncate max-w-[100px]">{m.display_team_name}</div>}
                </td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-center text-sm md:text-base">{m.yosenScore} <span className="text-[10px] font-normal">中</span></td>
                <td className="p-2 md:p-3 font-black tracking-widest text-xs md:text-sm text-theme-secondary">
                  {m.results?.izume?.length ? m.results.izume.join("") : "-"}
                </td>
                <td className="p-2 md:p-3 font-black text-theme-primary text-center text-base md:text-lg bg-theme-primary/5">{m.izumeScore} <span className="text-[10px] font-normal">中</span></td>
                <td className="p-2 md:p-3 font-black text-theme-secondary text-center text-xs md:text-sm">{m.results?.enkin || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
IndConfirmTable.displayName = "IndConfirmTable";