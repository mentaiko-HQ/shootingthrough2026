import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的ファイルとして書き出すための設定（Firebase Hosting用）
  output: 'export',
};

export default nextConfig;