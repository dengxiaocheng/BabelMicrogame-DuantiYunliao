# 断梯运料

> 玩家在破损脚手架上搬运建材，负重越大效率越高，但坠落和塌架风险越大。

## 试玩

公开试玩地址：https://dengxiaocheng.github.io/BabelMicrogame-DuantiYunliao/

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 Vite 提示的本地地址（默认 http://localhost:5173 ）。

## 构建产物

```bash
npm run build
npm run preview
```

## 测试

```bash
npm test
```

## 核心循环

选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages（需在仓库 Settings → Pages 中将 Source 设为 GitHub Actions）。
