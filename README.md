# 📄 glados_worker_sign_in  
建立在 Cloudflare worker 的 glados 自动签到，成功将发送通知到 Telegram

[glados 注册地址](https://glados.rocks) 

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Lxi0707/glados_worker/blob/main/glados.jpg">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/Lxi0707/glados_worker/blob/main/glados.jpg">
  <img alt="自定义图片" src="https://github.com/Lxi0707/glados_worker/blob/main/glados.jpg">
</picture>


👇👇👇
# 基于 [仓库](https://github.com/hailang3014/glados-auto) 进行的修改，原仓库通知使用 pushplus 通知

删除了原先的 sendNotification ，新增 sendTelegramNotification 

更新 handleCheckin

## 2025.4.10更新，解决 bot 未知账号: 失败 - statusData.data.leftDays.split is not a function

更换tg变量名,原变量已更换：

```
TELEGRAM_BOT_TOKEN

TELEGRAM_CHAT_ID
```

## 功能
全自动签到，无需服务器，Web 页面，多账号签到任务，签到结果通过 Telegram 推送，每日自动签到，确保不断签，支持手动签到任务


## 📢📢部署步骤

### 1. 登录 Cloudflare Dashboardrd
注册登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
配置 Cloudflare Workers
创建一个新的 Worker
将本项目 worker.js 文件内容复制到 Worker 脚本编辑器中

### 2. 创建 KV 命名空间 并进行绑定
```
# 在 Workers & Pages -> KV 中创建新的命名空间
命名空间名称：GLADOS_KV
```

### 3. 配置环境变量
在 Worker 的 Settings -> Variables 中添加以下环境变量：

```
GLADOS_COOKIE=你的GLaDOS Cookie

TELEGRAM_BOT_TOKEN=你的Telegram Bot Token

TELEGRAM_CHAT_ID=你的Telegram 用户ID
```

注意：
如果有多个账号，使用 & 分隔多个 Cookie，例如：cookie1&cookie2&cookie3

cookie 自行抓包，这里不做教程


### 4. 在 Worker 的 Triggers 中添加 Cron 触发器：
```
30 1 * * *    # UTC 1:30 (北京时间 9:30)
```

下面是我的TG频道和群组

  <div>
    <a href="https://t.me/LXi_Collection_hall" target="_blank"><img src="https://img.shields.io/badge/Telegram-频道-rgb(170, 220, 245)" /></a>&emsp;
    <a 
href="https://t.me/LxiCollectionhallChat" target="_blank"><img src="https://img.shields.io/badge/Telegram-群组-rgb(49, 204, 121)" /></a>&emsp;
    <!-- visitor -->
    <img src="https://komarev.com/ghpvc/?username=Lxi0707&label=Views&color=0e75b6&style=flat" alt="访问量统计" />&emsp;
    <!-- wakatime -->
    <!-- <a href="https://wakatime.com/@buptsdz"><img src="https://wakatime.com/badge/user/42d0678c-368b-448b-9a77-5d21c5b55352.svg"/></a> -->
  </div>











