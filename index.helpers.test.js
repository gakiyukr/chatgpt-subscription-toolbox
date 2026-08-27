const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCodexUpdatePayload,
  buildCodexCheckoutLink,
  buildTeamPayload,
  buildPlusPayload,
  clampFabPosition,
  extractCheckoutLink,
  extractCheckoutSessionId,
  getCountryDefaultCurrency,
  getCountryOptionLabel,
  getPanelLayoutMode,
  getDisplayLinkText,
  getPlusSummaryLines,
  hasFabDragExceededThreshold,
  getSuccessMessage,
  normalizeCodexQuantity,
  shouldClosePanelOnDocumentClick,
  authContext,
  billingTime,
  currencyMinorUnit,
  decodeJwtClaims,
  nextSeatTarget,
  previewAmount,
  selectableWorkspaces,
  singleSeatPreviewResult,
  workspaceRows,
} = require("./index.js");

test("team payload preserves seat count, billing, and promo code", () => {
  const payload = buildTeamPayload({
    teamName: "MyTeam",
    country: "TH",
    currency: "THB",
    promoCode: "thinkingmachinesth",
  });

  assert.equal(payload.plan_name, "chatgptteamplan");
  assert.equal(payload.team_plan_data.seat_quantity, 2);
  assert.equal(payload.billing_details.country, "TH");
  assert.equal(payload.billing_details.currency, "THB");
  assert.equal(payload.promo_code, "thinkingmachinesth");
});

test("team payload omits promo_code when blank", () => {
  const payload = buildTeamPayload({
    teamName: "MyTeam",
    country: "US",
    currency: "USD",
    promoCode: "",
  });

  assert.equal("promo_code" in payload, false);
});

test("plus payload preserves fixed campaign and US billing", () => {
  const payload = buildPlusPayload();

  assert.equal(payload.plan_name, "chatgptplusplan");
  assert.equal(payload.billing_details.country, "US");
  assert.equal(payload.billing_details.currency, "USD");
  assert.equal(payload.promo_campaign.promo_campaign_id, "plus-1-month-free");
});

test("link extraction prefers url over fallbacks", () => {
  const link = extractCheckoutLink({
    url: "https://example.com/primary",
    stripe_hosted_url: "https://example.com/fallback-1",
    checkout_url: "https://example.com/fallback-2",
  });

  assert.equal(link, "https://example.com/primary");
});

test("extractCheckoutLink falls back to alternate response fields", () => {
  assert.equal(
    extractCheckoutLink({ stripe_hosted_url: "https://example.com/stripe" }),
    "https://example.com/stripe",
  );
  assert.equal(
    extractCheckoutLink({ checkout_url: "https://example.com/checkout" }),
    "https://example.com/checkout",
  );
});

test("getCountryDefaultCurrency returns USD fallback for unknown country", () => {
  assert.equal(getCountryDefaultCurrency("ZZ"), "USD");
});

test("team payload falls back to MyTeam when team name is blank", () => {
  const payload = buildTeamPayload({
    teamName: "",
    country: "US",
    currency: "USD",
    promoCode: "",
  });

  assert.equal(payload.team_plan_data.workspace_name, "MyTeam");
});

test("extractCheckoutLink builds fallback from checkout_session_id", () => {
  assert.equal(
    extractCheckoutLink({ checkout_session_id: "cs_test_123" }),
    "https://chatgpt.com/checkout/openai_llc/cs_test_123",
  );
});

test("team payload preserves chosen non-default currency", () => {
  const payload = buildTeamPayload({
    teamName: "MyTeam",
    country: "US",
    currency: "EUR",
    promoCode: "",
  });

  assert.equal(payload.billing_details.country, "US");
  assert.equal(payload.billing_details.currency, "EUR");
});

test("document click handler keeps panel open when composedPath includes the panel", () => {
  const panel = {
    contains() {
      return false;
    },
  };
  const fab = {
    contains() {
      return false;
    },
  };
  const detachedTabButton = {};
  const event = {
    target: detachedTabButton,
    composedPath() {
      return [detachedTabButton, panel];
    },
  };

  assert.equal(
    shouldClosePanelOnDocumentClick({
      isOpen: true,
      event,
      panel,
      fab,
    }),
    false,
  );
});

test("country option label uses flag emoji instead of country code", () => {
  assert.equal(getCountryOptionLabel("US"), "🇺🇸 United States");
  assert.equal(getCountryOptionLabel("TH"), "🇹🇭 Thailand");
});

test("hasFabDragExceededThreshold only returns true after enough movement", () => {
  assert.equal(hasFabDragExceededThreshold(100, 100, 103, 104), false);
  assert.equal(hasFabDragExceededThreshold(100, 100, 110, 100), true);
});

