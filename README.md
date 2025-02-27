# 我的日记

一个使用 Electron + Vue 3 开发的现代化桌面日记应用。

## 功能特性

- 📝 支持富文本和 Markdown 双模式编辑
- 🎨 优雅的深色/浅色主题
- 💾 自动保存和手动备份功能
- 🔄 数据导入导出（ZIP格式）
- 🗑️ 回收站功能
- 📸 图片上传和预览
- ⚡ 快速搜索和过滤

## 技术栈

- **框架：** Electron + Vue 3 + Element Plus
- **构建工具：** Electron Forge + Vite
- **编辑器：** 
  - 富文本编辑器：TinyMCE
  - Markdown编辑器：CodeMirror
- **数据存储：** 本地 JSON 文件存储
- **样式：** SCSS + CSS Variables

## 开发环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

## 安装和运行

1. 克隆项目
```bash
git clone [项目地址]
cd my-electron-app
```

2. 安装依赖
```bash
npm install
```

3. 开发模式运行
```bash
npm run start
```

4. 打包应用
```bash
npm run make
```

## 项目结构

```
my-electron-app/
├── src/                # 源代码目录
│   ├── components/     # 公共组件
│   ├── views/         # 页面组件
│   ├── router.js      # 路由配置
│   └── main.js        # 主入口文件
├── index.js           # Electron 主进程
├── index.html         # 主窗口模板
└── package.json       # 项目配置
```

## 主要功能说明

### 编辑器

- 支持富文本和 Markdown 两种编辑模式
- 可在设置中切换编辑器类型
- 支持图片上传和预览
- 自动保存功能，可自定义保存间隔

### 数据管理

- 数据以 JSON 格式存储在本地
- 支持数据导入导出
- 自动备份功能
- 回收站功能，防止误删

### 主题

- 支持浅色/深色主题
- 可跟随系统主题自动切换
- 自定义字体大小

## 开源协议

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 