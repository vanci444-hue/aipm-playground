# AI PM Playground

给产品经理的 AI 概念游乐场——飞书卡片讲不清楚的，亲手玩一遍就懂了。

## 在线访问

部署后访问：`https://<your-username>.github.io/aipm-playground/`

## 当前 Demo

| 路径 | 主题 | 干啥 |
|---|---|---|
| `/` | 首页 | Demo 导航 |
| `/cosine/` | 余弦相似度 | 拖箭头改夹角，实时看相似度怎么变 |
| `/sampling/` | Top-K / Top-P 采样 | 调滑块看候选词被砍/保留，模拟 100 次采样 |

## 本地开发

```bash
pnpm install
pnpm dev      # 开发服务器（默认 5173）
pnpm build    # 构建到 dist/
pnpm preview  # 本地预览构建产物（4173）
```

## 部署到 GitHub Pages

1. 在 GitHub 创建空 repo `aipm-playground`
2. 本地 push：
   ```bash
   git remote add origin git@github.com:<your-username>/aipm-playground.git
   git branch -M main
   git push -u origin main
   ```
3. 仓库 Settings → Pages → Source 选 **GitHub Actions**
4. 等 Action 跑完（首次需安装依赖约 1-2 分钟），访问 `https://<your-username>.github.io/aipm-playground/`

## 技术栈

- Vite 6 + Vue 3（Composition API）
- 多页面构建（每个 demo 是独立 HTML，URL 干净）
- 无外部 UI 库 / 无图表库，纯 SVG + CSS
- 自动适配暗色 / 亮色模式（跟随系统）
- 移动端响应式

## 加新 Demo 的步骤

1. 在 `<demo-name>/index.html` 建入口 HTML
2. 在 `src/<demo-name>.js` 建入口 JS（挂载根组件）
3. 在 `src/<DemoName>.vue` 写组件
4. 在 `vite.config.js` 的 `rollupOptions.input` 注册新入口
5. 在 `src/Home.vue` 的 `demos` 数组里加一项

---

© Evan · 2026
