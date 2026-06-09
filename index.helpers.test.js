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
