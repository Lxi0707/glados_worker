// KV命名空间：`GLADOS_KV`
// 环境变量：
//   - `GLADOS_COOKIE`   GLADOS_COOKIE多个账号需使用 '&' 隔开，示例：cookie&cookie 示例 参考格式：koa:sess=eyJ1c2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxAwMH0=; koa:sess.sig=xJkOxxxxxxxxxxxxxxxtnM;
// Cron触发器：`30 1 * * *`

const HTML_TEMPL    ATE = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport"content="width=device-width,initial-scale=1"><title>GLaDOS签到</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css"rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js"></script></head><body class="bg-gray-100 min-h-screen"><div class="container mx-auto px-4 py-8"><div class="bg-white rounded-lg shadow-lg p-6 mb-6"><h1 class="text-2xl font-bold text-gray-800 mb-4">GLaDOS签到状态</h1><div class="space-y-4"><div class="flex items-center justify-between"><span class="text-gray-600">上次签到:</span> <span id="lastCheck"class="text-gray-800">LAST_CHECK_TIME</span></div><div class="flex items-center justify-between"><span class="text-gray-600">状态:</span> <span id="status"class="text-STATUS_COLOR-500">STATUS_TEXT</span></div></div></div><div class="bg-white rounded-lg shadow-lg p-6"><h2 class="text-xl font-bold text-gray-800 mb-4">账号状态</h2><div id="accounts"class="space-y-4">ACCOUNTS_HTML</div></div><div class="mt-6 text-center"><button onclick="checkin()"class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">手动签到</button></div></div><script>async function checkin(){try{const e=await Swal.fire({title:"确认签到?",icon:"question",showCancelButton:!0,confirmButtonText:"确定",cancelButtonText:"取消"});e.isConfirmed&&(Swal.fire({title:"签到中...",allowOutsideClick:!1,didOpen:()=>{Swal.showLoading()}}),fetch("/checkin",{method:"POST"}).then(e=>e.json()).then(async e=>{e.success?(await Swal.fire({icon:"success",title:"签到成功",timer:2e3}),location.reload()):(console.error(e),await Swal.fire({icon:"error",title:"签到失败",text:e.message}))}).catch(async e=>{console.error(e),await Swal.fire({icon:"error",title:"请求失败",text:e.message})}))}catch(e){console.error(e),await Swal.fire({icon:"error",title:"发生错误",text:e.message})}}</script></body></html>`;

export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);
            if (request.method === "POST" && url.pathname === "/checkin") {
                return await handleCheckin(env);
            }
            return await handleRequest(env);
        } catch (err) {
            return new Response(err.stack, { status: 500 });
        }
    },
    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleCheckin(env));
    },
};

async function handleRequest(env) {
    const results = await getStoredResults(env);
    const lastCheck = await env.GLADOS_KV.get("lastCheck") || "未签到";
    
    let statusColor = "gray";
    let statusText = "未知";
    let accountsHtml = "";

    if (results.length > 0) {
        statusColor = results.every(r => r.success) ? "green" : "red";
        statusText = results.every(r => r.success) ? "正常" : "异常";
        
        accountsHtml = results.map(r => `
            <div class="border-b border-gray-200 pb-4">
                <div class="flex items-center justify-between">
                    <span class="text-gray-600">${r.email}</span>
                    <span class="text-${r.success ? "green" : "red"}-500">
                        ${r.success ? "✓" : "✗"} ${r.message}
                    </span>
                </div>
                ${r.days ? `
                <div class="mt-2 text-sm text-gray-500">
                    剩余天数: ${r.days}天
                </div>
                ` : ""}
            </div>
        `).join("");
    } else {
        accountsHtml = '<div class="text-gray-500">暂无签到记录</div>';
    }

    const html = HTML_TEMPLATE
        .replace('LAST_CHECK_TIME', lastCheck)
        .replace('STATUS_COLOR', statusColor)
        .replace('STATUS_TEXT', statusText)
        .replace('ACCOUNTS_HTML', accountsHtml);

    return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
}

async function handleCheckin(env) {
    const results = [];
    const cookies = env.GLADOS_COOKIE.split("&");

    for (const cookie of cookies) {
        if (!cookie) continue;

        try {
            const headers = {
                cookie,
                "referer": "https://glados.rocks/console/checkin",
                "origin": "https://glados.rocks",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "content-type": "application/json;charset=UTF-8"
            };

            // 签到
            const checkinRes = await fetch("https://glados.rocks/api/user/checkin", {
                method: "POST",
                headers,
                body: JSON.stringify({ token: "glados.one" })
            });

            // 获取状态
            const statusRes = await fetch("https://glados.rocks/api/user/status", {
                headers
            });

            const checkinData = await checkinRes.json();
            const statusData = await statusRes.json();

            const result = {
                email: statusData.data.email,
                days: statusData.data.leftDays.split(".")[0],
                success: !!checkinData.message,
                message: checkinData.message || "签到失败",
                time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
            };

            results.push(result);

            if (!result.success && env.TELEGRAM_TOKEN && env.TELEGRAM_USERID) {
                // 失败时发送 Telegram 通知
                const errorMessage = `${result.email} 更新 Cookie 失败，签到失败，请更新 Cookie`;
                await sendTelegramNotification(env.TELEGRAM_TOKEN, env.TELEGRAM_USERID, errorMessage);
            }

        } catch (error) {
            console.error("签到失败:", error);
            results.push({
                email: "未知账号",
                success: false,
                message: error.message,
                time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
            });
        }
    }

    // 保存结果
    await env.GLADOS_KV.put("results", JSON.stringify(results));
    await env.GLADOS_KV.put("lastCheck", 
        new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    );

    // 发送 Telegram 通知
    if (env.TELEGRAM_TOKEN && env.TELEGRAM_USERID && results.length > 0) {
        const content = results.map(r =>
            `${r.email}: ${r.success ? "成功" : "失败"} - ${r.message}${r.days ? ` (剩余${r.days}天)` : ""}`
        ).join("\n");

        const summaryMessage = `GLaDOS 签到结果:\n\n${content}`;
        await sendTelegramNotification(env.TELEGRAM_TOKEN, env.TELEGRAM_USERID, summaryMessage);
    }

    return new Response(JSON.stringify({
        success: true,
        results
    }), {
        headers: { "Content-Type": "application/json" }
    });
}

async function getStoredResults(env) {
    const stored = await env.GLADOS_KV.get("results");
    return stored ? JSON.parse(stored) : [];
}

async function sendTelegramNotification(token, userId, message) {
    try {
        const url = new URL(`https://api.telegram.org/bot${token}/sendMessage`);
        url.searchParams.set("chat_id", userId);
        url.searchParams.set("text", message);
        
        await fetch(url.toString());
    } catch (error) {
        console.error("发送 Telegram 通知失败:", error);
    }
}
