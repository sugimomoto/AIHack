import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 向け。実行に必要な最小限のファイルだけを出力する
  output: "standalone",
};

export default nextConfig;
