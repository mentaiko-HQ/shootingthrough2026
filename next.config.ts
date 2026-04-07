import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本番環境でのエラーログの詳細をブラウザで追跡・取得しやすくするための設定
  productionBrowserSourceMaps: true,

  // UI/UXの表示確認を優先するため、クラウドビルド時のESLint警告を無視
  eslint: {
    ignoreDuringBuilds: true,
  },

  // UI/UXの表示確認を優先するため、クラウドビルド時のTypeScript型エラーを無視
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;