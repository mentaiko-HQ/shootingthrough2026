"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";

// --- 型定義 ---
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

const RANK_OPTIONS = ["弐段以下", "参段以上", "称号者"];

type Props = {
  group: EntryGroup | null;
  onClose: () => void;
  showToast: (text: string, type: "success" | "error") => void;
};

export default function EntryEditModal({ group, onClose, showToast }: Props) {
  const [editFormData, setEditFormData] = useState<EntryGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // モーダルが開かれたとき（groupが渡されたとき）にデータをコピーしてセット
  useEffect(() => {
    if (group) {
      setEditFormData(JSON.parse(JSON.stringify(group)));
    } else {
      setEditFormData(null);
    }
  }, [group]);

  if (!group || !editFormData) return null;

  const handleEditFormChange = (field: 'team_name' | 'applicant_name' | 'applicant_phone' | 'applicant_email', value: string) => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      const newData = { ...prev };
      if (field === 'team_name') {
        newData.team_name = value;
      } else if (field === 'applicant_name') {
        newData.applicant_info = { ...newData.applicant_info, name: value };
      } else if (field === 'applicant_phone') {
        newData.applicant_info = { ...newData.applicant_info, phone: value };
      } else if (field === 'applicant_email') {
        newData.applicant_info = { ...newData.applicant_info, email: value };
      }
      return newData;
    });
  };

  const handleMemberEditChange = (memberId: string, field: 'name' | 'nameKana' | 'gender' | 'rank' | 'isSenior' | 'notes', value: any) => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      const newMembers = prev.members.map(m => {
        if (m.id !== memberId) return m;
        const newMember = { ...m };
        if (field === 'notes') {
          newMember.notes = value;
        } else {
          newMember.basic_info = { ...newMember.basic_info!, [field]: value };
        }
        return newMember;
      });
      return { ...prev, members: newMembers };
    });
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);

    try {
      const batch = writeBatch(db);
      
      editFormData.members.forEach((member) => {
        const memberRef = doc(db, "participants", member.id);
        
        batch.update(memberRef, {
          "applicant_info.name": editFormData.applicant_info.name,
          "applicant_info.phone": editFormData.applicant_info.phone,
          "applicant_info.email": editFormData.applicant_info.email,
          "basic_info.team_name": editFormData.team_name,
          "basic_info.nameKana": member.basic_info?.nameKana,
          "basic_info.name": member.basic_info?.name,
          "basic_info.isSenior": member.basic_info?.isSenior,
          "basic_info.gender": member.basic_info?.gender,
          "basic_info.rank": member.basic_info?.rank,
          "notes": member.notes || "",
        });
      });

      await batch.commit();
      showToast("登録情報を更新しました", "success");
      onClose(); // 保存成功時にモーダルを閉じる
    } catch (error: any) {
      console.error("❌ 登録情報更新エラー詳細:", error.message, error.stack);
      showToast("情報の更新に失敗しました", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative border-4 border-theme-secondary/10 flex flex-col">
        
        <div className="sticky top-0 bg-white/95 backdrop-blur z-20 flex items-center justify-between p-6 border-b-2 border-theme-secondary/10">
          <h2 className="text-2xl font-black text-theme-secondary flex items-center gap-2">
            <span>✏️</span> 登録情報の編集
          </h2>
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500 transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          <div className="bg-theme-bg/30 p-5 rounded-2xl border border-theme-secondary/10 space-y-4">
            <h3 className="font-black text-theme-primary border-b border-theme-secondary/10 pb-2">担当者・チーム情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-secondary/70">所属チーム名</label>
                <input 
                  type="text" 
                  value={editFormData.team_name} 
                  onChange={(e) => handleEditFormChange('team_name', e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-secondary/70">担当者名</label>
                <input 
                  type="text" 
                  value={editFormData.applicant_info.name} 
                  onChange={(e) => handleEditFormChange('applicant_name', e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-secondary/70">電話番号</label>
                <input 
                  type="tel" 
                  value={editFormData.applicant_info.phone} 
                  onChange={(e) => handleEditFormChange('applicant_phone', e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-secondary/70">メールアドレス</label>
                <input 
                  type="email" 
                  value={editFormData.applicant_info.email} 
                  onChange={(e) => handleEditFormChange('applicant_email', e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-theme-primary border-b border-theme-secondary/10 pb-2">選手情報</h3>
            {editFormData.members.map((member, index) => (
              <div key={member.id} className="bg-theme-bg/30 p-5 rounded-2xl border border-theme-secondary/10 space-y-4 relative">
                {editFormData.entry_type === "team" && (
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-theme-primary text-white flex items-center justify-center rounded-full font-black text-sm shadow-md">
                    {index + 1}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="col-span-1 md:col-span-4 space-y-3">
                    <div>
                      <label className="block text-xs font-bold mb-1 text-theme-secondary/70">名前</label>
                      <input 
                        type="text" 
                        value={member.basic_info?.name || ""} 
                        onChange={(e) => handleMemberEditChange(member.id, 'name', e.target.value)}
                        className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-theme-secondary/70">ふりがな</label>
                      <input 
                        type="text" 
                        value={member.basic_info?.nameKana || ""} 
                        onChange={(e) => handleMemberEditChange(member.id, 'nameKana', e.target.value)}
                        className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm" 
                      />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-4 space-y-3">
                    <div>
                      <label className="block text-xs font-bold mb-1 text-theme-secondary/70">性別</label>
                      <div className="flex gap-2">
                        {["男性", "女性"].map(g => (
                          <label key={g} className={`flex-1 text-center p-2 rounded-lg cursor-pointer font-bold text-sm border-2 transition-colors ${member.basic_info?.gender === g ? "bg-theme-accent/10 border-theme-accent text-theme-primary" : "bg-white border-theme-secondary/20 text-theme-secondary/60 hover:bg-theme-bg"}`}>
                            <input 
                              type="radio" 
                              className="hidden" 
                              checked={member.basic_info?.gender === g} 
                              onChange={() => handleMemberEditChange(member.id, 'gender', g)} 
                            />
                            {g}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-theme-secondary/70">段位</label>
                      <select 
                        value={member.basic_info?.rank || "無指定"} 
                        onChange={(e) => handleMemberEditChange(member.id, 'rank', e.target.value)}
                        className="w-full p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm appearance-none"
                      >
                        {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 p-2 bg-white border-2 border-theme-secondary/20 rounded-xl cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={member.basic_info?.isSenior || false} 
                          onChange={(e) => handleMemberEditChange(member.id, 'isSenior', e.target.checked)}
                          className="w-4 h-4 accent-theme-primary" 
                        />
                        <span className="text-sm font-bold text-theme-secondary">シニア（65歳以上）</span>
                      </label>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-4">
                    <label className="block text-xs font-bold mb-1 text-theme-secondary/70">備考</label>
                    <textarea 
                      value={member.notes || ""} 
                      onChange={(e) => handleMemberEditChange(member.id, 'notes', e.target.value)}
                      className="w-full h-[calc(100%-20px)] p-2.5 bg-white border-2 border-theme-secondary/20 rounded-xl focus:border-theme-primary outline-none font-bold text-sm resize-none" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur p-4 border-t-2 border-theme-secondary/10 flex justify-end gap-3 rounded-b-3xl">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 font-bold text-theme-secondary/60 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSaveEdit}
            disabled={isSaving}
            className="px-8 py-3 font-black text-white bg-theme-primary hover:bg-theme-primaryHover rounded-xl shadow-[0_4px_0_0_rgba(139,21,0,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(139,21,0,1)] transition-all disabled:bg-gray-400 disabled:shadow-none disabled:translate-y-[4px]"
          >
            {isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}