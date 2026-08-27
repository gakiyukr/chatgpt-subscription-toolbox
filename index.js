// ==UserScript==
// @name         ChatGPT 訂閱工具箱
// @namespace    local.chatgpt.subscription.toolbox
// @version      1.2.0
// @description  整合 ChatGPT Team、Plus 與 Codex 的結帳連結與席位費用查詢工具。
// @downloadURL  https://cdn.jsdelivr.net/gh/gakiyukr/chatgpt-subscription-toolbox@main/index.js
// @updateURL    https://cdn.jsdelivr.net/gh/gakiyukr/chatgpt-subscription-toolbox@main/index.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// ==/UserScript==

(function subscriptionToolbox(globalScope) {
  "use strict";

  const CHECKOUT_ENDPOINT = "https://chatgpt.com/backend-api/payments/checkout";
  const CODEX_UPDATE_ENDPOINT = "https://chatgpt.com/backend-api/payments/checkout/update";
  const SESSION_ENDPOINT = "/api/auth/session";
  const TEAM_CANCEL_URL = "https://chatgpt.com/";
  const PLUS_CANCEL_URL = "https://chatgpt.com/#pricing";
  const FALLBACK_CHECKOUT_BASE = "https://chatgpt.com/checkout/openai_llc/";

  // Codex Team 的結帳工作階段在那條 ?kind=codex_team 長鏈接內已存在，
  // 必須改打 update 端點調整方案數量，才會取得可用的付款連結。
  const CODEX_PROCESSOR_ENTITY = "openai_llc";
  const CODEX_KIND = "codex_team";
  const CODEX_DEFAULT_QUANTITY = 13;

  // 席位費用查詢常數（遷移自 DevTools 控制台腳本）。
  const AUTH_CLAIM = "https://api.openai.com/auth";
  const SEAT_PREVIEW_START_SEATS = 3;
  const SEAT_PREVIEW_MAX_ATTEMPTS = 3;

  const ZERO_DECIMAL_CURRENCIES = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  const THREE_DECIMAL_CURRENCIES = new Set([
    "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND",
  ]);
  const FOUR_DECIMAL_CURRENCIES = new Set(["CLF", "UYW"]);

  const DOM_IDS = {
    fab: "subscription-toolbox-fab",
    panel: "subscription-toolbox-panel",
    tabTeam: "subscription-toolbox-tab-team",
    tabPlus: "subscription-toolbox-tab-plus",
    tabCodex: "subscription-toolbox-tab-codex",
    tabSeat: "subscription-toolbox-tab-seat",
    panelBody: "subscription-toolbox-panel-body",
    result: "subscription-toolbox-result",
  };

  const COUNTRIES = [
    { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", currencyName: "US Dollar" },
    { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", currencyName: "Canadian Dollar" },
    { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", currencyName: "Mexican Peso" },
    { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", currencyName: "Brazilian Real" },
    { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", currencyName: "Argentine Peso" },
    { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", currencyName: "Chilean Peso" },
    { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", currencyName: "Colombian Peso" },
    { code: "PE", name: "Peru", flag: "🇵🇪", currency: "PEN", currencyName: "Peruvian Sol" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", currencyName: "British Pound" },
    { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", currencyName: "Euro" },
    { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", currencyName: "Euro" },
    { code: "IT", name: "Italy", flag: "🇮🇹", currency: "EUR", currencyName: "Euro" },
    { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", currencyName: "Euro" },
    { code: "NL", name: "Netherlands", flag: "🇳🇱", currency: "EUR", currencyName: "Euro" },
    { code: "CH", name: "Switzerland", flag: "🇨🇭", currency: "CHF", currencyName: "Swiss Franc" },
    { code: "SE", name: "Sweden", flag: "🇸🇪", currency: "SEK", currencyName: "Swedish Krona" },
    { code: "NO", name: "Norway", flag: "🇳🇴", currency: "NOK", currencyName: "Norwegian Krone" },
    { code: "DK", name: "Denmark", flag: "🇩🇰", currency: "DKK", currencyName: "Danish Krone" },
    { code: "PL", name: "Poland", flag: "🇵🇱", currency: "PLN", currencyName: "Polish Zloty" },
    { code: "TR", name: "Turkey", flag: "🇹🇷", currency: "TRY", currencyName: "Turkish Lira" },
    { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", currencyName: "Japanese Yen" },
    { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", currencyName: "South Korean Won" },
    { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", currencyName: "Singapore Dollar" },
    { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "MYR", currencyName: "Malaysian Ringgit" },
    { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", currencyName: "Indonesian Rupiah" },
    { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", currencyName: "Philippine Peso" },
    { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", currencyName: "Thai Baht" },
    { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND", currencyName: "Vietnamese Dong" },
    { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", currencyName: "Indian Rupee" },
    { code: "PK", name: "Pakistan", flag: "🇵🇰", currency: "PKR", currencyName: "Pakistani Rupee" },
    { code: "BD", name: "Bangladesh", flag: "🇧🇩", currency: "BDT", currencyName: "Bangladeshi Taka" },
    { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", currencyName: "UAE Dirham" },
    { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR", currencyName: "Saudi Riyal" },
    { code: "IL", name: "Israel", flag: "🇮🇱", currency: "ILS", currencyName: "Israeli New Shekel" },
    { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", currencyName: "Australian Dollar" },
    { code: "NZ", name: "New Zealand", flag: "🇳🇿", currency: "NZD", currencyName: "New Zealand Dollar" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", currencyName: "South African Rand" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", currencyName: "Nigerian Naira" },
    { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", currencyName: "Egyptian Pound" },
  ];

  const SUPPORTED_CURRENCIES = [
    { code: "USD", name: "US Dollar (USD)" },
    { code: "EUR", name: "Euro (EUR)" },
    { code: "GBP", name: "British Pound (GBP)" },
    { code: "CAD", name: "Canadian Dollar (CAD)" },
    { code: "AUD", name: "Australian Dollar (AUD)" },
    { code: "JPY", name: "Japanese Yen (JPY)" },
    { code: "SGD", name: "Singapore Dollar (SGD)" },
    { code: "INR", name: "Indian Rupee (INR)" },
    { code: "BRL", name: "Brazilian Real (BRL)" },
    { code: "MXN", name: "Mexican Peso (MXN)" },
    { code: "CHF", name: "Swiss Franc (CHF)" },
    { code: "SEK", name: "Swedish Krona (SEK)" },
    { code: "NOK", name: "Norwegian Krone (NOK)" },
    { code: "DKK", name: "Danish Krone (DKK)" },
    { code: "PLN", name: "Polish Zloty (PLN)" },
    { code: "NZD", name: "New Zealand Dollar (NZD)" },
    { code: "MYR", name: "Malaysian Ringgit (MYR)" },
    { code: "IDR", name: "Indonesian Rupiah (IDR)" },
    { code: "PHP", name: "Philippine Peso (PHP)" },
    { code: "THB", name: "Thai Baht (THB)" },
    { code: "VND", name: "Vietnamese Dong (VND)" },
    { code: "KRW", name: "South Korean Won (KRW)" },
    { code: "AED", name: "UAE Dirham (AED)" },
    { code: "SAR", name: "Saudi Riyal (SAR)" },
    { code: "ILS", name: "Israeli New Shekel (ILS)" },
    { code: "ZAR", name: "South African Rand (ZAR)" },
    { code: "TRY", name: "Turkish Lira (TRY)" },
    { code: "ARS", name: "Argentine Peso (ARS)" },
    { code: "CLP", name: "Chilean Peso (CLP)" },
    { code: "COP", name: "Colombian Peso (COP)" },
    { code: "PEN", name: "Peruvian Sol (PEN)" },
    { code: "PKR", name: "Pakistani Rupee (PKR)" },
    { code: "BDT", name: "Bangladeshi Taka (BDT)" },
    { code: "NGN", name: "Nigerian Naira (NGN)" },
    { code: "EGP", name: "Egyptian Pound (EGP)" },
  ];

  const state = {
    activeTab: "team",
    loading: false,
    lastLink: "",
    lastError: "",
    lastTitle: "",
    lastRows: [],
    teamForm: {
      teamName: "MyTeam",
      country: "US",
      currency: "USD",
      promoCode: "",
    },
    codexForm: {
      checkoutLink: "",
      quantity: CODEX_DEFAULT_QUANTITY,
      workspaceName: "work",
    },
    seatForm: {
      workspaces: [],
      loadState: "idle",
      loadError: "",
      selectedId: "",
    },
  };

  const fabDragState = {
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    left: null,
    top: null,
  };

  const FAB_SIZE = 54;
  const FAB_MARGIN = 12;
  const FAB_DRAG_THRESHOLD = 8;

  function getCountryDefaultCurrency(code) {
    const country = COUNTRIES.find((item) => item.code === code);
    return country ? country.currency : "USD";
  }

  function getCountryOptionLabel(code) {
    const country = COUNTRIES.find((item) => item.code === code);
    if (!country) return code;
    return `${country.flag} ${country.name}`;
  }

  function hasFabDragExceededThreshold(startX, startY, currentX, currentY) {
    return Math.hypot(currentX - startX, currentY - startY) >= FAB_DRAG_THRESHOLD;
  }

  function clampFabPosition({ left, top, viewportWidth, viewportHeight, fabSize, margin }) {
    const maxLeft = Math.max(margin, viewportWidth - fabSize - margin);
    const maxTop = Math.max(margin, viewportHeight - fabSize - margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop),
    };
  }

  function getPlusSummaryLines() {
    return ["US 單月 Paypal，請使用日本IP提長連接"];
  }

  function getSuccessMessage() {
    return "結帳連結已產生，你可以使用下方按鈕或直接點擊連結開啟付款頁面。";
  }

  function getDisplayLinkText(link) {
    if (typeof link !== "string") return "";
    if (link.length <= 72) return link;
    return `${link.slice(0, 40)}...${link.slice(-10)}`;
  }

  function getPanelLayoutMode() {
    return {
      panelDisplay: "flex",
      panelDirection: "column",
      bodyFlex: "1 1 auto",
      bodyMinHeight: 0,
      bodyOverflowY: "auto",
    };
  }

  function isCurrencyMatchCountry(countryCode, currencyCode) {
    return getCountryDefaultCurrency(countryCode) === currencyCode;
  }

  function isHttpUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function buildTeamPayload(input) {
    const teamName = (input.teamName || "").trim() || "MyTeam";
    const promoCode = (input.promoCode || "").trim();
    const payload = {
      entry_point: "team_workspace_purchase_modal",
      plan_name: "chatgptteamplan",
      team_plan_data: {
        workspace_name: teamName,
        price_interval: "month",
        seat_quantity: 2,
      },
      billing_details: {
        country: input.country,
        currency: input.currency,
      },
      checkout_ui_mode: "hosted",
      cancel_url: TEAM_CANCEL_URL,
    };

    if (promoCode) {
      payload.promo_code = promoCode;
    }

    return payload;
  }

  function buildPlusPayload() {
    return {
      plan_name: "chatgptplusplan",
      billing_details: {
        country: "US",
        currency: "USD",
      },
      cancel_url: PLUS_CANCEL_URL,
      promo_campaign: {
        promo_campaign_id: "plus-1-month-free",
        is_coupon_from_query_param: false,
      },
      checkout_ui_mode: "hosted",
    };
  }

  function extractCheckoutLink(data) {
    if (isHttpUrl(data?.url)) return data.url;
    if (isHttpUrl(data?.stripe_hosted_url)) return data.stripe_hosted_url;
    if (isHttpUrl(data?.checkout_url)) return data.checkout_url;
    if (data?.checkout_session_id) {
      return `${FALLBACK_CHECKOUT_BASE}${data.checkout_session_id}`;
    }
    return null;
  }

  // 從 Codex Team 長鏈接或裸 ID 取出 checkout_session_id。
  // 支援完整網址（含 ?kind=codex_team 等查詢參數）與直接貼上的 ID。
  function extractCheckoutSessionId(input) {
    const raw = (input || "").trim();
    if (!raw) return "";

    let candidate = raw;
    if (isHttpUrl(raw)) {
      try {
        const url = new URL(raw);
        const fromQuery =
          url.searchParams.get("checkout_session_id") ||
          url.searchParams.get("checkoutSessionId");
        const segments = url.pathname.split("/").filter(Boolean);
        const fromPath = segments.length ? segments[segments.length - 1] : "";
        candidate = fromQuery || fromPath || "";
      } catch (_) {
        candidate = "";
      }
    }

    // 入口網址可能停在 /checkout 等佔位字段，並非真正的 session id。
    const placeholders = new Set(["checkout", "team", "codex", "openai_llc"]);
    if (!candidate || placeholders.has(candidate)) return "";
    return candidate;
  }

  // 將數量規整為大於等於 1 的整數，無法解析時退回預設值。
  function normalizeCodexQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return CODEX_DEFAULT_QUANTITY;
    }
    return parsed;
  }

  function buildCodexUpdatePayload(checkoutSessionId, quantity) {
    return {
      checkout_session_id: checkoutSessionId,
      processor_entity: CODEX_PROCESSOR_ENTITY,
      credit_purchase_quantity: normalizeCodexQuantity(quantity),
    };
  }

  // Codex 直連結帳：直接打 /checkout 端點，不需事先取得 checkout_session_id。
  function buildCodexDirectPayload(input) {
    const workspaceName = (input.workspaceName || "work").trim() || "work";
    return {
      plan_name: "chatgptbusiness_usage_based",
      entry_point: "team_workspace_purchase_modal",
      checkout_ui_mode: "hosted",
      billing_details: {
        country: "US",
        currency: "USD",
      },
      usage_based_workspace_credit_purchase_data: {
        workspace_name: workspaceName,
        quantity: normalizeCodexQuantity(input.quantity),
        unit: "credit",
      },
      cancel_url: PLUS_CANCEL_URL,
    };
  }

  // update 端點未必回傳付款連結，必要時依 session id 組回 Codex Team 結帳頁。
  function buildCodexCheckoutLink(data, checkoutSessionId) {
    const direct = extractCheckoutLink(data);
    if (isHttpUrl(direct)) return direct;
    if (checkoutSessionId) {
      return `${FALLBACK_CHECKOUT_BASE}${checkoutSessionId}?kind=${CODEX_KIND}`;
    }
    return null;
  }

  function shouldClosePanelOnDocumentClick({ isOpen, event, panel, fab }) {
    if (!isOpen || !panel || !fab || !event) return false;

    const path = typeof event.composedPath === "function" ? event.composedPath() : null;
    if (Array.isArray(path) && (path.includes(panel) || path.includes(fab))) {
      return false;
    }

    const target = event.target;
    if (target && (panel.contains(target) || fab.contains(target))) {
      return false;
    }

    return true;
  }

  async function parseJsonResponse(response, label) {
    const rawText = await response.text();
    let data = {};

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        const preview = rawText.length > 500 ? `${rawText.slice(0, 500)}...` : rawText;
        throw new Error(`${label} 未回傳有效的 JSON。HTTP ${response.status} ${response.statusText}\n${preview}`);
      }
    }

    if (!response.ok) {
      const detail = data && (data.detail || data.error || data.message);
      throw new Error(
        `${label} 請求失敗。HTTP ${response.status} ${response.statusText}${detail ? `\n${detail}` : ""}`,
      );
    }

    return data;
  }

  // 席位查詢的回應解析：預覽端點對錯誤結構更敏感，統一在此萃取錯誤訊息。
  async function requestJson(url, options = {}, label = "請求") {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {};
      }
    }
    if (!response.ok) {
      const error = data?.error && typeof data.error === "object" ? data.error : {};
      const detail = firstText(
        error.message,
        error.code,
        data?.message,
        data?.detail,
        text.slice(0, 240),
      );
      throw new Error(`${label}失敗：HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`${label}失敗：回應不是 JSON 物件`);
    }
    return data;
  }

  async function getSession() {
    const response = await fetch(SESSION_ENDPOINT, { credentials: "include" });
    const session = await parseJsonResponse(response, "Session");
    if (!session.accessToken) {
      throw new Error("缺少 accessToken，請重新登入 ChatGPT。");
    }
    return session;
  }

  // 讀取登入會話（沿用控制台腳本行為：寬鬆解析、缺 token 時給出明確錯誤）。
  async function fetchSeatInitialSession() {
    const session = await requestJson("/api/auth/session", {}, "讀取登入會話");
    const context = authContext(session);
    if (!context.accessToken) throw new Error("目前頁面沒有有效的登入會話");
    return { session, context };
  }

  async function fetchWorkspaceAccounts(accessToken) {
    return requestJson(
      "/backend-api/accounts/check/v4-2023-04-27",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "讀取 Workspace 列表",
    );
  }

  // 以 workspace 為作用域交換出一個新的 session（透過 _account 等 context cookies）。
  async function workspaceSession(workspaceId, initialSession) {
    const initial = authContext(initialSession);
    if (initial.accountId === workspaceId && initial.accessToken) return initial;

    const query = new URLSearchParams({
      exchange_workspace_token: "true",
      workspace_id: workspaceId,
      reason: "setCurrentAccount",
    });
    const contextCookies = [
      ["_account", workspaceId],
      ["_account_is_fedramp", "false"],
      ["_account_residency_region", "no_constraint"],
    ];
    const previousCookies = new Map(
      contextCookies.map(([name]) => [name, document.cookie]),
    );
    let session;
    try {
      for (const [name, value] of contextCookies) {
        document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax`;
      }
      session = await requestJson(
        `/api/auth/session?${query}`,
        {
          headers: {
            "X-OpenAI-Target-Path": "/api/auth/session",
            "X-OpenAI-Target-Route": "/api/auth/session",
          },
        },
        "切換 Workspace 上下文",
      );
    } finally {
      // 還原使用者原本的帳號上下文 cookies，避免影響當前頁面登入狀態。
      for (const [name] of contextCookies) {
        const previous = previousCookies.get(name);
        if (previous) document.cookie = previous;
        else {
          document.cookie = `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
        }
      }
    }
    const context = authContext(session);
    if (!context.accessToken) throw new Error("Workspace 會話未回傳 Access Token");
    if (context.accountId && context.accountId !== workspaceId) {
      throw new Error(`Workspace 切換結果不匹配：${context.accountId}`);
    }
    return { ...context, accountId: workspaceId };
  }

  // 只讀的席位費用預覽，不會真的更新訂閱。
  async function previewSeatCost(accessToken, workspaceId, updatedSeats) {
    const query = new URLSearchParams({
      account_id: workspaceId,
      updated_seats: String(updatedSeats),
    });
    return requestJson(
      `/backend-api/subscriptions/update/preview?${query}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "chatgpt-account-id": workspaceId,
        },
      },
      "讀取席位費用",
    );
  }

  // 查詢「新增 1 席」的費用：先以預設席數探測，再對齊實際席數 + 1。
  async function singleSeatPreview(accessToken, workspaceId) {
    let targetSeats = SEAT_PREVIEW_START_SEATS;
    for (let attempt = 0; attempt < SEAT_PREVIEW_MAX_ATTEMPTS; attempt += 1) {
      const preview = await previewSeatCost(accessToken, workspaceId, targetSeats);
      const result = singleSeatPreviewResult(preview, targetSeats);
      const desired = nextSeatTarget(targetSeats, result.currentSeats);
      if (targetSeats === desired) {
        return result;
      }
      targetSeats = desired;
    }
    throw new Error("檢測期間當前席位數連續變化，請稍後再試");
  }

  async function postCheckout(accessToken, payload) {
    const response = await fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response, "Checkout");
  }

  // Codex Team 走 update 端點，需附帶與瀏覽器一致的裝置與語系標頭。
  async function postCodexUpdate(accessToken, payload) {
    const response = await fetch(CODEX_UPDATE_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "oai-device-id": getDeviceId(),
        "oai-language": "zh-CN",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response, "Codex Checkout");
  }

  function getDeviceId() {
    try {
      return globalScope.localStorage?.getItem("oai-device-id") || "";
    } catch (_) {
      return "";
    }
  }

  // ===== 席位費用查詢（遷移自 DevTools 控制台腳本 time.txt）=====

  function firstText(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  // 解析 JWT 的 payload 段，取出帳號上下文；解析失敗時回傳空物件。
  function decodeJwtClaims(token) {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    try {
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const bytes = Uint8Array.from(atob(padded), (value) => value.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return {};
    }
  }

  function authContext(session) {
    const account = session?.account && typeof session.account === "object"
      ? session.account
      : {};
    const claims = decodeJwtClaims(session?.accessToken);
    const auth = claims?.[AUTH_CLAIM] && typeof claims[AUTH_CLAIM] === "object"
      ? claims[AUTH_CLAIM]
      : {};
    return {
      accessToken: firstText(session?.accessToken, session?.access_token),
      accountId: firstText(
        auth.chatgpt_account_id,
        auth.poid,
        session?.chatgpt_account_id,
        session?.account_id,
        session?.workspace_id,
        account.id,
        account.account_id,
      ),
    };
  }

  // 從 accounts/check 回應整理出可用（未停用且非 personal）的 workspace 列表。
  function workspaceRows(payload) {
    const accounts = payload?.accounts && typeof payload.accounts === "object"
      ? payload.accounts
      : {};
    const ordering = Array.isArray(payload?.account_ordering)
      ? payload.account_ordering.map(String)
      : Object.keys(accounts);
    const ids = [...new Set([...ordering, ...Object.keys(accounts)])];
    return ids
      .map((key) => {
        const wrapper = accounts[key] && typeof accounts[key] === "object"
          ? accounts[key]
          : {};
        const account = wrapper.account && typeof wrapper.account === "object"
          ? wrapper.account
          : wrapper;
        return {
          id: firstText(account.account_id, account.id, wrapper.account_id, key),
          name: firstText(
            account.name,
            account.workspace_name,
            wrapper.name,
            wrapper.workspace_name,
            key,
          ),
          structure: firstText(account.structure, wrapper.structure).toLowerCase(),
          deactivated: account.is_deactivated === true || wrapper.is_deactivated === true,
        };
      })
      .filter((row) => row.id && !row.deactivated);
  }

  function isWorkspaceRowSelectable(row) {
    return Boolean(row && row.structure && row.structure !== "personal");
  }

  // 席位查詢只认 Team/Business workspace；personal 帳號無席位概念。
  function selectableWorkspaces(rows) {
    return (Array.isArray(rows) ? rows : []).filter(isWorkspaceRowSelectable);
  }

  // 金額以 minor unit 儲存，依幣別的小數位數還原為實際數值。
  function currencyMinorUnit(currency) {
    if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
    if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
    if (FOUR_DECIMAL_CURRENCIES.has(currency)) return 4;
    return 2;
  }

  // 從費用預覽回應取金額、幣別並格式化；金額或幣別無效時擲錯。
  function previewAmount(preview) {
    const amountDue = preview?.amount_due && typeof preview.amount_due === "object"
      ? preview.amount_due
      : {};
    const rawAmount = amountDue.amount ?? preview?.total_amount;
    const currency = firstText(preview?.currency, amountDue.currency).toUpperCase();
    if (rawAmount === undefined || rawAmount === null || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error("費用預覽未回傳有效的金額或幣別");
    }
    const minorUnit = currencyMinorUnit(currency);
    const amount = Number(rawAmount) / 10 ** minorUnit;
    if (!Number.isFinite(amount)) throw new Error("費用預覽金額無效");
    let formatted;
    try {
      formatted = new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency,
        minimumFractionDigits: minorUnit,
        maximumFractionDigits: minorUnit,
      }).format(amount);
    } catch (_) {
      formatted = `${currency} ${amount.toFixed(minorUnit)}`;
    }
    return { amount, currency, minorUnit, formatted };
  }

  // 帳單時間統一以台北時間顯示；無法解析時原樣回傳。
  function billingTime(value) {
    const raw = firstText(value);
    if (!raw) return { formatted: "未回傳", raw: "" };
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return { formatted: raw, raw };
    return {
      formatted: new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date),
      raw,
    };
  }

  // 以「當前席數 + 1」反覆校正預覽席數，避免查詢期間席數變動造成誤差。
  function nextSeatTarget(targetSeats, currentSeats) {
    return currentSeats + 1;
  }

  function singleSeatPreviewResult(preview, targetSeats) {
    const currentSeats = Number(preview?.current_seat_quantity);
    if (!Number.isInteger(currentSeats) || currentSeats < 1) {
      throw new Error("費用預覽未回傳當前席位數");
    }
    return { preview, currentSeats, updatedSeats: targetSeats };
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
    document.body.appendChild(textArea);
    textArea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("複製失敗。");
      }
    } finally {
      textArea.remove();
    }
  }

  function installStyles() {
    const css = `
      :root {
        --subscription-toolbox-panel-display: ${getPanelLayoutMode().panelDisplay};
        --subscription-toolbox-panel-direction: ${getPanelLayoutMode().panelDirection};
        --subscription-toolbox-body-flex: ${getPanelLayoutMode().bodyFlex};
        --subscription-toolbox-body-min-height: ${getPanelLayoutMode().bodyMinHeight}px;
        --subscription-toolbox-body-overflow-y: ${getPanelLayoutMode().bodyOverflowY};
      }

      #${DOM_IDS.fab} {
        position: fixed !important;
        right: 24px !important;
        bottom: 24px !important;
        z-index: 2147483646 !important;
        width: 54px !important;
        height: 54px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 16px 38px rgba(14, 165, 233, 0.28) !important;
        cursor: pointer !important;
        font: 700 20px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        touch-action: none !important;
        user-select: none !important;
      }

      #${DOM_IDS.fab}:hover {
        transform: translateY(-1px);
      }

      #${DOM_IDS.panel} {
        position: fixed;
        right: 24px;
        bottom: 92px;
        width: min(92vw, 420px);
        max-height: min(80vh, 900px);
        display: var(--subscription-toolbox-panel-display);
        flex-direction: var(--subscription-toolbox-panel-direction);
        border-radius: 22px;
        background: #fbfcfe;
        border: 1px solid rgba(15, 118, 110, 0.1);
        box-shadow: 0 22px 60px rgba(15, 23, 42, 0.18);
        overflow: hidden;
        z-index: 2147483647;
        color: #0f172a;
        visibility: hidden;
        pointer-events: none;
      }

      #${DOM_IDS.panel}.is-open {
        visibility: visible;
        pointer-events: auto;
      }

      .subscription-toolbox-header {
        padding: 18px 20px;
        background: linear-gradient(140deg, #0f766e 0%, #0284c7 100%);
        color: #ffffff;
      }

      .subscription-toolbox-header-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
      }

      .subscription-toolbox-title {
        margin: 0;
        font-size: 17px;
        line-height: 1.3;
      }

      .subscription-toolbox-subtitle {
        margin: 6px 0 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.86);
      }

      .subscription-toolbox-close {
        border: 0;
        background: transparent;
        color: rgba(255, 255, 255, 0.9);
        font-size: 22px;
        cursor: pointer;
      }

      .subscription-toolbox-body {
        flex: var(--subscription-toolbox-body-flex);
        min-height: var(--subscription-toolbox-body-min-height);
        padding: 18px 18px 20px;
        display: grid;
        gap: 16px;
        overflow-y: var(--subscription-toolbox-body-overflow-y);
      }

      .subscription-toolbox-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 8px;
      }

      .subscription-toolbox-tab {
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        padding: 10px 12px;
        border-radius: 12px;
        font: 700 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      .subscription-toolbox-tab.is-active {
        border-color: transparent;
        color: #ffffff;
        background: linear-gradient(135deg, #0f766e 0%, #0284c7 100%);
      }

      .subscription-toolbox-card {
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 16px;
        background: #ffffff;
      }

      .subscription-toolbox-grid {
        display: grid;
        gap: 14px;
      }

      .subscription-toolbox-grid.two-cols {
        grid-template-columns: 1fr 1fr;
      }

      .subscription-toolbox-field label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #475569;
      }

      .subscription-toolbox-field input,
      .subscription-toolbox-field select {
        width: 100%;
        box-sizing: border-box;
        padding: 11px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        font-size: 13px;
        background: #ffffff;
        color: #0f172a;
      }

      .subscription-toolbox-hint {
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        border: 1px solid;
      }

      .subscription-toolbox-hint.is-match {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      .subscription-toolbox-hint.is-mismatch {
        color: #b91c1c;
        background: #fef2f2;
        border-color: #fecaca;
      }

      .subscription-toolbox-plus-summary {
        display: grid;
        gap: 10px;
      }

      .subscription-toolbox-plus-badge {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: #ecfeff;
        color: #0f766e;
        font-size: 12px;
        font-weight: 700;
      }

      .subscription-toolbox-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .subscription-toolbox-primary,
      .subscription-toolbox-secondary {
        border: 0;
        border-radius: 12px;
        padding: 12px 14px;
        color: #ffffff;
        cursor: pointer;
        font: 700 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .subscription-toolbox-primary {
        background: linear-gradient(135deg, #0f766e 0%, #0284c7 100%);
      }

      .subscription-toolbox-secondary {
        background: #2563eb;
      }

      .subscription-toolbox-primary:disabled,
      .subscription-toolbox-secondary:disabled {
        cursor: not-allowed;
        opacity: 0.68;
      }

      .subscription-toolbox-result {
        display: none;
        border-radius: 16px;
        padding: 14px;
        border: 1px solid;
        gap: 12px;
      }

      .subscription-toolbox-result.is-visible {
        display: grid;
      }

      .subscription-toolbox-result.is-success {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
      }

      .subscription-toolbox-result.is-error {
        background: #fef2f2;
        border-color: #fecaca;
        color: #b91c1c;
      }

      .subscription-toolbox-result.is-rows {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #0f172a;
      }

      .subscription-toolbox-result-row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr);
        gap: 10px;
        align-items: baseline;
        padding: 6px 0;
        border-bottom: 1px solid #e2e8f0;
      }

      .subscription-toolbox-result-row:last-child {
        border-bottom: 0;
      }

      .subscription-toolbox-result-label {
        font-size: 12px;
        color: #64748b;
      }

      .subscription-toolbox-result-value {
        font-size: 13px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }

      .subscription-toolbox-result-row.is-primary .subscription-toolbox-result-value {
        font-size: 18px;
        font-weight: 700;
        color: #0f766e;
      }

      .subscription-toolbox-result-title {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
      }

      .subscription-toolbox-result-text {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .subscription-toolbox-link {
        display: block;
        color: #0369a1;
        word-break: break-all;
        text-decoration: none;
      }

      .subscription-toolbox-link:hover {
        text-decoration: underline;
      }

      @media (max-width: 640px) {
        #${DOM_IDS.panel} {
          right: 12px;
          left: 12px;
          bottom: 84px;
          width: auto;
        }

        .subscription-toolbox-grid.two-cols {
          grid-template-columns: 1fr;
        }
      }
    `;

    if (typeof GM_addStyle === "function") {
      GM_addStyle(css);
      return;
    }

    const style = document.createElement("style");
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function setPanelOpen(isOpen) {
    const panel = document.getElementById(DOM_IDS.panel);
    if (!panel) return;
    panel.classList.toggle("is-open", isOpen);
  }

  function applyFabPosition() {
    const fab = document.getElementById(DOM_IDS.fab);
    if (!fab) return;

    if (typeof fabDragState.left === "number" && typeof fabDragState.top === "number") {
      fab.style.left = `${fabDragState.left}px`;
      fab.style.top = `${fabDragState.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    } else {
      fab.style.left = "";
      fab.style.top = "";
      fab.style.right = "24px";
      fab.style.bottom = "24px";
    }
  }

  function updateTeamField(name, value) {
    state.teamForm[name] = value;
    renderBody();
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    renderBody();
  }

  function setResult(result) {
    state.lastLink = result.link || "";
    state.lastError = result.error || "";
    state.lastTitle = result.title || "";
    state.lastRows = Array.isArray(result.rows) ? result.rows : [];
    renderResult();
  }

  function clearResult() {
    state.lastLink = "";
    state.lastError = "";
    state.lastTitle = "";
    state.lastRows = [];
    renderResult();
  }

  function getResultContainer() {
    return document.getElementById(DOM_IDS.result);
  }

  function renderResult() {
    const container = getResultContainer();
    if (!container) return;

    container.innerHTML = "";
    container.className = "subscription-toolbox-result";

    if (!state.lastLink && !state.lastError) {
      return;
    }

    if (state.lastLink) {
      container.classList.add("is-visible", "is-success");
      container.appendChild(createElement("p", "subscription-toolbox-result-title", "已產生結帳連結"));
      container.appendChild(
        createElement(
          "p",
          "subscription-toolbox-result-text",
          getSuccessMessage(),
        ),
      );

      const link = document.createElement("a");
      link.className = "subscription-toolbox-link";
      link.href = state.lastLink;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = getDisplayLinkText(state.lastLink);
      link.title = state.lastLink;
      container.appendChild(link);

      const actions = createElement("div", "subscription-toolbox-actions");
      const copyButton = createElement("button", "subscription-toolbox-secondary", "複製連結");
      copyButton.type = "button";
      copyButton.addEventListener("click", async () => {
        const originalText = copyButton.textContent;
        try {
          await copyToClipboard(state.lastLink);
          copyButton.textContent = "已複製";
        } catch (error) {
          console.error("複製結帳連結失敗", error);
          copyButton.textContent = "複製失敗";
        }
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1400);
      });

      const openButton = createElement("button", "subscription-toolbox-primary", "開啟付款頁面");
      openButton.type = "button";
      openButton.addEventListener("click", () => {
        window.open(state.lastLink, "_blank", "noopener,noreferrer");
      });

      actions.appendChild(openButton);
      actions.appendChild(copyButton);
      container.appendChild(actions);
      return;
    }

    if (state.lastRows.length) {
      // 席位查詢等非連結結果：以「標題 + 標籤／數值列」呈現。
      container.classList.add("is-visible", "is-rows");
      container.appendChild(
        createElement("p", "subscription-toolbox-result-title", state.lastTitle || "查詢結果"),
      );
      for (const row of state.lastRows) {
        const item = createElement("div", "subscription-toolbox-result-row");
        item.classList.add(row.primary ? "is-primary" : "is-normal");
        item.appendChild(
          createElement("span", "subscription-toolbox-result-label", row.label),
        );
        item.appendChild(
          createElement("span", "subscription-toolbox-result-value", row.value),
        );
        container.appendChild(item);
      }
      return;
    }

    container.classList.add("is-visible", "is-error");
    container.appendChild(createElement("p", "subscription-toolbox-result-title", "產生結帳連結失敗"));
    container.appendChild(createElement("p", "subscription-toolbox-result-text", state.lastError));
  }

  function renderCurrencyHint() {
    const hint = createElement("div", "subscription-toolbox-hint");
    const match = isCurrencyMatchCountry(state.teamForm.country, state.teamForm.currency);
    hint.classList.add(match ? "is-match" : "is-mismatch");
    hint.textContent = match
      ? "地區與幣別相符。"
      : "目前幣別與此地區的預設幣別不同。";
    return hint;
  }

  async function handleTeamSubmit() {
    clearResult();
    setLoading(true);

    try {
      const session = await getSession();
      const payload = buildTeamPayload(state.teamForm);
      const data = await postCheckout(session.accessToken, payload);
      const link = extractCheckoutLink(data);

      if (!isHttpUrl(link)) {
        throw new Error(`結帳介面沒有回傳可用的連結。\n${JSON.stringify(data, null, 2)}`);
      }

      setResult({ link });
    } catch (error) {
      console.error("Team 結帳連結產生失敗", error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function handlePlusSubmit() {
    clearResult();
    setLoading(true);

    try {
      const session = await getSession();
      const payload = buildPlusPayload();
      const data = await postCheckout(session.accessToken, payload);
      const link = extractCheckoutLink(data);

      if (!isHttpUrl(link)) {
        throw new Error(`結帳介面沒有回傳可用的連結。\n${JSON.stringify(data, null, 2)}`);
      }

      setResult({ link });
    } catch (error) {
      console.error("Plus 結帳連結產生失敗", error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function handleCodexSubmit() {
    clearResult();

    const checkoutSessionId = extractCheckoutSessionId(state.codexForm.checkoutLink);
    if (!checkoutSessionId) {
      setResult({ error: "請貼上含 checkout_session_id 的 Codex Team 結帳長連結。" });
      return;
    }

    setLoading(true);

    try {
      const session = await getSession();
      const payload = buildCodexUpdatePayload(checkoutSessionId, state.codexForm.quantity);
      const data = await postCodexUpdate(session.accessToken, payload);
      const link = buildCodexCheckoutLink(data, checkoutSessionId);

      if (!isHttpUrl(link)) {
        throw new Error(`結帳介面沒有回傳可用的連結。\n${JSON.stringify(data, null, 2)}`);
      }

      setResult({ link });
    } catch (error) {
      console.error("Codex 結帳連結產生失敗", error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function handleCodexDirectSubmit() {
    clearResult();
    setLoading(true);

    try {
      const session = await getSession();
      const payload = buildCodexDirectPayload(state.codexForm);
      const data = await postCheckout(session.accessToken, payload);
      const link = extractCheckoutLink(data);

      if (!isHttpUrl(link)) {
        throw new Error(`結帳介面沒有回傳可用的連結。\n${JSON.stringify(data, null, 2)}`);
      }

      setResult({ link });
    } catch (error) {
      console.error("Codex 直接結帳連結產生失敗", error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  // 讀取 workspace 下拉選單資料；選單只列 Team/Business workspace。
  async function loadSeatWorkspaces() {
    state.seatForm.loadState = "loading";
    state.seatForm.loadError = "";
    renderBody();

    try {
      const { session, context } = await fetchSeatInitialSession();
      const accounts = await fetchWorkspaceAccounts(context.accessToken);
      const rows = selectableWorkspaces(workspaceRows(accounts));
      if (!rows.length) {
        throw new Error("目前帳號沒有可用的 Team / Business Workspace");
      }

      state.seatForm.workspaces = rows;
      state.seatForm.selectedId = rows.some((row) => row.id === context.accountId)
        ? context.accountId
        : rows[0].id;
      state.seatForm.loadState = "ready";
    } catch (error) {
      state.seatForm.workspaces = [];
      state.seatForm.selectedId = "";
      state.seatForm.loadState = "error";
      state.seatForm.loadError = error instanceof Error ? error.message : String(error);
    } finally {
      renderBody();
    }
  }

  // 席位費用查詢：切換 workspace 上下文後讀取「新增 1 席」的預覽金額。
  async function handleSeatSubmit() {
    clearResult();

    const workspaceId = state.seatForm.selectedId;
    if (!workspaceId) {
      setResult({ error: "請先載入並選擇要檢測的 Workspace。" });
      return;
    }

    setLoading(true);

    try {
      const { session } = await fetchSeatInitialSession();
      const context = await workspaceSession(workspaceId, session);
      const result = await singleSeatPreview(context.accessToken, workspaceId);
      const amount = previewAmount(result.preview);
      const renewal = billingTime(result.preview?.renewal_date);
      const workspace = state.seatForm.workspaces.find((row) => row.id === workspaceId);

      setResult({
        title: "單一席位費用",
        rows: [
          { label: "新增 1 席費用", value: amount.formatted, primary: true },
          { label: "帳單時間", value: `${renewal.formatted}（台北時間）` },
          ...(renewal.raw ? [{ label: "原始帳單時間", value: renewal.raw }] : []),
          { label: "席位變化", value: `${result.currentSeats} → ${result.updatedSeats}` },
          { label: "Workspace", value: `${workspace ? workspace.name : workspaceId} (${workspaceId})` },
        ],
      });
    } catch (error) {
      console.error("席位費用查詢失敗", error);
      setResult({
        title: "席位費用檢測失敗",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  function renderTeamTabContent(container) {
    const card = createElement("div", "subscription-toolbox-card");
    const grid = createElement("div", "subscription-toolbox-grid");

    const teamField = createElement("div", "subscription-toolbox-field");
    const teamLabel = createElement("label", "", "團隊名稱");
    const teamInput = document.createElement("input");
    teamInput.type = "text";
    teamInput.value = state.teamForm.teamName;
    teamInput.addEventListener("input", (event) => {
      state.teamForm.teamName = event.target.value;
    });
    teamField.appendChild(teamLabel);
    teamField.appendChild(teamInput);

    const row = createElement("div", "subscription-toolbox-grid two-cols");

    const countryField = createElement("div", "subscription-toolbox-field");
    const countryLabel = createElement("label", "", "國家 / 地區");
    const countrySelect = document.createElement("select");
    for (const country of COUNTRIES) {
      const option = document.createElement("option");
      option.value = country.code;
      option.textContent = getCountryOptionLabel(country.code);
      option.selected = country.code === state.teamForm.country;
      countrySelect.appendChild(option);
    }
    countrySelect.addEventListener("change", (event) => {
      const country = event.target.value;
      state.teamForm.country = country;
      state.teamForm.currency = getCountryDefaultCurrency(country);
      renderBody();
    });
    countryField.appendChild(countryLabel);
    countryField.appendChild(countrySelect);

    const currencyField = createElement("div", "subscription-toolbox-field");
    const currencyLabel = createElement("label", "", "幣別");
    const currencySelect = document.createElement("select");
    for (const currency of SUPPORTED_CURRENCIES) {
      const option = document.createElement("option");
      option.value = currency.code;
      option.textContent = currency.name;
      option.selected = currency.code === state.teamForm.currency;
      currencySelect.appendChild(option);
    }
    currencySelect.addEventListener("change", (event) => {
      updateTeamField("currency", event.target.value);
    });
    currencyField.appendChild(currencyLabel);
    currencyField.appendChild(currencySelect);

    row.appendChild(countryField);
    row.appendChild(currencyField);

    const promoField = createElement("div", "subscription-toolbox-field");
    const promoLabel = createElement("label", "", "優惠碼（選填）");
    const promoInput = document.createElement("input");
    promoInput.type = "text";
    promoInput.value = state.teamForm.promoCode;
    promoInput.placeholder = "留空則不帶入";
    promoInput.addEventListener("input", (event) => {
      state.teamForm.promoCode = event.target.value;
    });
    promoField.appendChild(promoLabel);
    promoField.appendChild(promoInput);

    const actions = createElement("div", "subscription-toolbox-actions");
    const button = createElement(
      "button",
      "subscription-toolbox-primary",
      state.loading ? "產生 Team 連結中..." : "產生 Team 結帳連結",
    );
    button.type = "button";
    button.disabled = state.loading;
    button.addEventListener("click", handleTeamSubmit);
    actions.appendChild(button);

    grid.appendChild(teamField);
    grid.appendChild(row);
    grid.appendChild(renderCurrencyHint());
    grid.appendChild(promoField);
    grid.appendChild(actions);
    card.appendChild(grid);
    container.appendChild(card);
  }

  function renderPlusTabContent(container) {
    const card = createElement("div", "subscription-toolbox-card");
    const summary = createElement("div", "subscription-toolbox-plus-summary");
    summary.appendChild(createElement("span", "subscription-toolbox-plus-badge", "固定 Plus 流程"));
    for (const line of getPlusSummaryLines()) {
      summary.appendChild(createElement("p", "subscription-toolbox-result-text", line));
    }

    const actions = createElement("div", "subscription-toolbox-actions");
    const button = createElement(
      "button",
      "subscription-toolbox-primary",
      state.loading ? "產生 Plus 連結中..." : "產生 Plus 結帳連結",
    );
    button.type = "button";
    button.disabled = state.loading;
    button.addEventListener("click", handlePlusSubmit);
    actions.appendChild(button);
    summary.appendChild(actions);

    card.appendChild(summary);
    container.appendChild(card);
  }

  function renderCodexTabContent(container) {
    // 一鍵直連結帳區塊
    const directCard = createElement("div", "subscription-toolbox-card");
    const directGrid = createElement("div", "subscription-toolbox-grid");

    const directTitle = createElement("div", "subscription-toolbox-field");
    directTitle.innerHTML = '<label style="font-weight:700;color:#0f766e;">一鍵取得 Codex 付款連結</label>';
    directGrid.appendChild(directTitle);

    const workspaceRow = createElement("div", "subscription-toolbox-grid two-cols");

    const workspaceField = createElement("div", "subscription-toolbox-field");
    const workspaceLabel = createElement("label", "", "Workspace 名稱");
    const workspaceInput = document.createElement("input");
    workspaceInput.type = "text";
    workspaceInput.value = state.codexForm.workspaceName;
    workspaceInput.placeholder = "work";
    workspaceInput.addEventListener("input", (event) => {
      state.codexForm.workspaceName = event.target.value;
    });
    workspaceField.appendChild(workspaceLabel);
    workspaceField.appendChild(workspaceInput);

    const quantityField = createElement("div", "subscription-toolbox-field");
    const quantityLabel = createElement("label", "", "點數方案數量");
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = String(state.codexForm.quantity);
    quantityInput.addEventListener("input", (event) => {
      state.codexForm.quantity = event.target.value;
    });
    quantityField.appendChild(quantityLabel);
    quantityField.appendChild(quantityInput);

    workspaceRow.appendChild(workspaceField);
    workspaceRow.appendChild(quantityField);
    directGrid.appendChild(workspaceRow);

    const directActions = createElement("div", "subscription-toolbox-actions");
    const directButton = createElement(
      "button",
      "subscription-toolbox-primary",
      state.loading ? "產生 Codex 連結中..." : "一鍵取得 Codex 付款連結",
    );
    directButton.type = "button";
    directButton.disabled = state.loading;
    directButton.addEventListener("click", handleCodexDirectSubmit);
    directActions.appendChild(directButton);
    directGrid.appendChild(directActions);

    directCard.appendChild(directGrid);
    container.appendChild(directCard);
  }

  function renderSeatTabContent(container) {
    const card = createElement("div", "subscription-toolbox-card");
    const grid = createElement("div", "subscription-toolbox-grid");

    const intro = createElement("div", "subscription-toolbox-field");
    intro.appendChild(
      createElement(
        "label",
        "",
        "查詢 Team / Business Workspace 新增 1 席的費用（唯讀，不會變更訂閱）",
      ),
    );
    grid.appendChild(intro);

    if (state.seatForm.loadState === "idle") {
      const actions = createElement("div", "subscription-toolbox-actions");
      const loadButton = createElement("button", "subscription-toolbox-primary", "載入 Workspace 列表");
      loadButton.type = "button";
      loadButton.addEventListener("click", loadSeatWorkspaces);
      actions.appendChild(loadButton);
      grid.appendChild(actions);
    } else if (state.seatForm.loadState === "loading") {
      grid.appendChild(
        createElement("p", "subscription-toolbox-result-text", "載入 Workspace 列表中..."),
      );
    } else if (state.seatForm.loadState === "error") {
      const hint = createElement("div", "subscription-toolbox-hint is-mismatch");
      hint.textContent = state.seatForm.loadError;
      grid.appendChild(hint);

      const actions = createElement("div", "subscription-toolbox-actions");
      const retryButton = createElement("button", "subscription-toolbox-primary", "重新載入");
      retryButton.type = "button";
      retryButton.addEventListener("click", loadSeatWorkspaces);
      actions.appendChild(retryButton);
      grid.appendChild(actions);
    } else {
      const field = createElement("div", "subscription-toolbox-field");
      field.appendChild(createElement("label", "", "Workspace"));
      const select = document.createElement("select");
      for (const workspace of state.seatForm.workspaces) {
        const option = document.createElement("option");
        option.value = workspace.id;
        option.textContent = `${workspace.name} (${workspace.id})`;
        option.selected = workspace.id === state.seatForm.selectedId;
        select.appendChild(option);
      }
      select.addEventListener("change", (event) => {
        state.seatForm.selectedId = event.target.value;
      });
      field.appendChild(select);
      grid.appendChild(field);

      const actions = createElement("div", "subscription-toolbox-actions");
      const button = createElement(
        "button",
        "subscription-toolbox-primary",
        state.loading ? "查詢席位費用中..." : "查詢席位費用",
      );
      button.type = "button";
      button.disabled = state.loading;
      button.addEventListener("click", handleSeatSubmit);
      actions.appendChild(button);
      grid.appendChild(actions);
    }

    card.appendChild(grid);
    container.appendChild(card);
  }

  function renderBody() {
    const body = document.getElementById(DOM_IDS.panelBody);
    if (!body) return;

    body.innerHTML = "";

    const tabs = createElement("div", "subscription-toolbox-tabs");
    const teamTab = createElement(
      "button",
      `subscription-toolbox-tab${state.activeTab === "team" ? " is-active" : ""}`,
      "Team",
    );
    teamTab.id = DOM_IDS.tabTeam;
    teamTab.type = "button";
    teamTab.addEventListener("click", () => {
      state.activeTab = "team";
      renderBody();
    });

    const plusTab = createElement(
      "button",
      `subscription-toolbox-tab${state.activeTab === "plus" ? " is-active" : ""}`,
      "Plus",
    );
    plusTab.id = DOM_IDS.tabPlus;
    plusTab.type = "button";
    plusTab.addEventListener("click", () => {
      state.activeTab = "plus";
      renderBody();
    });

    const codexTab = createElement(
      "button",
      `subscription-toolbox-tab${state.activeTab === "codex" ? " is-active" : ""}`,
      "Codex",
    );
    codexTab.id = DOM_IDS.tabCodex;
    codexTab.type = "button";
    codexTab.addEventListener("click", () => {
      state.activeTab = "codex";
      renderBody();
    });

    const seatTab = createElement(
      "button",
      `subscription-toolbox-tab${state.activeTab === "seat" ? " is-active" : ""}`,
      "席位",
    );
    seatTab.id = DOM_IDS.tabSeat;
    seatTab.type = "button";
    seatTab.addEventListener("click", () => {
      state.activeTab = "seat";
      renderBody();
    });

    tabs.appendChild(teamTab);
    tabs.appendChild(plusTab);
    tabs.appendChild(codexTab);
    tabs.appendChild(seatTab);
    body.appendChild(tabs);

    const content = createElement("div", "subscription-toolbox-content");
    if (state.activeTab === "team") {
      renderTeamTabContent(content);
    } else if (state.activeTab === "plus") {
      renderPlusTabContent(content);
    } else if (state.activeTab === "codex") {
      renderCodexTabContent(content);
    } else {
      renderSeatTabContent(content);
    }
    body.appendChild(content);

    const result = createElement("div", "subscription-toolbox-result");
    result.id = DOM_IDS.result;
    body.appendChild(result);
    renderResult();
  }

  function createPanel() {
    if (document.getElementById(DOM_IDS.panel)) return;

    const panel = createElement("div");
    panel.id = DOM_IDS.panel;

    const header = createElement("div", "subscription-toolbox-header");
    const headerRow = createElement("div", "subscription-toolbox-header-row");
    const titleGroup = createElement("div");
    titleGroup.appendChild(createElement("h3", "subscription-toolbox-title", "ChatGPT 訂閱工具箱"));
    titleGroup.appendChild(
      createElement(
        "p",
        "subscription-toolbox-subtitle",
        "用同一個面板管理 Team、Plus 與 Codex 的結帳連結。",
      ),
    );

    const close = createElement("button", "subscription-toolbox-close", "×");
    close.type = "button";
    close.addEventListener("click", () => setPanelOpen(false));

    headerRow.appendChild(titleGroup);
    headerRow.appendChild(close);
    header.appendChild(headerRow);
    panel.appendChild(header);

    const body = createElement("div", "subscription-toolbox-body");
    body.id = DOM_IDS.panelBody;
    panel.appendChild(body);

    document.body.appendChild(panel);
    renderBody();

    document.addEventListener("click", (event) => {
      const fab = document.getElementById(DOM_IDS.fab);
      const currentPanel = document.getElementById(DOM_IDS.panel);
      if (!currentPanel || !fab) return;

      const isOpen = currentPanel.classList.contains("is-open");
      if (!isOpen) return;

      if (
        shouldClosePanelOnDocumentClick({
          isOpen,
          event,
          panel: currentPanel,
          fab,
        })
      ) {
        setPanelOpen(false);
      }
    });
  }

  function createFab() {
    if (document.getElementById(DOM_IDS.fab)) return;

    const fab = createElement("button", "", "S");
    fab.id = DOM_IDS.fab;
    fab.type = "button";
    fab.title = "開啟訂閱工具箱";

    fab.addEventListener("pointerdown", (event) => {
      fabDragState.active = true;
      fabDragState.moved = false;
      fabDragState.pointerId = event.pointerId;
      fabDragState.startX = event.clientX;
      fabDragState.startY = event.clientY;

      const rect = fab.getBoundingClientRect();
      fabDragState.offsetX = event.clientX - rect.left;
      fabDragState.offsetY = event.clientY - rect.top;

      if (typeof fab.setPointerCapture === "function") {
        fab.setPointerCapture(event.pointerId);
      }
    });

    fab.addEventListener("pointermove", (event) => {
      if (!fabDragState.active || fabDragState.pointerId !== event.pointerId) return;

      if (!fabDragState.moved) {
        fabDragState.moved = hasFabDragExceededThreshold(
          fabDragState.startX,
          fabDragState.startY,
          event.clientX,
          event.clientY,
        );
      }

      if (!fabDragState.moved) return;

      const position = clampFabPosition({
        left: event.clientX - fabDragState.offsetX,
        top: event.clientY - fabDragState.offsetY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        fabSize: FAB_SIZE,
        margin: FAB_MARGIN,
      });

      fabDragState.left = position.left;
      fabDragState.top = position.top;
      applyFabPosition();
    });

    fab.addEventListener("pointerup", (event) => {
      if (fabDragState.pointerId !== event.pointerId) return;

      const wasDrag = fabDragState.moved;

      if (typeof fab.releasePointerCapture === "function" && fab.hasPointerCapture?.(event.pointerId)) {
        fab.releasePointerCapture(event.pointerId);
      }

      fabDragState.active = false;
      fabDragState.pointerId = null;
      fabDragState.moved = false;

      if (wasDrag) return;

      event.stopPropagation();
      const panel = document.getElementById(DOM_IDS.panel);
      const isOpen = panel && panel.classList.contains("is-open");
      setPanelOpen(!isOpen);
    });

    fab.addEventListener("pointercancel", (event) => {
      if (fabDragState.pointerId !== event.pointerId) return;

      fabDragState.active = false;
      fabDragState.pointerId = null;
      fabDragState.moved = false;
    });

    window.addEventListener("resize", () => {
      if (typeof fabDragState.left !== "number" || typeof fabDragState.top !== "number") return;

      const position = clampFabPosition({
        left: fabDragState.left,
        top: fabDragState.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        fabSize: FAB_SIZE,
        margin: FAB_MARGIN,
      });

      fabDragState.left = position.left;
      fabDragState.top = position.top;
      applyFabPosition();
    });

    document.body.appendChild(fab);
    applyFabPosition();
  }

  function init() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", init, { once: true });
      return;
    }

    installStyles();
    createFab();
    createPanel();
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    init();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      authContext,
      billingTime,
      buildCodexDirectPayload,
      buildCodexUpdatePayload,
      buildCodexCheckoutLink,
      buildPlusPayload,
      buildTeamPayload,
      clampFabPosition,
      currencyMinorUnit,
      decodeJwtClaims,
      extractCheckoutLink,
      extractCheckoutSessionId,
      getCountryDefaultCurrency,
      getCountryOptionLabel,
      getDisplayLinkText,
      getPanelLayoutMode,
      getPlusSummaryLines,
      getSuccessMessage,
      hasFabDragExceededThreshold,
      nextSeatTarget,
      normalizeCodexQuantity,
      previewAmount,
      selectableWorkspaces,
      shouldClosePanelOnDocumentClick,
      singleSeatPreviewResult,
      workspaceRows,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
