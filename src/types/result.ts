// --- 参加者個人の情報 ---
export type MemberInfo = {
  docId: string;
  name: string;
  nameKana?: string;
  gender?: string;
  rank?: string;
  bib_number: string; // 立順（ゼッケン）
  position: string;   // 大前, 中, 落, 個人
  division?: string;
  isSenior?: boolean;
  qualifying_scores: string[]; // 予選の的中 ["〇", "×", "〇", "〇"]
  team_final_scores?: string[];
  final_scores?: string[];
  can_advance_final?: boolean;
  can_team_advance_final?: boolean;
  teamName: string;
  groupId: string;
  entryType: "individual" | "team";
};

// --- チーム（グループ）の情報 ---
export type EntryGroup = {
  groupId: string;
  teamName: string;
  entryType: "individual" | "team";
  members: MemberInfo[];
  paymentStatus: string; // approved, pending など
};