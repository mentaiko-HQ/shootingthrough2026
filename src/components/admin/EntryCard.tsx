"use client";

import React from "react";
import BibInput from "@/components/admin/BibInput";

type ParticipantDoc = {
  id: string;
  entry_group_id?: string;
  applicant_info?: { name: string; phone: string; email: string };
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
  payment_info?: { proof_url: string; status: "pending" | "approved" };
  notes?: string;
  status?: {
    is_checked_in?: boolean;
    qr_sent_at?: any;
  };
};

export type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  applicant_info: { name: string; phone: string; email: string };
  payment_info: { proof_url: string; status: "pending" | "approved" };
  members: ParticipantDoc[];
};

type EntryCardProps = {
  group: EntryGroup;
  activeTab: "entries" | "bibs";
  isDuplicate: boolean;
  isSendingQR: boolean;
  onOpenEditModal: (group: EntryGroup) => void;
  onApprovePayment: (group: EntryGroup) => void;
  onUpdateBibNumber: (group: EntryGroup, newBibNumber: string) => void;
  onSendQRCode: (group: EntryGroup) => void;
};

export default function EntryCard({
  group,
  activeTab,
  isDuplicate,
  isSendingQR,
  onOpenEditModal,
  onApprovePayment,
  onUpdateBibNumber,
  onSendQRCode
}: EntryCardProps) {
  const isQrSent = group.members[0]?.status?.qr_sent_at !== undefined;

  return (
    <div className="bg-white p-5 rounded-3xl shadow-[0_4px_0_0_rgba(80,35,20,0.1)] border-2 border-theme-secondary/10 mb-6 transition-all hover:border-theme-secondary/30 relative">
      
      {activeTab === "entries" && (
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={() => onOpenEditModal(group)}
            className="text-xs font-bold px-3 py-1.5 bg-gray-100 hover:bg-theme-secondary hover:text-white text-theme-secondary/60 rounded-lg transition-colors flex items-center gap-1 border border-gray-200"
          >
            <span>✏️</span>編集
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b-2 border-theme-secondary/10 pb-4 mb-4 gap-4 pr-16">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${group.entry_type === "team" ? "bg-[#8B1500]" : "bg-[#D35400]"}`}>
              {group.entry_type === "team" ? "団体戦" : "個人戦"}
            </span>
            <span className="text-sm font-bold text-theme-secondary/60">{group.division}</span>
            {activeTab === "entries" && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${group.payment_info.status === "approved" ? "bg-green-100 text-green-800 border border-green-300" : "bg-yellow-100 text-yellow-800 border border-yellow-300"}`}>
                {group.payment_info.status === "approved" ? "承認済" : "入金確認待"}
              </span>
            )}
            {activeTab === "bibs" && isQrSent && (
              <span className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 rounded-full text-xs font-bold flex items-center gap-1">
                <span>✅</span>受付票 送信済
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-theme-secondary leading-tight">
            {group.entry_type === "team" ? group.team_name : (group.members[0].basic_info?.name || "名前不明")}
          </h3>
        </div>

        {activeTab === "entries" && (
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
            <div className="text-left xl:text-right text-xs bg-theme-bg/50 p-3 rounded-xl w-full xl:w-auto space-y-1">
              <p className="font-bold text-theme-secondary/80 text-sm">担当: {group.applicant_info.name}</p>
              <a href={`tel:${group.applicant_info.phone}`} className="block text-theme-secondary/70 hover:text-theme-primary transition-colors flex items-center xl:justify-end gap-1">
                <span>📞</span> {group.applicant_info.phone}
              </a>
              <a href={`mailto:${group.applicant_info.email}`} className="block text-theme-secondary/70 hover:text-theme-primary transition-colors flex items-center xl:justify-end gap-1 break-all">
                <span>✉️</span> {group.applicant_info.email}
              </a>
            </div>
            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
              {group.payment_info.proof_url ? (
                <a href={group.payment_info.proof_url} target="_blank" rel="noopener noreferrer" className="flex-1 xl:flex-none text-center px-3 py-2 bg-theme-bg border-2 border-theme-secondary/20 rounded-xl font-bold text-xs hover:bg-theme-secondary/10 transition-colors">
                  証明書
                </a>
              ) : (
                <span className="flex-1 xl:flex-none text-center px-3 py-2 bg-gray-100 text-gray-400 border-2 border-gray-200 rounded-xl font-bold text-xs">画像なし</span>
              )}
              
              {group.payment_info.status === "pending" && (
                <button onClick={() => onApprovePayment(group)} className="flex-1 xl:flex-none px-3 py-2 bg-theme-primary text-white rounded-xl font-bold text-xs shadow-[0_4px_0_0_rgba(139,21,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(139,21,0,1)] transition-all">
                  承認する
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "bibs" && (
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full xl:w-auto mt-2 xl:mt-0">
            
            <div className="w-full xl:w-32 flex-shrink-0 relative group">
              <label className="block text-[10px] font-bold mb-1 text-theme-secondary/80">
                {group.entry_type === "team" ? "チーム立順" : "ゼッケン"}
              </label>
              <BibInput
                initialValue={group.members[0]?.basic_info?.bib_number || ""}
                isDuplicate={isDuplicate}
                onSave={(newValue) => onUpdateBibNumber(group, newValue)}
              />
              {isDuplicate && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-md pointer-events-none">
                  重複!
                </span>
              )}
            </div>

            <button 
              onClick={() => onSendQRCode(group)}
              disabled={!group.members[0]?.basic_info?.bib_number || isSendingQR}
              className={`w-full xl:w-auto mt-2 xl:mt-0 px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                !group.members[0]?.basic_info?.bib_number
                  ? "bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed"
                  : isQrSent
                    ? "bg-white text-theme-secondary border-2 border-theme-secondary/30 hover:border-theme-primary hover:text-theme-primary"
                    : "bg-theme-accent text-white shadow-[0_4px_0_0_rgba(200,100,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(200,100,0,1)]"
              }`}
            >
              {isSendingQR ? (
                <span className="animate-pulse">⏳ 送信中...</span>
              ) : (
                <><span>📱</span> {isQrSent ? "受付票を再送" : "受付票を送信"}</>
              )}
            </button>

          </div>
        )}
      </div>

      <div className="space-y-3">
        {group.members.map((member) => {
          return (
            <div key={member.id} className="flex flex-col xl:flex-row items-start xl:items-center gap-3 p-3 bg-theme-bg/30 rounded-2xl border border-theme-secondary/10 hover:bg-theme-bg/50 transition-colors">
              <div className="flex items-center gap-3 w-full xl:w-auto xl:min-w-[160px]">
                {group.entry_type === "team" && (
                  <span className="w-10 text-center font-black text-theme-primary bg-theme-primary/10 py-1 rounded-lg text-sm">
                    {member.basic_info?.position || "-"}
                  </span>
                )}
                <div>
                  <p className="text-[10px] text-theme-secondary/60 font-bold">{member.basic_info?.nameKana || "フリガナなし"}</p>
                  <p className="text-base font-black">{member.basic_info?.name || "名前なし"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full xl:flex-1">
                <span className="px-2 py-1 bg-white border border-theme-secondary/20 rounded-md text-xs font-bold">{member.basic_info?.gender || "-"}</span>
                <span className="px-2 py-1 bg-white border border-theme-secondary/20 rounded-md text-xs font-bold">{member.basic_info?.rank || "-"}</span>
                {member.basic_info?.isSenior && (
                  <span className="px-2 py-1 bg-[#D35400]/10 text-[#D35400] border border-[#D35400]/30 rounded-md text-xs font-bold">シニア</span>
                )}
                {member.notes && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold truncate max-w-[150px]" title={member.notes}>
                    注: {member.notes}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}