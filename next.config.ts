import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mdb-reader needs Buffer in the browser when parsing .mdb on the client
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
