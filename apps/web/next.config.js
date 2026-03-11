/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: { serverActions: { allowedOrigins: ['console.mvault.ru'] } },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://console.mvault.ru',
  },
}
