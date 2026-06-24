// 复制此文件为 config.js，然后填入你自己的 key。
// config.js 已加入 .gitignore，不会被提交到仓库。
// 部署到 GitHub Pages 时，CI 会从仓库 Secrets 自动注入真实值。
window.TRAVEL_APP_CONFIG = {
  // Supabase 项目 URL 和 anon key（在 Supabase Dashboard → Settings → API 获取）
  supabaseUrl: 'SUPABASE_URL_PLACEHOLDER',
  supabaseAnonKey: 'SUPABASE_ANON_KEY_PLACEHOLDER',

  // 高德地图 JS API Key（在 https://console.amap.com/dev/key/app 获取）
  amapKey: 'AMAP_KEY_PLACEHOLDER',

  // 高德安全密钥（可选，建议配合 amapKey 一起使用）
  amapSecurityJsCode: 'AMAP_SECURITY_CODE_PLACEHOLDER',

  // 登录时用 "<用户名>@<此域名>" 作为邮箱
  authUsernameDomain: 'test.com',

  // 设为 false 则普通用户不能创建房间
  allowTripCreation: true,

  // 保留兼容性
  useLocalStorage: true
};