test("clampFabPosition keeps the floating button inside the viewport", () => {
  assert.deepEqual(
    clampFabPosition({
      left: -20,
      top: 900,
      viewportWidth: 400,
      viewportHeight: 800,
      fabSize: 54,
      margin: 12,
    }),
    { left: 12, top: 734 },
  );
});

test("plus summary lines match the requested Traditional Chinese wording", () => {
  assert.deepEqual(getPlusSummaryLines(), [
    "US 單月 Paypal，請使用日本IP提長連接",
  ]);
});

test("success message no longer says the payment page opens automatically", () => {
  assert.equal(
    getSuccessMessage(),
    "結帳連結已產生，你可以使用下方按鈕或直接點擊連結開啟付款頁面。",
  );
});

test("display link text truncates long checkout urls", () => {
  const longLink = "https://chatgpt.com/checkout/openai_llc/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const display = getDisplayLinkText(longLink);

  assert.equal(display.includes("..."), true);
  assert.equal(display.startsWith("https://chatgpt.com/checkout/openai_llc/"), true);
  assert.equal(display.endsWith("QRSTUVWXYZ"), true);
});

test("panel layout mode uses a scroll-friendly flex column structure", () => {
  assert.deepEqual(getPanelLayoutMode(), {
    panelDisplay: "flex",
    panelDirection: "column",
    bodyFlex: "1 1 auto",
    bodyMinHeight: 0,
    bodyOverflowY: "auto",
  });
});

test("extractCheckoutSessionId reads the id from a codex_team long link", () => {
  assert.equal(
    extractCheckoutSessionId(
      "https://chatgpt.com/checkout/openai_llc/cs_live_abc123?kind=codex_team",
    ),
    "cs_live_abc123",
  );
});

test("extractCheckoutSessionId prefers an explicit query parameter", () => {
  assert.equal(
    extractCheckoutSessionId(
      "https://chatgpt.com/codex/team/checkout?checkout_session_id=cs_query_999",
    ),
    "cs_query_999",
  );
});

test("extractCheckoutSessionId accepts a bare id and rejects placeholders", () => {
  assert.equal(extractCheckoutSessionId("cs_bare_001"), "cs_bare_001");
  assert.equal(extractCheckoutSessionId("https://chatgpt.com/codex/team/checkout"), "");
  assert.equal(extractCheckoutSessionId(""), "");
});

test("normalizeCodexQuantity falls back to the default for invalid input", () => {
  assert.equal(normalizeCodexQuantity("13"), 13);
  assert.equal(normalizeCodexQuantity(7), 7);
  assert.equal(normalizeCodexQuantity("abc"), 13);
  assert.equal(normalizeCodexQuantity(0), 13);
  assert.equal(normalizeCodexQuantity(-5), 13);
});

test("buildCodexUpdatePayload pins the processor entity and normalizes quantity", () => {
  assert.deepEqual(buildCodexUpdatePayload("cs_test_42", "abc"), {
    checkout_session_id: "cs_test_42",
    processor_entity: "openai_llc",
    credit_purchase_quantity: 13,
  });
  assert.deepEqual(buildCodexUpdatePayload("cs_test_42", 5), {
    checkout_session_id: "cs_test_42",
    processor_entity: "openai_llc",
    credit_purchase_quantity: 5,
  });
});

test("buildCodexCheckoutLink prefers a direct link, else rebuilds from session id", () => {
  assert.equal(
    buildCodexCheckoutLink({ url: "https://pay.stripe.com/session" }, "cs_x"),
    "https://pay.stripe.com/session",
  );
  assert.equal(
    buildCodexCheckoutLink({}, "cs_rebuild_1"),
    "https://chatgpt.com/checkout/openai_llc/cs_rebuild_1?kind=codex_team",
  );
  assert.equal(buildCodexCheckoutLink({}, ""), null);
});

// ===== 席位費用查詢（遷移自 time.txt）=====

