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
        <div className="min-h-screen bg-white flex items-center justify-center p-4 print:hidden">
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-600 max-w-lg w-full">
            <h2 className="font-bold mb-2">野帳データの読み込みに失敗しました</h2>
            <pre className="text-xs overflow-auto whitespace-pre-wrap max-h-40">{this.state.error?.message}</pre>
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
    rank: string;
    team_name: string;
  };
  payment_info?: { status: "pending" | "approved" };
  status?: {
    is_checked_in?: boolean;
    qr_sent_at?: unknown;
    call_status?: CallStatus;
    is_withdrawn?: boolean;
    is_substituted?: boolean;
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
// 3. メインコンポーネント（野帳印刷専用レイアウト）
// ============================================================================
function YachoPrintContent() {
  const [groupedEntries, setGroupedEntries] = useState<EntryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLog, setErrorLog] = useState<string | null>(null);

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
            
            if (!isNaN(numA) && !isNaN(numB)) {
              if (numA !== numB) return numA - numB;
            }
            return bibA.localeCompare(bibB);
          });

          setGroupedEntries(groupsArray);
          setIsLoading(false);
          setErrorLog(null);

        } catch (error) {
          const err = error as Error;
          console.error("❌ 印刷用データの解析エラー:", err);
          setErrorLog(`データの解析に失敗しました: ${err.message}`);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("❌ Firestore取得エラー:", error);
        setErrorLog(`通信エラーが発生しました: ${error.message}`);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-10 text-center font-bold text-gray-500">印刷用データを生成中...</div>;
  }

  if (errorLog) {
    return <div className="p-10 text-center font-bold text-red-500">{errorLog}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white font-sans text-black">
      {/* 🌟 印刷用のグローバルスタイル（A4マージン最適化と背景色印刷の強制） */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm; /* 余白を限界まで削る */
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}} />
      
      {/* === 画面上部のコントロールパネル（印刷時は非表示） === */}
      <div className="bg-white p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 print:hidden sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black text-gray-800">バックアップ用 野帳（紙記録）の出力</h1>
          <p className="text-xs text-gray-500 mt-1">
            万が一のシステム障害に備えて、大会開始前にこの画面からPDFとして保存、または印刷を行ってください。<br/>
            <span className="text-red-600 font-bold">※1ページに36名（12チーム）収まるように設計されています。印刷時は「PDFに保存」を選択してください。</span>
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-colors flex items-center gap-2"
        >
          <span>🖨️</span> PDF保存 / 印刷する
        </button>
      </div>

      {/* === 印刷される野帳（テーブル）本体 === */}
      {/* 印刷時に余白を極限まで詰める */}
      <div className="w-full max-w-[210mm] mx-auto bg-white p-4 print:p-0 print:m-0 print:max-w-none">
        
        {/* ヘッダー部分（高さ圧縮） */}
        <div className="flex justify-between items-end mb-2 border-b-2 border-black pb-1">
          <h2 className="text-lg print:text-base font-black tracking-widest">大会記録 野帳（予選）</h2>
          <div className="text-[10px] print:text-[9px] font-bold flex gap-4">
            <span>記録者サイン：_______________________</span>
          </div>
        </div>

        {/* 記録テーブル（1行の高さを限界まで圧縮） */}
        <table className="w-full border-collapse border border-black text-xs print:text-[10px]">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-100">
              <th className="border border-black px-1 py-1 w-8 text-center whitespace-nowrap">立順</th>
              <th className="border border-black px-1 py-1 w-[35%] text-left">区分 / チーム名</th>
              <th className="border border-black px-1 py-1 w-10 text-center whitespace-nowrap">射順</th>
              <th className="border border-black px-1 py-1 text-left">選手氏名</th>
              <th className="border border-black px-1 py-1 w-16 text-center whitespace-nowrap">個人<br/>的中</th>
              <th className="border border-black px-1 py-1 w-16 text-center whitespace-nowrap">チーム<br/>合計</th>
            </tr>
          </thead>
          <tbody>
            {groupedEntries.map((group) => (
              <React.Fragment key={group.entry_group_id}>
                {group.members.map((member, index) => {
                  const isFirstRow = index === 0;
                  const rowSpan = group.members.length;
                  const isWithdrawn = !!member.status?.is_withdrawn;

                  return (
                    <tr key={member.id} className="print:break-inside-avoid">
                      
                      {/* 立順とチーム名はチームの最初の行（大前）でのみ表示し、縦に結合する */}
                      {isFirstRow && (
                        <>
                          <td rowSpan={rowSpan} className="border border-black px-1 py-0.5 text-center font-black text-sm print:text-xs align-middle">
                            {member.basic_info?.bib_number || "-"}
                          </td>
                          <td rowSpan={rowSpan} className="border border-black px-1 py-0.5 align-middle leading-none">
                            <div className="text-[8px] print:text-[7px] text-gray-600 mb-0.5">{group.division}</div>
                            <div className="font-bold text-sm print:text-xs truncate max-w-[160px]">
                              {group.entry_type === "team" ? group.team_name : "個人参加"}
                            </div>
                            {group.members.every(m => m.status?.is_withdrawn) && (
                              <div className="text-[8px] font-bold text-red-600 mt-0.5">【チーム棄権】</div>
                            )}
                          </td>
                        </>
                      )}

                      {/* 選手個別のデータ */}
                      <td className="border border-black px-1 py-1 print:py-0.5 text-center text-[10px] print:text-[9px]">
                        {group.entry_type === "team" ? member.basic_info?.position : "-"}
                      </td>
                      <td className="border border-black px-1 py-1 print:py-0.5 text-sm print:text-xs leading-none">
                        <div className="flex items-center gap-1">
                          <span className={`${isWithdrawn ? "text-gray-400 line-through" : "font-bold"} truncate max-w-[120px]`}>
                            {member.basic_info?.name}
                          </span>
                          {isWithdrawn && <span className="text-[8px] font-bold text-red-600 whitespace-nowrap">（棄権）</span>}
                        </div>
                      </td>

                      {/* 個人的中数の記入マス（高さを確保しつつ全体のバランスを取る） */}
                      <td className="border border-black px-1 py-1 print:py-0.5 text-center align-middle">
                        <div className="h-4 print:h-3"></div> {/* 手書き用の最低高さを確保 */}
                      </td>

                      {/* チーム合計の記入マス（縦結合） */}
                      {isFirstRow && (
                        <td rowSpan={rowSpan} className="border border-black px-1 py-1 print:py-0.5 align-bottom text-right font-bold bg-gray-50 print:bg-gray-50">
                           <span className="text-[9px] print:text-[8px] text-gray-500">/ {rowSpan * 4}</span>
                        </td>
                      )}

                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* 印刷用のフッターメモ（コンパクト化） */}
        <div className="mt-2 text-[10px] print:text-[8px] text-gray-600 print:block leading-tight">
          <h4 className="font-bold inline-block mr-2">【記入上の注意】</h4>
          <span className="inline-block mr-2">※この用紙の記録を正とし、システムへの入力はこれを転記します。</span>
          <span className="inline-block mr-2">※「個人的中数」欄に的中した本数（0〜4）をアラビア数字で記入してください。</span>
          <span className="inline-block">※棄権選手は斜線を引くか「棄権」と記載してください。</span>
        </div>

      </div>
    </div>
  );
}

export default function YachoPrintPage() {
  return (
    <ErrorBoundary>
      <YachoPrintContent />
    </ErrorBoundary>
  );
}