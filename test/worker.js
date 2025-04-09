// KV命名空间：GLADOS_KV
// 必需环境变量：
// - GLADOS_COOKIE：多个账号cookie用'&'分隔
// 可选环境变量（用于Telegram通知）：
// - TELEGRAM_BOT_TOKEN
// - TELEGRAM_CHAT_ID

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GLaDOS签到</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css">
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <style>
    .account-item {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
    }
    .success-text { color: #10b981; }
    .error-text { color: #ef4444; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-4">GLaDOS签到状态</h1>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-gray-600">上次签到:</span>
          <span id="lastCheck" class="text-gray-800">LAST_CHECK_TIME</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-600">状态:</span>
          <span id="status" class="text-STATUS_COLOR-500">STATUS_TEXT</span>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">账号状态</h2>
      <div id="accounts" class="space-y-4">ACCOUNTS_HTML</div>
    </div>
    <div class="mt-6 text-center">
      <button id="checkinBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
        手动签到
      </button>
    </div>
  </div>
  <script>
    document.getElementById("checkinBtn").addEventListener("click", async function() {
      try {
        const result = await Swal.fire({
          title: "确认签到?",
          text: "将尝试为所有账号签到",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "确定",
          cancelButtonText: "取消"
        });
        
        if (result.isConfirmed) {
          Swal.fire({
            title: "正在签到...",
            allowOutsideClick: false,
            didOpen: function() {
              Swal.showLoading();
            }
          });
          
          const response = await fetch("/checkin", { method: "POST" });
          const data = await response.json();
          
          if (data.success) {
            let successMsg = "";
            data.results.forEach(function(item) {
              if (item.success) {
                successMsg += item.email + ": " + translateMessage(item.message) + "<br>";
              }
            });
            
            await Swal.fire({
              icon: "success",
              title: "签到成功",
              html: successMsg || "所有账号签到成功",
              timer: 3000
            });
            location.reload();
          } else {
            let errorMsg = "";
            data.results.forEach(function(item) {
              errorMsg += item.email + ": " + translateMessage(item.message) + "<br>";
            });
            
            await Swal.fire({
              icon: "error",
              title: "签到失败",
              html: errorMsg
            });
          }
        }
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "请求失败",
          text: error.message
        });
      }
    });

    function translateMessage(msg) {
      if (!msg) return "未知状态";
      if (msg.includes("Got") && msg.includes("Points")) {
        const points = msg.match(/\\d+/)?.[0] || "0";
        return "✅ 签到成功，获得 " + points + " 积分";
      }
      if (msg.includes("Checkin Repeats")) return "⏰ 今日已签到";
      if (msg.includes("Please Checkin Tomorrow")) return "🔄 请明日再来";
      return msg;
    }
  </script>
</body>
</html>`;

async function sendTelegramNotification(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error("Telegram通知发送失败:", error);
  }
}

async function handleRequest(env) {
  const stored = await env.GLADOS_KV.get("results");
  const results = stored ? JSON.parse(stored) : [];
  const lastCheck = await env.GLADOS_KV.get("lastCheck") || "尚未签到";
  
  let statusColor = "gray";
  let statusText = "未知状态";
  let accountsHtml = "";

  if (results.length > 0) {
    const allSuccess = results.every(function(r) { return r.success; });
    statusColor = allSuccess ? "green" : "red";
    statusText = allSuccess ? "全部成功" : "部分失败";
    
    accountsHtml = results.map(function(r) {
      return `
        <div class="account-item">
          <div class="flex items-center justify-between">
            <span class="font-medium">${r.email}</span>
            <span class="${r.success ? "success-text" : "error-text"}">
              ${r.success ? "✅" : "❌"} ${translateMessage(r.message)}
            </span>
          </div>
          ${r.points ? `
          <div class="text-sm text-gray-500 mt-1">
            当前积分: ${r.points}
          </div>
          ` : ""}
        </div>
      `;
    }).join("");
  } else {
    accountsHtml = '<div class="text-gray-500 py-4 text-center">暂无签到记录</div>';
  }

  const html = HTML_TEMPLATE
    .replace("LAST_CHECK_TIME", lastCheck)
    .replace("STATUS_COLOR", statusColor)
    .replace("STATUS_TEXT", statusText)
    .replace("ACCOUNTS_HTML", accountsHtml);

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

async function handleCheckin(env) {
  const cookies = env.GLADOS_COOKIE.split("&");
  const results = [];
  let notificationMessage = "📋 GLaDOS签到结果\n\n";

  for (const cookie of cookies) {
    if (!cookie.trim()) continue;
    
    try {
      const headers = {
        cookie: cookie.trim(),
        "referer": "https://glados.rocks/console/checkin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "content-type": "application/json"
      };

      // 1. 执行签到
      const checkinRes = await fetch("https://glados.rocks/api/user/checkin", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ token: "glados.one" })
      });
      const checkinData = await checkinRes.json();

      // 2. 获取账户状态
      const statusRes = await fetch("https://glados.rocks/api/user/status", { headers: headers });
      const statusData = await statusRes.json();

      // 3. 处理结果
      const result = {
        email: statusData.data && statusData.data.email || "未知账号",
        points: statusData.data && statusData.data.points,
        success: checkinData.code === 0 || (checkinData.message && checkinData.message.includes("Checkin")),
        message: checkinData.message || checkinData.msg || "签到失败",
        time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
      };
      
      results.push(result);
      notificationMessage += `${result.success ? "✅" : "❌"} ${result.email}: ${translateMessage(result.message)}\n`;
      if (result.points) {
        notificationMessage += `   当前积分: ${result.points}\n`;
      }
      notificationMessage += "\n";

    } catch (error) {
      const errorResult = {
        email: "未知账号",
        success: false,
        message: error.message,
        time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
      };
      results.push(errorResult);
      notificationMessage += `❌ 未知账号: ${error.message}\n\n`;
    }
  }

  // 保存结果
  await env.GLADOS_KV.put("results", JSON.stringify(results));
  await env.GLADOS_KV.put("lastCheck", 
    new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
  );

  // 发送Telegram通知
  await sendTelegramNotification(env, notificationMessage);

  return new Response(JSON.stringify({
    success: results.some(function(r) { return r.success; }),
    results: results
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

function translateMessage(msg) {
  if (!msg) return "未知状态";
  if (msg.includes("Got") && msg.includes("Points")) {
    const points = msg.match(/\d+/)?.[0] || "0";
    return "✅ 签到成功，获得 " + points + " 积分";
  }
  if (msg.includes("Checkin Repeats")) return "⏰ 今日已签到";
  if (msg.includes("Please Checkin Tomorrow")) return "🔄 请明日再来";
  return msg;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/checkin") {
        return await handleCheckin(env);
      }
      return await handleRequest(env);
    } catch (error) {
      await sendTelegramNotification(env, `❌ 签到系统错误: ${error.message}`);
      return new Response(error.stack, { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCheckin(env));
  }
};
