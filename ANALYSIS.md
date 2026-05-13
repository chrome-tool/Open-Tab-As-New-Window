# Open-Tab-As-New-Window — 项目分析与改进报告

> 分析日期：2026-05-13  
> 分析视角：Senior Architect  
> 版本：v1.0.4

---

## 一、能否发布到 Microsoft Edge？

**结论：可以直接发布，几乎零改动。**

| 检查项 | 状态 | 说明 |
|---|---|---|
| Manifest Version | ✅ MV3 | Edge 和 Chrome 均要求 MV3 |
| Service Worker | ✅ | MV3 标准写法 |
| 权限声明 | ✅ 最小权限 | 只用了 `contextMenus`，无敏感权限 |
| Chrome API 兼容性 | ✅ | Edge 完全兼容 `chrome.*` namespace |
| 国际化 | ✅ | 已有 50+ 语言 `_locales` |
| 图标 | ✅ | 128 / 48 / 16 三档齐全 |

### 发布步骤

1. 将项目根目录打包为 `.zip`（确保 `manifest.json` 在根目录）
2. 登录 [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)
3. 创建新扩展提交，上传 `.zip`
4. 填写商店信息（描述、截图、隐私政策）
5. 提交审核，通常 1–3 个工作日通过

---

## 二、已发现问题

### 🔴 Warning — toolbar icon 行为与快捷键/右键菜单不一致

**文件：** `js/background.js`（第 9–12 行）

**问题描述：**  
点击 toolbar icon 时直接调用 `tab2Win()`，**不判断当前窗口是否已经是 popup**，导致 popup 窗口再次点击会再弹一层新 popup。而通过快捷键或右键菜单触发的 `execute()` 方法有类型判断，支持双向切换。三种触发方式行为不一致。

**当前代码：**
```js
chrome.action.onClicked.addListener((tab) => {
  chrome.windows.get(tab.windowId, (window) => {
    this.tab2Win(tab, window);  // 永远 tab→popup，不检查当前类型
  });
});
```

**修复方案：**
```js
chrome.action.onClicked.addListener((tab) => {
  this.execute(tab);  // 统一走 execute，支持双向切换
});
```

---

### 🟡 Warning — Service Worker 重启后 Map 数据丢失

**文件：** `js/background.js`（第 2 行）

**问题描述：**  
`this.map` 是内存中的 `Map` 实例，记录 `tabId → 原始 windowId` 的映射关系。Chrome/Edge 的 Service Worker 在空闲时会被浏览器休眠，重启后 `this.map` 清空，导致 popup → 原窗口的还原功能失效，只能回退到 `getLastFocused` 兜底逻辑。

**修复方案：** 使用 `chrome.storage.session` 持久化映射关系（session 存储在 Service Worker 重启后依然保留）：

```js
// 写入
chrome.storage.session.set({ [`tab_${tabId}`]: windowId });

// 读取
chrome.storage.session.get(`tab_${tabId}`, (result) => {
  const windowId = result[`tab_${tabId}`];
});

// 删除
chrome.storage.session.remove(`tab_${tabId}`);
```

同时需要在 `manifest.json` 的 `permissions` 中添加 `"storage"`。

---

### 🟡 Warning — description 中包含竞争对手品牌名

**文件：** `_locales/en/messages.json`

**问题描述：**  
描述文案为 `"Tab To Popup Window is a Chrome extension..."`，Edge 商店审核规范要求不得在扩展描述中提及竞争对手（Google Chrome）品牌名，可能导致审核被拒。

**修复方案：**
```json
"extDescription": {
  "message": "Tab To Popup Window is a browser extension that allows users to quickly convert the current tab into a standalone popup window."
}
```

---

### 🔵 Info — 私有方法命名不可读

**文件：** `js/background.js`

`tnwlf` / `tnwc` / `tnwt` 这三个方法名完全不表达语义，维护成本高。

| 当前名称 | 建议名称 |
|---|---|
| `tnwlf` | `moveToLastFocusedWindow` |
| `tnwc` | `createNormalWindow` |
| `tnwt` | `moveTabToWindow` |

---

## 三、改进项（已实施）

### ✅ 改进 1：修复 toolbar icon 不走 `execute()` 的 bug

**文件：** `js/background.js`

将 `action.onClicked` 回调从直接调用 `tab2Win()` 改为统一调用 `execute()`，使三种触发方式（toolbar icon / 右键菜单 / 快捷键）行为完全一致，均支持双向切换。

---

### ✅ 改进 2：description 去除 "Chrome" 品牌名

**文件：** `_locales/en/messages.json`

将 `"Chrome extension"` 改为 `"browser extension"`，满足 Edge 商店审核要求。

---

## 四、新功能建议（待实施）

| 优先级 | 功能 | 技术思路 |
|---|---|---|
| 🔴 High | **Service Worker 重启后映射持久化** | 用 `chrome.storage.session` 替代内存 Map |
| 🔴 High | **多标签批量转换** | 右键菜单增加 "Move all tabs to new window"，调用 `chrome.tabs.query` 批量 move |
| 🟡 Medium | **Popup 默认尺寸设置** | 添加 `default_popup` 页面，通过 `chrome.storage.sync` 保存用户偏好的弹窗大小 |
| 🟡 Medium | **多显示器支持** | 利用 `chrome.system.display` API，允许用户选择将 popup 弹出到哪个屏幕 |
| 🔵 Low | **快捷键自定义引导** | 在 popup 页面提示用户前往 `chrome://extensions/shortcuts` 自定义快捷键 |

---

## 五、发布前 Checklist

- [x] Manifest V3 规范 ✅
- [x] 最小权限原则 ✅  
- [x] 图标三档齐全（16 / 48 / 128）✅
- [x] 50+ 语言国际化 ✅
- [ ] 修复 toolbar icon 不走 `execute()` 的 bug（**必须修复**）
- [ ] `_locales/en/messages.json` 去除 "Chrome" 品牌名（**Edge 审核要求**）
- [ ] `chrome.storage.session` 替代内存 Map（防止 Service Worker 重启丢数据）
- [ ] 确认图标在 Edge 亮色/暗色主题下均清晰可辨
- [ ] 准备商店截图（至少 1 张，建议 1280×800 或 640×400）
- [ ] 填写隐私政策说明（Edge 商店必填项）
