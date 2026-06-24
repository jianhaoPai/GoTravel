# Traveling App

这个仓库现在按端拆分：

- `web/`：真实网页端，包含 Supabase 登录、邀请码、房间权限和地图路线功能。
- `miniprogram/`：微信小程序端原型，包含 CloudBase 云函数版本。

## 网页端

本地预览：

```powershell
cd "D:\Leo\CodexWP\traveling app\web"
python -m http.server 5173
```

然后打开：

```text
http://localhost:5173
```

真实部署和 Supabase 配置见：

```text
web/REAL_WEB_SETUP.md
```

## 小程序端

用微信开发者工具导入：

```text
D:\Leo\CodexWP\traveling app\miniprogram
```

云开发配置见：

```text
miniprogram/CLOUD_SETUP.md
```
