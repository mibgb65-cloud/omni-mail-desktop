# OmniMail Desktop 前端重设计说明

## 1. 设计系统

设计方向：专业、克制、以阅读和处理邮件为中心，参考 ChatGPT 桌面/Web 应用的中性灰、低装饰、清晰信息层级和轻量交互。

### 颜色

- 画布：`--bg-canvas`
- 侧栏：`--bg-rail`
- 面板：`--bg-panel`
- 柔和面板：`--bg-panel-soft`
- 悬停：`--bg-hover`
- 选中：`--bg-active`
- 主文字：`--text-primary`
- 次级文字：`--text-secondary`
- 弱提示：`--text-tertiary`
- 强调色：`--accent`
- 危险色：`--danger`
- 成功色：`--success`

浅色和深色模式都由 `:root[data-theme]` 下的 CSS variables 控制。

### 间距

使用 4px 基准：

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px

### 圆角

- 小控件：`--radius-sm` 6px
- 常规控件：`--radius-md` 8px
- 面板/按钮：`--radius-lg` 12px
- 模态框：`--radius-xl` 16px

### 动效

- 快速交互：150ms
- 普通切换：220ms
- 支持 `prefers-reduced-motion`

## 2. 布局结构

```text
┌────────────────┬────────────────────┬──────────────────────────────┐
│ 左侧 Sidebar   │ 中间 Email List    │ 右侧 Reading / Composer      │
│ 文件夹         │ 搜索               │ 工具栏                       │
│ 域名           │ 邮件列表           │ 写信区                       │
│ 邮箱账号       │ 空/加载状态        │ 邮件正文/附件/操作           │
│ 接入点         │ 右键菜单入口       │ 设置入口                     │
└────────────────┴────────────────────┴──────────────────────────────┘
```

侧栏可折叠；中间列表固定阅读密度；右侧内容区最大宽度控制在 860px，保证长邮件可读。

## 3. 组件规格

- `Sidebar`: 文件夹、域名、账号、接入点、用户菜单、主题切换。
- `EmailListPanel`: 搜索、刷新、邮件列表、加载骨架、空状态。
- `EmailListItem`: 发件人、主题、预览、时间、未读提示、选中态、右键菜单。
- `ReadingView`: 邮件元信息、正文、附件卡片、归档/删除操作。
- `Composer`: 发件身份、收件人、主题、正文、发送按钮。
- `ProfileModal`: 添加/编辑接入点。
- `AuthModal`: 管理员登录/首次初始化/粘贴 device token。
- `SettingsModal`: 主题、接入点状态、Token 存储状态。
- `ContextMenu`: 邮件归档/删除。
- `Toast`: 成功/错误反馈。
- `EmptyState` / `LoadingList`: 空状态和加载状态。

## 4. TailwindCSS 建议

当前实现使用 CSS variables。若后续迁移到 Tailwind，建议：

```js
theme: {
  extend: {
    colors: {
      canvas: 'var(--bg-canvas)',
      rail: 'var(--bg-rail)',
      panel: 'var(--bg-panel)',
      hover: 'var(--bg-hover)',
      active: 'var(--bg-active)',
      text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)'
      },
      accent: 'var(--accent)',
      danger: 'var(--danger)'
    },
    borderRadius: {
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)'
    },
    boxShadow: {
      popover: 'var(--shadow-popover)'
    }
  }
}
```

推荐优先保留 CSS variables 作为主题源，再用 Tailwind utilities 消费变量。

## 5. 实施计划

1. 已完成：三栏布局、浅/深色模式、设计 token、中文化。
2. 已完成：侧栏折叠、搜索、Toast、模态框、上下文菜单、加载/空状态。
3. 已完成：快捷键 `Ctrl/⌘+K` 搜索、`J/K` 切换邮件、`R` 刷新、`N` 写邮件。
4. 下一步：增加真正可拖拽的面板宽度调节。
5. 下一步：增加多选邮件和批量归档/删除。
6. 下一步：做设置页的持久化选项，如默认主题、默认接入点、快捷键说明。

## 6. 高保真界面稿

```text
左侧：柔和灰色侧栏，顶部品牌和折叠按钮
      黑色主按钮“写邮件”
      文件夹以轻量选中块呈现
      域名、邮箱账号、接入点分组排列
      底部用户菜单与主题切换

中间：白色邮件列表面板
      顶部显示当前文件夹名称
      搜索框带快捷键提示
      邮件项类似 ChatGPT conversation list
      选中邮件为低对比背景

右侧：大面积留白阅读区
      顶部工具栏
      写信面板可展开
      正文内容居中限制最大宽度
      附件以现代卡片呈现
```

## 7. 生产代码位置

- 入口组件：`frontend/src/App.jsx`
- 设计系统和组件样式：`frontend/src/App.css`
- 全局样式：`frontend/src/style.css`
