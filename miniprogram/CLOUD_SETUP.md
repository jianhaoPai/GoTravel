# 微信云开发接入步骤

## 1. 开通云开发

1. 在微信开发者工具右上角确认已经登录。
2. 点击顶部工具栏里的「云开发」。
3. 按提示开通一个云开发环境。
4. 复制环境 ID，形如：

```text
cloud1-xxxxxx
```

## 2. 填写小程序配置

打开 `config/env.js`，把 `cloudEnvId` 改成你的云开发环境 ID：

```js
module.exports = {
  cloudEnvId: 'cloud1-xxxxxx',
  useMockDataWhenNoCloud: true,
  fallbackToMockOnCloudError: false
};
```

如果你已经有正式小程序 AppID，也把 `project.config.json` 里的 `appid` 换成正式 AppID。

## 3. 创建数据库集合

在云开发控制台的「数据库」里创建这些集合：

- `trips`
- `members`
- `places`
- `comments`
- `placeReactions`
- `routePlans`

集合先创建为空即可，第一条真实数据会在小程序里点击「创建」时写入。

## 4. 部署云函数

在微信开发者工具左侧找到 `cloudfunctions` 目录，对每个云函数执行：

1. 右键云函数目录，例如 `createTrip`
2. 选择「上传并部署：云端安装依赖」

需要部署的函数：

- `createTrip`
- `joinTrip`
- `listTripData`
- `getPlace`
- `savePlace`
- `toggleReaction`
- `saveRoute`

## 5. 编译并验证

1. 点击「编译」。
2. 首页会显示「新的旅行」。
3. 填写旅行名称、城市、日期，点击「创建」。
4. 创建成功后，数据会写入云数据库。
5. 点击「分享」发给朋友，朋友进入后会通过 `joinTrip` 加入同一个旅行房间。

## 常见问题

- 如果提示「云开发调用失败」，先确认 `config/env.js` 的 `cloudEnvId` 是否正确。
- 如果某个功能失败，确认对应云函数已经上传并部署。
- 如果数据库里没有集合，云函数会报错；先创建集合再试。
- 当前数据库规则建议关闭客户端直连读写，数据权限由云函数校验。
