import { writeBatch, collection, doc, serverTimestamp, Firestore } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from "firebase/storage";
import QRCode from "qrcode";

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

type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  applicant_info: { name: string; phone: string; email: string };
  payment_info: { proof_url: string; status: "pending" | "approved" };
  members: ParticipantDoc[];
};

export const sendQRCodeMail = async (
  group: EntryGroup,
  db: Firestore,
  storage: FirebaseStorage
): Promise<void> => {
  const bibNumber = group.members[0]?.basic_info?.bib_number;
  if (!bibNumber || bibNumber.trim() === "") {
    throw new Error("立順（ゼッケン）が設定されていません。");
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(group.entry_group_id, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const response = await fetch(qrDataUrl);
    const blob = await response.blob();
    const fileName = `qr_codes/${group.entry_group_id}.png`;
    const imageRef = ref(storage, fileName);
    await uploadBytes(imageRef, blob);
    const qrImageUrl = await getDownloadURL(imageRef);

    const applicantName = group.applicant_info.name;
    const applicantEmail = group.applicant_info.email;
    const teamName = group.entry_type === "team" ? group.team_name : "なし";

    let memberText = "";
    if (group.entry_type === "team") {
      const omae = group.members.find((m) => m.basic_info?.position === "大前")?.basic_info?.name || "-";
      const naka = group.members.find((m) => m.basic_info?.position === "中")?.basic_info?.name || "-";
      const ochi = group.members.find((m) => m.basic_info?.position === "落")?.basic_info?.name || "-";
      memberText = `[大前] ${omae}<br/>[中] ${naka}<br/>[落] ${ochi}`;
    } else {
      memberText = group.members[0]?.basic_info?.name || "";
    }

    const subject = "【重要】大会受付用QRコードと立順のご案内（第50回 春季弓道大会）";

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #8B1500; text-align: center; border-bottom: 2px solid #8B1500; padding-bottom: 15px; margin-top: 0;">大会受付用QRコード</h2>
        <p style="font-size: 16px;">${applicantName} 様</p>
        <p style="font-size: 15px; line-height: 1.6;">大会のエントリー受付が完了し、立順（ゼッケン番号）が決定いたしました。<br/>大会当日は、スムーズな受付のため<strong>このメールのQRコードを受付窓口にてご提示ください。</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center; border: 1px solid #eee;">
          <p style="font-size: 14px; color: #666; margin-bottom: 5px;">決定した立順（ゼッケン）</p>
          <p style="font-size: 42px; font-weight: bold; color: #8B1500; margin: 0; letter-spacing: 2px;">${bibNumber}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 15px; font-weight: bold; color: #d35400; margin-bottom: 15px;">⚠️ 読み取りやすくするため、<br/>スマホの画面を一番明るくしてご提示ください</p>
          <img src="${qrImageUrl}" alt="受付用QRコード" style="width: 200px; height: 200px; border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);" />
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 15px; background-color: #fff;">
          <tr>
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; width: 35%; color: #666;">競技種別</th>
            <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">${group.division}</td>
          </tr>
          <tr>
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; color: #666;">所属チーム名</th>
            <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">${teamName}</td>
          </tr>
          <tr>
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; color: #666; vertical-align: top;">参加選手</th>
            <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold; line-height: 1.6;">${memberText}</td>
          </tr>
        </table>
        
        <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-top: 30px; font-size: 13px; text-align: center;">
          <strong>【おすすめ】</strong><br/>
          当日の会場の電波状況に備え、事前にこの画面の<strong>スクリーンショット（写真）</strong>を保存しておくことをお勧めいたします。
        </div>
      </div>
    `;

    const batch = writeBatch(db);

    const mailRef = doc(collection(db, "mail"));
    batch.set(mailRef, {
      to: applicantEmail,
      message: {
        subject,
        html: htmlContent,
        text: `${applicantName} 様\n大会受付用QRコードと立順のご案内です。\n立順: ${bibNumber}\n※QRコードを表示するには、HTMLメールを表示できるアプリをご利用ください。`,
      },
    });

    group.members.forEach((member) => {
      const memberRef = doc(db, "participants", member.id);
      batch.update(memberRef, { "status.qr_sent_at": serverTimestamp() });
    });

    await batch.commit();
  } catch (error: any) {
    console.error("❌ QRコード生成・メール送信処理エラー詳細:");
    console.error("エラーメッセージ:", error.message);
    console.error("スタックトレース:", error.stack);
    throw error;
  }
};