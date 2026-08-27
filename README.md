# ChatGPT Subscription Toolbox

一個以 Tampermonkey 為基礎的 ChatGPT 訂閱工具集合，用來在已登入的 ChatGPT 網頁中產生 **ChatGPT Team**、**ChatGPT Plus** 與 **ChatGPT Codex Team** 的結帳連結，並查詢 Team / Business Workspace 的單一席位費用。

## 功能簡介

`index.js` 是目前的主要入口，提供：

- 單一懸浮按鈕開啟工具面板
- `Team` / `Plus` / `Codex` / `席位` 四分頁切換
- Team 方案可選國家、幣別、團隊名稱與優惠碼
- Plus 方案保留固定流程
- Codex 方案一鍵直接取得付款連結（可設定 Workspace 名稱與點數方案數量）
- 席位分頁可載入帳號下的 Team / Business Workspace 列表，查詢「新增 1 席」的費用預覽（唯讀查詢，不會變更訂閱）
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
   - `Codex`：設定 Workspace 名稱與點數方案數量後一鍵取得付款連結
   - `席位`：載入 Workspace 列表後選擇要檢測的 Workspace，查詢新增 1 席的費用
4. 點擊產生結帳連結或查詢席位費用
5. 在結果區中查看結果，結帳連結可手動開啟或複製

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
- 席位查詢僅呼叫訂閱預覽端點（唯讀），不會送出席位變更或修改訂閱；查詢時會暫時切換 workspace 上下文 cookies，完成後立即還原
