# ChatGPT Subscription Toolbox

一個以 Tampermonkey 為基礎的 ChatGPT 訂閱工具集合，用來在已登入的 ChatGPT 網頁中產生 **ChatGPT Team** 與 **ChatGPT Plus** 的結帳連結。

## 功能簡介

`index.js` 是目前的主要入口，提供：

- 單一懸浮按鈕開啟工具面板
- `Team` / `Plus` 雙分頁切換
- Team 方案可選國家、幣別、團隊名稱與優惠碼
- Plus 方案保留固定流程
- 產生結帳連結後可手動開啟或複製
- 懸浮按鈕可拖曳
- 面板支援長內容捲動

## 安裝方式

1. 安裝瀏覽器擴充套件 [Tampermonkey](https://www.tampermonkey.net/)
2. 新增一個使用者腳本
3. 將 index.js 內容貼入


## 使用方式

1. 確認你已登入 ChatGPT
2. 開啟右下角的圓形懸浮按鈕
3. 依需求切換：
   - `Team`：填入團隊名稱、國家 / 地區、幣別與優惠碼
   - `Plus`：使用目前固定流程
4. 點擊產生結帳連結
5. 在結果區中手動開啟或複製連結

## 測試

目前可用 Node 內建測試工具驗證純邏輯部分：

```powershell
node --test index.helpers.test.js
node --check index.js
```

## 注意事項

- 這個工具依賴 ChatGPT 網頁目前的登入 session 與站內請求格式
- 若 ChatGPT 前端或付款相關接口變動，腳本可能失效
- 使用前必須先登入 ChatGPT
- 某些錯誤頁面可能會回傳 HTML，而不是 JSON，工具目前會直接顯示錯誤內容
