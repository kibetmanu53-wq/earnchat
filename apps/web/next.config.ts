import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@earnchat/auth',
    '@earnchat/core',
    '@earnchat/db',
    '@earnchat/domain',
    '@earnchat/payments',
    '@earnchat/validation'
  ]
};

export default nextConfig;
