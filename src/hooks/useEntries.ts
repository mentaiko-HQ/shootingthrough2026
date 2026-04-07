import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, onSnapshot, doc, writeBatch } from "firebase/firestore";
import { sendQRCodeMail } from "@/lib/qrMailer";

// --- 型定義 ---
export type ParticipantDoc = {
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

// カスタムフック本体
export const useEntries = (showToast: (text: string, type: "success" | "error") => void) => {
  const [groupedEntries, setGroupedEntries] = useState<EntryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingQR, setIsSendingQR] = useState<string | null>(null);

  // 1. データ取得ロジック
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
            if (!item.basic_info) return;

            const groupId = item.entry_group_id || `fallback-group-${item.id}`;

            if (!groupsMap.has(groupId)) {
              groupsMap.set(groupId, {
                entry_group_id: groupId,
                entry_type: item.basic_info.entry_type || "individual",
                team_name: item.basic_info.team_name || "名称未設定",
                division: item.basic_info.division || "未分類",
                applicant_info: item.applicant_info || { name: "不明", phone: "不明", email: "不明" },
                payment_info: item.payment_info || { proof_url: "", status: "pending" },
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

            if (bibA && bibB) {
              const numA = parseInt(bibA, 10);
              const numB = parseInt(bibB, 10);
              if (!isNaN(numA) && !isNaN(numB)) {
                if (numA !== numB) return numA - numB;
              } else {
                if (bibA !== bibB) return bibA.localeCompare(bibB);
              }
            } else if (bibA) {
              return -1; 
            } else if (bibB) {
              return 1;
            }

            const nameA = a.entry_type === "team" ? a.team_name : (a.members[0]?.basic_info?.name || "");
            const nameB = b.entry_type === "team" ? b.team_name : (b.members[0]?.basic_info?.name || "");
            return nameA.localeCompare(nameB, 'ja');
          });

          setGroupedEntries(groupsArray);
          setIsLoading(false);

        } catch (error: any) {
          console.error("❌ データマッピングエラー:", error.message, error.stack);
          showToast("データの解析中にエラーが発生しました", "error");
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("❌ Firestoreリアルタイム取得エラー:", error);
        showToast("データの取得に失敗しました", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // 2. 入金承認ロジック
  const approvePayment = async (group: EntryGroup) => {
    try {
      const batch = writeBatch(db);
      group.members.forEach((member) => {
        const memberRef = doc(db, "participants", member.id);
        batch.update(memberRef, { "payment_info.status": "approved" });
      });

      const applicantName = group.applicant_info.name;
      const applicantEmail = group.applicant_info.email;
      const teamName = group.entry_type === "team" ? group.team_name : "なし";

      let memberText = "";
      if (group.entry_type === "team") {
        const omae = group.members.find(m => m.basic_info?.position === "大前")?.basic_info?.name || "-";
        const naka = group.members.find(m => m.basic_info?.position === "中")?.basic_info?.name || "-";
        const ochi = group.members.find(m => m.basic_info?.position === "落")?.basic_info?.name || "-";
        memberText = `\n  [大前] ${omae}\n  [中] ${naka}\n  [落] ${ochi}`;
      } else {
        memberText = group.members[0]?.basic_info?.name || "";
      }

      const subject = "【第50回 春季弓道大会】正式エントリー完了のお知らせ";
      const text = `${applicantName} 様\n\n大会運営事務局です。\n参加料の入金確認が完了し、【正式エントリー】として受け付けました。\n\n■ 所属チーム・団体名：${teamName}\n■ 参加選手：${memberText}\n\n当日の受付用QRコードなど、詳細につきましては後日改めてご案内いたします。\n大会当日にお会いできることを楽しみにしております。\n\nよろしくお願いいたします。`;

      const mailRef = doc(collection(db, "mail"));
      batch.set(mailRef, { to: applicantEmail, message: { subject, text } });

      await batch.commit();
      showToast(`${group.team_name || group.members[0].basic_info?.name} の入金を承認し、メールを送信しました`, "success");
    } catch (error: any) {
      console.error("承認処理エラー:", error.message, error.stack);
      showToast("承認処理に失敗しました", "error");
    }
  };

  // 3. 立順更新ロジック
  const updateBibNumber = async (group: EntryGroup, newBibNumber: string) => {
    try {
      const batch = writeBatch(db);
      group.members.forEach((member) => {
        const memberRef = doc(db, "participants", member.id);
        batch.update(memberRef, { "basic_info.bib_number": newBibNumber });
      });
      await batch.commit();
    } catch (error: any) {
      console.error("立順更新エラー:", error.message, error.stack);
      showToast("立順の保存に失敗しました", "error");
    }
  };

  // 4. QRコード送信ロジック
  const sendQRCode = async (group: EntryGroup) => {
    setIsSendingQR(group.entry_group_id);
    try {
      await sendQRCodeMail(group, db, storage);
      showToast(`${group.team_name || group.members[0].basic_info?.name} へ受付票を送信しました`, "success");
    } catch (error: any) {
      showToast("送信に失敗しました。通信環境を確認してください。", "error");
    } finally {
      setIsSendingQR(null);
    }
  };

  return {
    groupedEntries,
    isLoading,
    isSendingQR,
    approvePayment,
    updateBibNumber,
    sendQRCode
  };
};