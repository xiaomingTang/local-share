# Deprecated

考虑到包体积和冷启动速度，迁移到了 golang，见 [local-share-golang](https://github.com/xiaomingTang/local-share-golang)

# LocalShare

一个基于 Electron + Node.js + TypeScript 的本地文件共享桌面应用。

## 使用说明

### 你需要做的是

1. **安装右键菜单**：打开应用，点击“添加到文件夹右键菜单”（仅需执行一次，添加后系统级右键菜单将长期有效，无需重复操作）
2. **共享文件夹**：在任意文件夹右键，选择"共享此文件夹"

### 然后你就可以

- **移动端访问**：使用手机扫描生成的二维码，在网页上管理文件（浏览、预览、下载、上传）
  - 注意，手机和电脑需要在同一个局域网内
- **局域网文件共享**：可以把链接地址发送给局域网内的他人，方便地共享文件
- **干净又卫生**：随时可以一键移除右键菜单，拒绝右键菜单污染
- **停止服务**：随时可以在应用中点击"停止服务"或关闭应用

## 功能特性

- 🖥️ 桌面应用界面，简洁易用
- 🖱️ Windows 文件夹右键菜单集成
- 📱 手机扫码访问文件夹
- 🌐 本地 Web 服务器
- 📁 文件浏览、预览、下载
- ⬆️ 文件拖拽上传
- 🔒 绿色版本，无需安装

## 技术栈

- **桌面应用**: Electron + TypeScript
- **后端服务**: Express.js + Node.js
- **前端界面**: HTML + CSS + TypeScript
- **关键库**: winreg, qrcode, multer v2

## 开发环境

### 系统要求

- Node.js 18+
- pnpm 9.12.2+ (包管理器)
- Windows 10+ (用于右键菜单功能)

### 快速开始

```bash
# 手动安装
pnpm install
pnpm run build
```

### 开发命令

```bash
# 编译 TypeScript
pnpm run build

# 开发模式运行
pnpm run dev

# 启动应用
pnpm start

# 构建发布版本
pnpm run dist
```

## 项目结构

```
local-share/
├── src/
│   ├── main.ts           # Electron 主进程
│   ├── preload.ts        # 预加载脚本
│   ├── server/
│   │   └── web-server.ts # Web 服务器
│   └── utils/
│       └── registry-manager.ts # 注册表管理
├── renderer/             # 桌面应用界面
│   ├── index.html
│   ├── styles.css
│   └── renderer.ts
├── web/                  # 移动端Web界面
│   ├── index.html
│   ├── styles.css
│   └── web-app.ts
├── assets/               # 静态资源
└── dist/                 # 编译输出
```

## 特性说明

### 绿色版本

- 应用数据存储在程序目录下
- 不会向系统其他位置写入文件
- 卸载时只需删除程序文件夹

### 安全性

- 只能访问指定的共享文件夹
- 路径安全检查，防止目录遍历攻击
- 本地网络访问，非公网暴露

### 兼容性

- 支持多种文件类型预览
- 响应式 Web 界面，移动端友好
- 支持大文件上传（最大 10GB）

## 开发说明

### 添加新的文件类型支持

在 `web/web-app.ts` 中的 `getFileIcon()` 和 `canPreview()` 方法中添加新的文件扩展名。

### 修改上传限制

在 `src/server/web-server.ts` 中的 `multer` 配置中修改文件大小限制。

### 自定义界面

修改 `renderer/` 和 `web/` 目录下的 HTML/CSS 文件来自定义界面外观。

## 构建发布

```bash
pnpm run dist
```

构建完成后，可执行文件位于 `release/` 目录中。

## 许可证

MIT License
