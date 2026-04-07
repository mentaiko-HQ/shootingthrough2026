// src/app/results/shared.ts

// ============================================================================
// 型定義・定数 (Types & Constants)
// ============================================================================
export type CallStatus = "waiting" | "calling" | "shooting";

export type ParticipantDoc = {
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
  results?: {
    yosen?: number;
    kessho?: number;
    izume?: string[];
    enkin?: string;
  };
  status?: {
    is_checked_in?: boolean;
    qr_sent_at?: unknown;
    call_status?: CallStatus;
    is_withdrawn?: boolean;
    is_substituted?: boolean;
  };
};

export type EntryGroup = {
  entry_group_id: string;
  entry_type: "individual" | "team";
  team_name: string;
  division: string;
  members: ParticipantDoc[];
};

export interface GroupCardProps {
  group: EntryGroup;
  mainTab: MainTabType;
}

export const MAIN_TABS = [
  { id: "yosen", label: "🎯 予選", desc: "予選結果" },
  { id: "team_kessho", label: "🏆 団体決勝", desc: "団体決勝結果" },
  { id: "team_izume", label: "⚔️ 団体射詰", desc: "同中競射" },
  { id: "confirm", label: "📋 成績確認", desc: "団体射詰結果" },
  { id: "ind_kessho", label: "⚔️ 個人決勝", desc: "射詰・遠近結果" },
  { id: "ind_confirm", label: "📋 成績確認", desc: "個人決勝結果" },
] as const;

export type MainTabType = typeof MAIN_TABS[number]["id"];

export const TAB_GROUPS = [
  {
    title: "予選ラウンド",
    colorClass: "bg-gray-50 border-gray-200",
    textClass: "text-gray-500",
    tabs: ["yosen"]
  },
  {
    title: "団体戦 決勝ラウンド",
    colorClass: "bg-[#8B1500]/5 border-[#8B1500]/20",
    textClass: "text-[#8B1500]",
    tabs: ["team_kessho", "team_izume", "confirm"]
  },
  {
    title: "個人戦 決勝ラウンド",
    colorClass: "bg-[#D35400]/5 border-[#D35400]/20",
    textClass: "text-[#D35400]",
    tabs: ["ind_kessho", "ind_confirm"]
  }
] as const;

export const SUB_TABS = [
  { id: "団体の部（男子）", label: "団体 男子", icon: "👥", type: "team" },
  { id: "団体の部（女子）", label: "団体 女子", icon: "👥", type: "team" },
  { id: "個人の部（男子）", label: "個人 男子", icon: "👤", type: "individual" },
  { id: "個人の部（女子）", label: "個人 女子", icon: "👤", type: "individual" },
  { id: "個人の部（シニア）", label: "個人 シニア", icon: "🏅", type: "individual" },
];

// ============================================================================
// ビジネスロジック・ヘルパー関数 (純粋関数)
// ============================================================================
export const checkYosenPass = (group: EntryGroup) => {
  if (group.entry_type !== "team") return false;
  const teamYosenScore = group.members.reduce((sum, m) => sum + (m.results?.yosen || 0), 0);
  if (group.division === "団体の部（男子）" && teamYosenScore >= 8) return true;
  if (group.division === "団体の部（女子）" && teamYosenScore >= 6) return true;
  return false;
};

export const checkIndividualYosenPass = (member: ParticipantDoc) => {
  const score = member.results?.yosen;
  if (score === undefined) return false;
  const gender = member.basic_info?.gender;
  const isSenior = member.basic_info?.isSenior;
  if (isSenior) {
    if (gender === "男性" && score >= 3) return true;
    if (gender === "女性" && score >= 2) return true;
  } else {
    if (gender === "男性" && score >= 4) return true;
    if (gender === "女性" && score >= 3) return true;
  }
  return false;
};

export const isMatchingIndividualSubTab = (member: ParticipantDoc, group: EntryGroup, subTab: string) => {
  const isSenior = !!member.basic_info?.isSenior;
  let gender = member.basic_info?.gender;
  if (!gender) {
    if (group.division.includes("男子")) gender = "男性";
    if (group.division.includes("女子")) gender = "女性";
  }
  if (subTab.includes("シニア")) return isSenior;
  if (subTab.includes("男子")) return !isSenior && gender === "男性";
  if (subTab.includes("女子")) return !isSenior && gender === "女性";
  return false;
};