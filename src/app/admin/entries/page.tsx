"use client";

import React, { useState } from "react";
import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";

// --- 分離したコンポーネントとフックをインポート ---
import EntryEditModal from "@/components/admin/EntryEditModal";
import EntryCard from "@/components/admin/EntryCard";
import { useEntries, EntryGroup } from "@/hooks/useEntries";

export default function AdminEntriesPage() {
  // UIの表示状態（タブ、トースト、モーダル）だけをここで管理します
  const [activeTab, setActiveTab] = useState<"entries" | "bibs">("entries");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editingGroup, setEditingGroup] = useState<EntryGroup | null>(null);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- カスタムフックを利用して、データと処理のロジックを裏側から引っ張ってくる ---
  const {
    groupedEntries,
    isLoading,
    isSendingQR,
    approvePayment,
    updateBibNumber,
    sendQRCode
  } = useEntries(showToast);

  const openEditModal = (group: EntryGroup) => setEditingGroup(group);
  const closeEditModal = () => setEditingGroup(null);

  // 重複チェック用の関数（これはUI表示に直結するため残しています）
  const getAllBibNumbers = () => {
    const bibs: string[] = [];
    groupedEntries.forEach(group => {
      const bib = group.members[0]?.basic_info?.bib_number;
      if (bib && bib.trim() !== "") bibs.push(bib.trim());
    });
    return bibs;
  };

  const allBibs = getAllBibNumbers();
  const getIsDuplicate = (bib: string | undefined) => {
    if (!bib || bib.trim() === "") return false;
    return allBibs.filter(b => b === bib.trim()).length > 1;
  };

  const renderTabContent = (isBibMode: boolean) => {
    const targetGroups = isBibMode 
      ? groupedEntries.filter(g => g.payment_info.status === "approved")
      : groupedEntries;
      
    const teamGroups = targetGroups.filter(g => g.entry_type === "team");
    const individualGroups = targetGroups.filter(g => g.entry_type === "individual");

    if (targetGroups.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-theme-secondary/20 font-bold">
          {isBibMode ? "承認済みのエントリーがありません。" : "エントリーがありません。"}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h2 className="text-xl font-black text-[#8B1500] border-b-4 border-[#8B1500]/20 pb-2 mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span> 団体の部
          </h2>
          {teamGroups.length > 0 ? (
            teamGroups.map(group => (
              <EntryCard
                key={group.entry_group_id}
                group={group as any} // コンポーネント側の型定義との整合性用
                activeTab={activeTab}
                isDuplicate={getIsDuplicate(group.members[0]?.basic_info?.bib_number)}
                isSendingQR={isSendingQR === group.entry_group_id}
                onOpenEditModal={openEditModal}
                onApprovePayment={approvePayment}
                onUpdateBibNumber={updateBibNumber}
                onSendQRCode={sendQRCode}
              />
            ))
          ) : (
            <p className="text-center py-8 bg-white/50 rounded-2xl border border-dashed border-theme-secondary/20 font-bold text-theme-secondary/60">
              団体のエントリーはありません
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-black text-[#D35400] border-b-4 border-[#D35400]/20 pb-2 mb-4 flex items-center gap-2">
            <span className="text-2xl">👤</span> 個人の部
          </h2>
          {individualGroups.length > 0 ? (
            individualGroups.map(group => (
              <EntryCard
                key={group.entry_group_id}
                group={group as any}
                activeTab={activeTab}
                isDuplicate={getIsDuplicate(group.members[0]?.basic_info?.bib_number)}
                isSendingQR={isSendingQR === group.entry_group_id}
                onOpenEditModal={openEditModal}
                onApprovePayment={approvePayment}
                onUpdateBibNumber={updateBibNumber}
                onSendQRCode={sendQRCode}
              />
            ))
          ) : (
            <p className="text-center py-8 bg-white/50 rounded-2xl border border-dashed border-theme-secondary/20 font-bold text-theme-secondary/60">
              個人のエントリーはありません
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-20">
      <Header title="大会管理ページ" subtitle="エントリー・立順管理" isAdmin={true} />

      <main className="max-w-[1600px] mx-auto mt-8 px-4 md:px-8 relative">
        
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={() => setActiveTab("entries")}
            className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${
              activeTab === "entries"
                ? "bg-theme-primary text-white shadow-[0_6px_0_0_rgba(139,21,0,1)] translate-y-0"
                : "bg-white text-theme-secondary/60 border-2 border-theme-secondary/20 shadow-none translate-y-[6px] hover:bg-theme-secondary/5"
            }`}
          >
            📋 エントリー管理
          </button>
          <button
            onClick={() => setActiveTab("bibs")}
            className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${
              activeTab === "bibs"
                ? "bg-theme-accent text-white shadow-[0_6px_0_0_rgba(200,100,0,1)] translate-y-0"
                : "bg-white text-theme-secondary/60 border-2 border-theme-secondary/20 shadow-none translate-y-[6px] hover:bg-theme-secondary/5"
            }`}
          >
            🔢 立順設定 (入金済のみ)
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 font-bold text-xl animate-pulse">データを読み込み中...</div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            {activeTab === "entries" && (
              <>
                <p className="font-bold text-theme-secondary/80 px-2">
                  全エントリーを表示しています。カード右上の「✏️編集」から登録情報の修正が可能です。
                </p>
                {renderTabContent(false)}
              </>
            )}

            {activeTab === "bibs" && (
              <>
                <p className="font-bold text-theme-secondary/80 px-2 flex items-center gap-2">
                  <span>💡</span>
                  立順を入力・保存後、「受付票を送信」ボタンで参加者にQRコード付きのメールを送ることができます。
                </p>
                {renderTabContent(true)}
              </>
            )}
          </div>
        )}
      </main>

      <EntryEditModal 
        group={editingGroup as any} 
        onClose={closeEditModal} 
        showToast={showToast} 
      />

      <Toast message={toastMessage} />
    </div>
  );
}