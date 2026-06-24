# 真实网页版部署说明

这一版支持：

- Supabase 用户名密码登录
- 创建私有旅行房间
- 6 位邀请码加入房间
- 只有房间成员能读写地点、评论、想去和路线
- RLS 数据库权限策略

## 1. 创建 Supabase 项目

1. 打开 Supabase，创建一个项目。
2. 在 Project Settings -> API 里复制：
   - Project URL
   - anon public key
3. 打开 `web/config.js`，填入：

```js
window.TRAVEL_APP_CONFIG = {
  supabaseUrl: 'https://你的项目.supabase.co',
  supabaseAnonKey: '你的 anon public key',
  amapKey: '你的高德 Web JS API key',
  amapSecurityJsCode: '你的高德安全密钥，通常必填',
  authUsernameDomain: 'travel.local',
  allowTripCreation: true,
  useLocalStorage: false
};
```

`allowTripCreation` 控制普通登录用户是否能在大厅里创建旅行房间。设为 `false` 后，用户只能通过邀请码加入已有房间。

## 1.1 维护登录用户

网页只让用户输入「用户名」和「密码」，但 Supabase Auth 原生密码登录仍然需要 email-like 登录标识。

当前实现会把用户名转换成：

```text
用户名@travel.local
```

例如用户在网页输入：

```text
leo
```

实际会用下面这个 Supabase Auth 用户登录：

```text
leo@travel.local
```

所以你在 Supabase Authentication -> Users 手动创建用户时，按这个格式创建账号，并设置密码。用户本人不需要知道这个内部邮箱格式。

## 1.2 配置高德地图

1. 打开高德开放平台，创建「Web端 JS API」应用 Key。
2. 把 Key 填到 `amapKey`。
3. 把同一个应用里的「安全密钥」填到 `amapSecurityJsCode`。搜索地点依赖高德插件服务，新建应用通常必须配置这个值。
4. 如果设置了 Web 端域名白名单，本地测试加入 `localhost` 和 `127.0.0.1`，线上部署后加入你的正式域名。

## 2. 建表和权限

在 Supabase SQL Editor 执行：

```text
web/supabase.secure.schema.sql
```

不要再执行旧的 `web/supabase.schema.sql`，那是之前的公开 demo 版。

## 4. 本地预览

真实登录建议起一个本地静态服务：

```powershell
cd "D:\Leo\CodexWP\traveling app\web"
python -m http.server 5173
```

然后访问：

```text
http://localhost:5173
```

## 5. 使用流程

1. 管理员先在 Supabase Auth 创建用户，例如 `leo@travel.local`，并设置密码。
2. 用户打开网页，输入用户名 `leo` 和密码登录。
3. 登录后创建旅行房间。
4. 页面会生成邀请码。
5. 把邀请码和链接发给朋友。
6. 朋友用自己的用户名密码登录后，输入邀请码加入房间。

## 权限模型

- `trips`：只有房间成员可读；只有 owner 可更新。
- `trip_members`：只有成员可读；邀请码加入通过 `join_trip_by_invite` RPC 完成。
- `places`：只有成员可读写；地点创建人只能写自己的地点。
- `place_wants`：只有成员可读写自己的想去记录。
- `comments`：只有成员可读写评论。
- `route_plans`：房间成员可共同维护路线。