// 以 header.payload.signature 結構造一個可解析的假 JWT。
function makeJwt(claims) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "none" })}.${encode(claims)}.signature`;
}

test("decodeJwtClaims parses base64url payload and tolerates invalid tokens", () => {
  const claims = decodeJwtClaims(makeJwt({ "https://api.openai.com/auth": { poid: "ws_1" } }));
  assert.equal(claims["https://api.openai.com/auth"].poid, "ws_1");
  assert.deepEqual(decodeJwtClaims("not-a-jwt"), {});
  assert.deepEqual(decodeJwtClaims(""), {});
});

test("authContext prefers jwt claim account id and falls back through session fields", () => {
  const token = makeJwt({ "https://api.openai.com/auth": { chatgpt_account_id: "ws_claim" } });
  const context = authContext({ accessToken: token });
  assert.equal(context.accessToken, token);
  assert.equal(context.accountId, "ws_claim");

  const fallback = authContext({ accessToken: makeJwt({}), workspace_id: "ws_session" });
  assert.equal(fallback.accountId, "ws_session");

  assert.deepEqual(authContext({}), { accessToken: "", accountId: "" });
});

test("workspaceRows flattens accounts map and filters deactivated rows", () => {
  const rows = workspaceRows({
    account_ordering: ["ws_a", "ws_b", "ws_c"],
    accounts: {
      ws_a: { account: { account_id: "ws_a", name: "Alpha", structure: "workspace" } },
      ws_b: { account: { account_id: "ws_b", name: "Beta", structure: "personal" } },
      ws_c: { account: { account_id: "ws_c", name: "Gamma", structure: "workspace", is_deactivated: true } },
    },
  });

  // 停用帳號在此階段即被過濾，personal 帳號留給 selectableWorkspaces 處理。
  assert.deepEqual(
    rows.map((row) => row.id),
    ["ws_a", "ws_b"],
  );
  assert.equal(rows[0].name, "Alpha");
  assert.equal(rows[1].structure, "personal");
});

test("workspaceRows falls back to wrapper fields and key when account fields are missing", () => {
  const rows = workspaceRows({
    accounts: {
      key_only: {},
      wrapper_named: { account_id: "ws_w", workspace_name: "Wrapper" },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get("key_only").name, "key_only");
  assert.equal(byId.get("ws_w").name, "Wrapper");
});

test("selectableWorkspaces keeps only non-personal rows", () => {
  const rows = [
    { id: "ws_personal", name: "Personal", structure: "personal" },
    { id: "ws_team", name: "Team", structure: "workspace" },
    { id: "ws_blank", name: "Blank", structure: "" },
  ];

  assert.deepEqual(selectableWorkspaces(rows), [rows[1]]);
  assert.deepEqual(selectableWorkspaces(undefined), []);
});

test("currencyMinorUnit maps exceptional currencies to their decimal digits", () => {
  assert.equal(currencyMinorUnit("JPY"), 0);
  assert.equal(currencyMinorUnit("KRW"), 0);
  assert.equal(currencyMinorUnit("BHD"), 3);
  assert.equal(currencyMinorUnit("CLF"), 4);
  assert.equal(currencyMinorUnit("USD"), 2);
  assert.equal(currencyMinorUnit("EUR"), 2);
});

test("previewAmount divides minor units and formats by currency", () => {
  const usd = previewAmount({ amount_due: { amount: 2500, currency: "usd" } });
  assert.equal(usd.amount, 25);
  assert.equal(usd.minorUnit, 2);
  assert.equal(usd.currency, "USD");
  // 格式化字元依環境 locale 資料而異，只斷言數值部分。
  assert.equal(usd.formatted.includes("25.00"), true);

  const jpy = previewAmount({ total_amount: 3000, currency: "JPY" });
  assert.equal(jpy.amount, 3000);
  assert.equal(jpy.minorUnit, 0);
  assert.equal(jpy.formatted.includes("3,000"), true);
});

test("previewAmount throws when amount or currency is missing or invalid", () => {
  assert.throws(() => previewAmount({}), /金額或幣別/);
  assert.throws(() => previewAmount({ amount_due: { amount: 100, currency: "US" } }), /金額或幣別/);
  assert.throws(() => previewAmount({ amount_due: { amount: "x", currency: "USD" } }), /金額無效/);
});

test("billingTime formats to Taipei time and handles empty or raw values", () => {
  const taipei = billingTime("2026-08-27T00:00:00Z");
  assert.equal(taipei.raw, "2026-08-27T00:00:00Z");
  // UTC 00:00 為台北時間 08:00；分隔字元依環境而異，僅斷言日期與時間段。
  assert.equal(taipei.formatted.startsWith("2026/08/27"), true);
  assert.equal(taipei.formatted.includes("08:00:00"), true);

  assert.deepEqual(billingTime(""), { formatted: "未回傳", raw: "" });
  assert.deepEqual(billingTime("not-a-date"), { formatted: "not-a-date", raw: "not-a-date" });
});

test("nextSeatTarget always aims one seat above the current count", () => {
  assert.equal(nextSeatTarget(3, 2), 3);
  assert.equal(nextSeatTarget(3, 10), 11);
});

test("singleSeatPreviewResult validates current seat quantity from preview", () => {
  const result = singleSeatPreviewResult({ current_seat_quantity: 2 }, 3);
  assert.deepEqual(result, { preview: { current_seat_quantity: 2 }, currentSeats: 2, updatedSeats: 3 });

  assert.throws(() => singleSeatPreviewResult({}, 3), /當前席位數/);
  assert.throws(() => singleSeatPreviewResult({ current_seat_quantity: 0 }, 3), /當前席位數/);
});
