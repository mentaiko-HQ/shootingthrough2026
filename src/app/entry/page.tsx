"use client";

import React, { useState } from "react";
import { db, storage, app } from "@/lib/firebase";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import Header from "@/components/layout/Header";
import Toast from "@/components/ui/Toast";

// --- メンバー情報の型定義 ---
type Member = {
  id: string; // ここはUI上の識別用なので、"member-1" などの固定文字列を入れます
  position: "大前" | "中" | "落" | "個人";
  nameKana: string;
  name: string;
  isSenior: boolean;
  gender: "男性" | "女性";
  rank: string;
  notes: string;
};

const RANK_OPTIONS = ["弐段以下", "参段以上", "称号者"];

export default function EntryForm() {
  const [entryType, setEntryType] = useState<"individual" | "team">("individual");
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  
  // 【修正】ハイドレーションエラーを防ぐため、初期状態のIDを固定文字列（"member-1"）に変更しました
  const [members, setMembers] = useState<Member[]>([
    { id: "member-1", position: "個人", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleEntryTypeChange = (type: "individual" | "team") => {
    setEntryType(type);
    if (type === "individual") {
      // 【修正】個人の場合は固定ID "member-1"
      setMembers([{ id: "member-1", position: "個人", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" }]);
    } else {
      // 【修正】団体の場合は固定ID "member-1", "member-2", "member-3" に変更
      setMembers([
        { id: "member-1", position: "大前", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
        { id: "member-2", position: "中", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
        { id: "member-3", position: "落", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
      ]);
    }
  };

  const updateMember = (id: string, field: keyof Member, value: string | boolean) => {
    setMembers(members.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("画像サイズは5MB以下にしてください", "error");
        return;
      }
      setProofImage(file);
      const previewUrl = URL.createObjectURL(file);
      setProofImagePreview(previewUrl);
    }
  };

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!applicantName.trim() || !applicantPhone.trim() || !applicantEmail.trim()) {
      showToast("担当者情報をすべて入力してください", "error"); return;
    }
    if (!teamName.trim()) {
      showToast("所属チーム・団体名を入力してください", "error"); return;
    }
    if (!proofImage) {
      showToast("郵便振替の入金証明書画像をアップロードしてください", "error"); return;
    }

    const hasEmptyField = members.some((m) => !m.nameKana.trim() || !m.name.trim());
    if (hasEmptyField) {
      const errorMsg = entryType === "team" ? "3名全員のふりがなと選手名を入力してください" : "ふりがなと選手名を入力してください";
      showToast(errorMsg, "error"); return;
    }

    setIsSubmitting(true);

    try {
      const targetBucket = app?.options?.storageBucket || "不明";
      console.log(`🔥 送信先ストレージバケット: ${targetBucket}`);
      console.log("🔥 画像アップロード処理を開始します...");
      
      // 画像名は一意にするため、ここでは今まで通りランダム値を使用します（UIには影響しないため安全です）
      const fileName = `payment_proofs/${Date.now()}_${crypto.randomUUID()}_${proofImage.name}`;
      const imageRef = ref(storage, fileName);
      
      await uploadBytes(imageRef, proofImage);
      console.log("✅ 画像アップロード完了。ダウンロードURLを取得します...");
      
      const proofImageUrl = await getDownloadURL(imageRef);
      console.log("✅ ダウンロードURL取得完了。Firestoreへのデータ書き込みを開始します...");

      const teamDivision = members.some((m) => m.gender === "男性") ? "団体の部（男子）" : "団体の部（女子）";
      const individualDivision = members[0].isSenior 
        ? "個人の部（シニア）"
        : (members[0].gender === "男性" ? "個人の部（男子）" : "個人の部（女子）");
      const divisionText = entryType === "team" ? teamDivision : individualDivision;

      const batch = writeBatch(db);
      const participantsRef = collection(db, "participants");
      
      // グループIDはバックグラウンド処理用なのでランダム生成でOKです
      const entryGroupId = crypto.randomUUID();

      members.forEach((member) => {
        // ここでdoc(participantsRef)を呼ぶことで、Firestore上で安全に一意のIDが自動生成されます
        const newDocRef = doc(participantsRef);
        const currentDivision = entryType === "team" 
          ? teamDivision 
          : (member.isSenior ? "個人の部（シニア）" : (member.gender === "男性" ? "個人の部（男子）" : "個人の部（女子）"));

        batch.set(newDocRef, {
          entry_group_id: entryGroupId,
          applicant_info: { name: applicantName, phone: applicantPhone, email: applicantEmail },
          basic_info: {
            bib_number: "", position: member.position, entry_type: entryType, division: currentDivision,
            nameKana: member.nameKana, name: member.name, isSenior: member.isSenior, gender: member.gender, rank: member.rank,
            team_name: teamName, applicant_id: "temp_user_id"
          },
          payment_info: { proof_url: proofImageUrl, status: "pending", uploaded_at: serverTimestamp() },
          notes: member.notes,
          status: { is_checked_in: false, can_advance_izume: false, can_advance_final: false },
          created_at: serverTimestamp(),
        });
      });

      const subject = "【第100回 勇気凛々杯争奪弓道大会】エントリー仮受付（入金確認待ち）のお知らせ";
      const memberText = entryType === "team" 
        ? `■ 選手構成：\n  [大前] ${members[0].name}\n  [中] ${members[1].name}\n  [落] ${members[2].name}`
        : `■ 参加選手：${members[0].name}`;
      const text = `${applicantName} 様\n\n第100回 勇気凛々杯争奪弓道大会へのお申し込み、および入金証明書のアップロードを受け付けました。\n\n現時点では【仮受付】となっております。\n\n■ 競技種別：${divisionText}\n■ 所属チーム・団体名：${teamName}\n${memberText}\n\n大会運営事務局にて振込証明書の画像を確認し、承認が完了しましたら、改めて「正式エントリー完了およびQRコードのご案内」メールをお送りいたします。\n\n恐れ入りますが、確認完了まで今しばらくお待ちください。\n\nよろしくお願いいたします。`;

      const mailRef = doc(collection(db, "mail"));
      batch.set(mailRef, { to: applicantEmail, message: { subject, text } });

      await batch.commit();
      console.log("✅ 全データの保存処理が完了しました。");
      showToast("画像のアップロードと仮受付が完了しました！", "success");
      
      setTeamName(""); setProofImage(null); setProofImagePreview(null);
      // 送信完了後の初期化も固定IDを使用します
      if (entryType === "individual") {
        setMembers([{ id: "member-1", position: "個人", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" }]);
      } else {
        setMembers([
          { id: "member-1", position: "大前", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
          { id: "member-2", position: "中", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
          { id: "member-3", position: "落", nameKana: "", name: "", isSenior: false, gender: "男性", rank: "無指定", notes: "" },
        ]);
      }
    } catch (error: any) {
      // エラーの詳細なログ取得を強化
      console.error("❌ 登録エラー詳細:");
      console.error("エラーコード:", error.code);
      console.error("エラーメッセージ:", error.message);
      console.error("スタックトレース:", error.stack);
      
      if (error.message?.includes('CORS')) {
        showToast("接続エラーです。環境変数(.env.local)のストレージ設定とサーバー再起動を確認してください。", "error");
      } else {
        showToast("登録に失敗しました。通信環境を確認してください。", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-secondary font-sans pb-20">
      
      <Header title="参加申込" subtitle="第100回 勇気凛々杯争奪弓道大会" isAdmin={false} />

      <main className="max-w-3xl mx-auto mt-8 px-4">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* エントリー種別選択 */}
          <div className="bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(80,35,20,0.1)] border-2 border-theme-secondary/10">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 border-b-2 border-theme-secondary/10 pb-4">
              🎯 エントリー種別
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-5 border-4 rounded-2xl cursor-pointer transition-all ${entryType === "individual" ? "border-theme-primary bg-theme-primary/10 text-theme-primary shadow-[0_4px_0_0_theme(colors.theme.primary)] translate-y-[2px]" : "border-theme-secondary/20 text-theme-secondary/60 hover:bg-theme-bg/50 hover:border-theme-secondary/40"}`}>
                <input type="radio" name="entryType" value="individual" checked={entryType === "individual"} onChange={() => handleEntryTypeChange("individual")} className="hidden" />
                <span className="text-2xl">👤</span><span className="text-xl font-black">個人戦 (1名)</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-5 border-4 rounded-2xl cursor-pointer transition-all ${entryType === "team" ? "border-theme-primary bg-theme-primary/10 text-theme-primary shadow-[0_4px_0_0_theme(colors.theme.primary)] translate-y-[2px]" : "border-theme-secondary/20 text-theme-secondary/60 hover:bg-theme-bg/50 hover:border-theme-secondary/40"}`}>
                <input type="radio" name="entryType" value="team" checked={entryType === "team"} onChange={() => handleEntryTypeChange("team")} className="hidden" />
                <span className="text-2xl">👥</span><span className="text-xl font-black">団体戦 (3名)</span>
              </label>
            </div>
          </div>
          
          {/* 申込担当者情報 */}
          <div className="bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(80,35,20,0.1)] border-2 border-theme-secondary/10">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 border-b-2 border-theme-secondary/10 pb-4">
              👤 申込担当者情報
              <span className="text-sm bg-theme-primary text-white px-3 py-1 rounded-full font-bold transform -rotate-3">必須</span>
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-black mb-2">担当者名</label>
                <input type="text" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} placeholder="例: 山田 一郎" className="w-full text-lg p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-primary font-bold text-theme-secondary transition-colors" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-black mb-2">電話番号（当日連絡用）</label>
                  <input type="tel" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} placeholder="例: 090-1234-5678" className="w-full text-lg p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-primary font-bold text-theme-secondary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-black mb-2">メールアドレス</label>
                  <input type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} placeholder="例: yamada@example.com" className="w-full text-lg p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-primary font-bold text-theme-secondary transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* 所属チーム・団体名 */}
          <div className="bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(80,35,20,0.1)] border-2 border-theme-secondary/10">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 border-b-2 border-theme-secondary/10 pb-4">
              🏠 所属チーム・団体名
              <span className="text-sm bg-theme-primary text-white px-3 py-1 rounded-full font-bold transform -rotate-3">必須</span>
            </h2>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={entryType === "team" ? "例: 福岡県立〇〇高校 Aチーム" : "例: 福岡県 〇〇支部"}
              className="w-full text-xl p-4 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-2xl focus:outline-none focus:border-theme-primary font-bold text-theme-secondary transition-colors"
            />
          </div>

          {/* 入金証明書 アップロードエリア */}
          <div className="bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(80,35,20,0.1)] border-4 border-theme-accent/30 bg-theme-accent/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-theme-accent"></div>
            
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2 pb-2 text-theme-primary">
              💴 参加料の入金証明
              <span className="text-sm bg-theme-primary text-white px-3 py-1 rounded-full font-bold transform -rotate-3">必須</span>
            </h2>
            
            <p className="font-bold text-theme-secondary/80 mb-6 text-sm">
              参加料をお支払いいただいた際の「郵便振替の払込受領証」または「利用明細」の写真を撮影し、アップロードしてください。
            </p>

            <div className="flex flex-col items-center justify-center w-full">
              <label 
                htmlFor="proof-upload" 
                className={`flex flex-col items-center justify-center w-full h-48 border-4 border-dashed rounded-2xl cursor-pointer transition-all ${proofImagePreview ? 'border-[#10b981] bg-[#10b981]/10' : 'border-theme-accent/50 bg-white hover:bg-theme-accent/10'}`}
              >
                {proofImagePreview ? (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proofImagePreview} alt="入金証明プレビュー" className="max-h-full max-w-full rounded-lg object-contain shadow-md" />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                      クリックして別の画像に変更
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <span className="text-5xl mb-3">📸</span>
                    <p className="mb-2 text-lg font-bold text-theme-secondary"><span className="text-theme-primary underline">ここをタップ</span> して画像を選択</p>
                    <p className="text-xs text-theme-secondary/60 font-bold">PNG, JPGファイル (最大5MB)</p>
                  </div>
                )}
                <input id="proof-upload" type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
            
            <div className="mt-4 p-4 bg-theme-bg rounded-xl border border-theme-secondary/10">
              <p className="text-sm font-bold text-theme-secondary/80">
                <span className="text-theme-primary">⚠️ 注意事項</span><br/>
                画像は大会運営事務局で確認を行います。<br/>
                このフォームを送信した時点では<strong className="text-theme-primary border-b-2 border-theme-primary">「仮受付」</strong>となり、内容確認後に正式エントリーとなります。
              </p>
            </div>
          </div>

          {/* メンバー入力リスト */}
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-center mt-12 mb-6">
              {entryType === "team" ? "🏹 選手情報（3人立）" : "🏹 参加選手情報"}
            </h2>

            <div className="bg-theme-accent/10 p-5 rounded-2xl border-2 border-theme-accent/30 mb-8 mx-2">
              <p className="font-black text-theme-primary mb-2 flex items-center gap-2">
                <span className="text-xl">💡</span> 競技種別の自動振り分けについて
              </p>
              <ul className="list-disc pl-5 text-sm font-bold text-theme-secondary/80 space-y-2">
                {entryType === "team" ? (
                  <li><strong>団体の部：</strong> メンバー全員が女性の場合は「女子の部」、1名でも男性が含まれる場合（男女混成）は「男子の部」として登録されます。</li>
                ) : (
                  <li><strong>個人の部：</strong> 65歳以上の方は男女問わず「シニアの部」、それ以外の方は「男子の部」「女子の部」として自動登録されます。</li>
                )}
              </ul>
            </div>

            {members.map((member, index) => (
              <div key={member.id} className="bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(80,35,20,0.1)] border-2 border-theme-secondary/10 relative animate-fade-in-up">
                {entryType === "team" && (
                  <h3 className="text-2xl font-black text-theme-primary mb-4 border-b-2 border-theme-primary/20 pb-2 flex items-center gap-3">
                    <span className="bg-theme-primary text-white w-10 h-10 flex items-center justify-center rounded-full text-lg">{index + 1}</span>{member.position}
                  </h3>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ふりがな */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black mb-2">ふりがな <span className="text-theme-primary">※</span></label>
                    <input type="text" value={member.nameKana} onChange={(e) => updateMember(member.id, "nameKana", e.target.value)} placeholder={entryType === "team" ? `例: ${member.position === "大前" ? "おおまえ" : member.position === "中" ? "なか" : "おち"} たろう` : "例: きゅうどう たろう"} className="w-full p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-accent font-bold text-theme-secondary" />
                  </div>

                  {/* 名前 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black mb-2">名前 <span className="text-theme-primary">※</span></label>
                    <input type="text" value={member.name} onChange={(e) => updateMember(member.id, "name", e.target.value)} placeholder={entryType === "team" ? `例: ${member.position} 太郎` : "例: 弓道 太郎"} className="w-full p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-accent font-bold text-theme-secondary" />
                  </div>

                  {/* 65歳以上 */}
                  <div className="md:col-span-2">
                    <label className="inline-flex items-center gap-3 p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl cursor-pointer hover:bg-theme-bg/50 transition-colors has-[:checked]:border-theme-accent has-[:checked]:bg-theme-accent/10 w-full sm:w-auto">
                      <input type="checkbox" checked={member.isSenior} onChange={(e) => updateMember(member.id, "isSenior", e.target.checked)} className="w-5 h-5 accent-theme-primary rounded" />
                      <span className="font-bold text-theme-secondary">65歳以上（シニア）である</span>
                    </label>
                  </div>

                  {/* 性別 */}
                  <div>
                    <label className="block text-sm font-black mb-2">性別</label>
                    <div className="flex gap-4">
                      {["男性", "女性"].map((g) => (
                        <label key={g} className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-theme-secondary/20 rounded-xl cursor-pointer hover:bg-theme-bg/50 transition-colors has-[:checked]:border-theme-accent has-[:checked]:bg-theme-accent/10 has-[:checked]:text-theme-primary">
                          <input type="radio" name={`gender-${member.id}`} value={g} checked={member.gender === g} onChange={(e) => updateMember(member.id, "gender", e.target.value as "男性" | "女性")} className="hidden" />
                          <span className="font-bold">{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 段位 */}
                  <div>
                    <label className="block text-sm font-black mb-2">段位</label>
                    <div className="relative">
                      <select value={member.rank} onChange={(e) => updateMember(member.id, "rank", e.target.value)} className="w-full p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-accent font-bold text-theme-secondary appearance-none">
                        {RANK_OPTIONS.map((rank) => ( <option key={rank} value={rank}>{rank}</option> ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-theme-secondary">▼</div>
                    </div>
                  </div>

                  {/* 備考 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black mb-2">備考欄</label>
                    <textarea value={member.notes} onChange={(e) => updateMember(member.id, "notes", e.target.value)} placeholder="特記事項があれば入力してください" rows={2} className="w-full p-3 bg-theme-bg/30 border-2 border-theme-secondary/20 rounded-xl focus:outline-none focus:border-theme-accent font-bold text-theme-secondary resize-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 登録ボタン */}
          <div className="pt-8 pb-12 border-t-4 border-theme-secondary/10 border-dashed">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 bg-theme-primary hover:bg-theme-primaryHover disabled:bg-gray-400 disabled:shadow-none disabled:translate-y-[6px] text-white rounded-full font-black text-2xl tracking-widest shadow-[0_8px_0_0_rgba(139,21,0,1)] hover:translate-y-[4px] hover:shadow-[0_4px_0_0_rgba(139,21,0,1)] transition-all flex items-center justify-center gap-3"
            >
              {isSubmitting ? "🔥 処理中..." : `🔥 内容を送信する`}
            </button>
          </div>
        </form>
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}