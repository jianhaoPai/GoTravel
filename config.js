// 复制此文件为 config.js，然后填入你自己的 key。
// config.js 已加入 .gitignore，不会被提交到仓库。
// 部署到 GitHub Pages 时，CI 会从仓库 Secrets 自动注入真实值。
window.TRAVEL_APP_CONFIG = {
  // Supabase 项目 URL 和 anon key（在 Supabase Dashboard → Settings → API 获取）
  supabaseUrl: 'https://sasnimwunrdyhwkurkix.supabase.co',
  supabaseAnonKey: 'sb_publishable_XXdzp0N4p8eSyr736GX8NQ_Gc2L0n2l',

  // 高德地图 JS API Key（在 https://console.amap.com/dev/key/app 获取）
  amapKey: 'dad61aba86c21ef23eab2012dc90647f',

  // 高德安全密钥（新版 Web JS API 通常必填，搜索地点依赖它）
  amapSecurityJsCode: '22815213916e299137e555afdac46e88',

  // 登录时用 "<用户名>@<此域名>" 作为邮箱
  authUsernameDomain: 'test.com',

  // 设为 false 则普通用户不能创建房间
  allowTripCreation: true,

  // 保留兼容性
  useLocalStorage: true
};
