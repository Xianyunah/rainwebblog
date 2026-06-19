# 🌧️ RainWeb - 个人云管理平台

[![GitHub](https://img.shields.io/badge/GitHub-Xianyunah%2Frainwebblog-blue?logo=github)](https://github.com/Xianyunah/rainwebblog)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

一体化个人云平台，集成博客、论坛、密码管理器、管理后台聚合等功能，Material Design 3 风格，支持深色/浅色切换。

## 功能概览

| 功能 | 说明 |
|------|------|
| 📝 **博客** | 瀑布流布局，支持 Markdown 渲染，响应式设计 |
| 💬 **论坛** | 多分类，发帖/回复，用户权限管理 |
| 🔒 **密码管理器** | AES-256-GCM 加密存储，PIN 码解锁，密码生成/复制 |
| 📋 **管理面板聚合** | 在 iframe 中嵌入多个管理后台，统一入口 |
| 🌓 **深浅色主题** | Material Design 3 色彩系统，一键切换 |
| 🖼️ **壁纸背景** | 上传自定义壁纸，多种缩放方式，自动半透叠加提升可读性 |
| 🧊 **磨砂玻璃效果** | 导航栏/卡片磨砂玻璃样式，可调模糊强度和透明度 |
| 📧 **邮箱验证注册** | SMTP 邮件发送，Material 风格邮件模板 |
| 🔐 **验证码系统** | 内置扭曲文字验证码 / Google reCAPTCHA V2，支持登录/注册/发帖场景 |
| 🛠️ **CLI 工具** | 命令行管理：修改密码、端口、验证码规则、一键升级 |
| 🔑 **首次初始化向导** | 首次启动自动引导设置管理员密码和站点信息 |

## 快速开始

### 环境要求

- **Node.js** 16.x 或更高版本（推荐 20.x LTS）
- **npm** 随 Node.js 安装
- **git**（用于自动部署和升级）

### 从 GitHub 安装

```bash
git clone https://github.com/Xianyunah/rainwebblog.git
cd rainwebblog
npm install
npm start
```

### 一键部署脚本

```bash
# Linux/Mac
chmod +x deploy.sh && ./deploy.sh

# Windows
deploy.bat
```

脚本会自动 clone 仓库、安装依赖、创建必要目录并启动。

### 宝塔面板部署

1. 宝塔面板 → 网站 → Node项目 → 添加Node项目
2. 仓库地址: `https://github.com/Xianyunah/rainwebblog.git`
3. 启动文件: `server.js`，端口: `3001`
4. 提交后宝塔自动拉取代码、安装依赖并启动

首次访问会自动跳转 `http://localhost:3001/setup.html` 完成初始化。

### 宝塔面板部署

1. 上传 `rainweb-baota.zip` 到服务器并解压
2. 宝塔面板 → 网站 → Node项目 → 添加Node项目
   - **启动文件**: `server.js`
   - **端口**: `3001`
3. 提交后宝塔自动 `npm install` 并启动
4. 如需域名访问，配置 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker 部署（可选）

```bash
# 使用 Node.js 官方镜像
docker run -d -p 3001:3001 -v $(pwd)/data:/app/data node:20 bash -c "
  cd /app && npm install && node server.js
"
```

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 管理员 |

**首次启动后请及时修改密码。**

## CLI 命令

```bash
node cli.js <command>
# 或
npm run cli -- <command>
```

| 命令 | 说明 |
|------|------|
| `status` | 查看运行状态 |
| `start` | 启动服务器 |
| `stop` | 停止服务器 |
| `restart` | 重启服务器 |
| `port [number]` | 查看/修改端口 |
| `password [new-pass]` | 修改管理员密码 |
| `captcha` | 交互式配置验证码 |
| `config` | 查看所有配置 |
| `upgrade` | 一键升级（git pull + npm install + 重启） |

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **前端**: 原生 HTML/CSS/JS + Material Design 3
- **加密**: AES-256-GCM, PBKDF2, bcrypt
- **验证码**: SVG 扭曲文字 / Google reCAPTCHA V2
- **文件上传**: multer
- **邮件**: nodemailer
- **Markdown**: marked

## 项目结构

```
rainweb/
├── server.js              # 主入口
├── cli.js                 # CLI 工具
├── db.js                  # 数据库层
├── middleware/
│   └── auth.js            # JWT 认证中间件
├── routes/                # API 路由
│   ├── auth.js            # 登录/注册/用户管理
│   ├── blog.js            # 博客 CRUD
│   ├── forum.js           # 论坛/帖子/回复
│   ├── passwords.js       # 密码管理器
│   ├── admin-links.js     # 管理面板链接
│   ├── captcha.js         # 验证码生成/验证
│   ├── settings.js        # 站点设置
│   ├── email.js           # SMTP 邮件
│   ├── upload.js          # 壁纸上传
│   ├── setup.js           # 初始化向导
│   ├── announcements.js   # 公告
│   └── profile.js         # 个人资料
├── public/
│   ├── index.html         # 博客首页
│   ├── login.html         # 登录
│   ├── register.html      # 注册
│   ├── admin.html         # 管理后台
│   ├── forum.html         # 论坛
│   ├── blog.html          # 博客页
│   ├── passwords.html     # 密码管理器
│   ├── embed.html         # 网页嵌入
│   ├── profile.html       # 个人中心
│   ├── setup.html         # 初始化向导
│   ├── css/style.css      # 全局样式 + 主题
│   ├── js/
│   │   ├── api.js         # API 封装
│   │   ├── nav.js         # 导航栏 + 主题
│   │   ├── captcha.js     # 验证码前端
│   │   ├── theme.js       # 深浅色切换
│   │   ├── main.js        # 博客首页
│   │   ├── admin.js       # 管理后台
│   │   ├── forum.js       # 论坛
│   │   ├── blog.js        # 博客
│   │   ├── passwords.js   # 密码管理器
│   │   └── ...            # 其他页面逻辑
│   └── wallpaper/         # 上传的壁纸
└── package.json
```

## 站点设置

管理后台提供以下配置项：

### 基本设置
- 网站名称、描述
- 主题色
- reCAPTCHA V2 (Site Key / Secret Key)

### 验证码设置
- 类型：关闭 / 内置验证码 / Google reCAPTCHA
- 应用范围：登录、注册、发帖、失败次数过多

### 主题设置
- 主题色
- 壁纸上传 / URL / 缩放方式
- 导航栏样式：默认 / 磨砂玻璃 / 胶囊
- 卡片样式：实色 / 磨砂玻璃
- 玻璃效果：模糊强度、透明度

### SMTP 邮件
- 主机、端口、用户名、密码
- 发件人邮箱、名称
- 支持测试发送

## 开发

```bash
# 开发模式启动
node server.js
```

项目不依赖构建工具，直接修改 `public/` 目录下的文件即可。

## 升级

```bash
# 方法1: 一键升级（推荐）
node cli.js upgrade

# 方法2: 手动
git pull
npm install
node cli.js restart
```

## License

MIT
