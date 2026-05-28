(async function generateTeamHostedLink() {
  console.log("⏳ [team-link] 正在获取 Session Token...");

  // ── 1. 获取当前登录的 Access Token ──────────────────────────────────────
  let accessToken;
  try {
    const session = await fetch("/api/auth/session").then((r) => r.json());
    accessToken = session?.accessToken;
    if (!accessToken) throw new Error("accessToken 为空");
  } catch (e) {
    console.error("❌ [team-link] 获取 Token 失败，请确保已登录 ChatGPT：", e.message);
    return;
  }
  console.log("✅ [team-link] Token 获取成功");

  // ── 2. 构造请求 Payload ──────────────────────────────────────────────────
  const payload = {
    plan_name: "chatgptteamplan",
    team_plan_data: {
      workspace_name: "myWorkspace",
      price_interval: "month",
      seat_quantity: 2,
    },
    billing_details: {
      country: "AU",
      currency: "AUD",
    },
    cancel_url: "https://chatgpt.com/?promoCode=thinkingmachinesau",
    promo_code: "thinkingmachinesau",
    checkout_ui_mode: "hosted",
  };

  // ── 3. 发送请求 ──────────────────────────────────────────────────────────
  console.log("⏳ [team-link] 正在请求 Stripe 长链接...");
  let data;
  try {
    const response = await fetch(
      "https://chatgpt.com/backend-api/payments/checkout",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    data = await response.json();

    if (!response.ok) {
      console.error("❌ [team-link] 请求失败，HTTP", response.status, data);
      return;
    }
  } catch (e) {
    console.error("❌ [team-link] 网络请求异常：", e.message);
    return;
  }

  // ── 4. 输出结果 ──────────────────────────────────────────────────────────
  const hostedUrl = data?.url || data?.stripe_hosted_url || data?.checkout_url;

  if (!hostedUrl) {
    console.warn("⚠️ [team-link] 未找到长链接，原始响应如下：");
    console.log(data);
    return;
  }

  console.log("─".repeat(60));
  console.log("✅ [team-link] 生成成功！");
  console.log("");
  console.log("📋 Checkout Session ID :", data.checkout_session_id);
  console.log("🏢 Processor Entity    :", data.processor_entity);
  console.log("💰 Plan                : ChatGPT Team（Workspace + 2 Seats）");
  console.log("");
  console.log("🔗 Stripe 长链接：");
  console.log(hostedUrl);
  console.log("─".repeat(60));
})();