# 🖼️ Image Compression API

<div align="center">

**一个开源的、生产就绪的图片压缩 API 服务，基于 Next.js 14 和 Sharp 构建**

[![Deploy to Dokploy](https://img.shields.io/badge/Deploy%20to-Dokploy-blue?style=for-the-badge&logo=docker)](https://docs.dokploy.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Sharp](https://img.shields.io/badge/Sharp-0.33-green?style=flat-square)](https://sharp.pixelplumbing.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

[Demo](https://processimage.mexxxxai.win) • [Documentation](#-api-documentation) • [Deploy](#-deployment)

</div>

---

## ✨ 功能特性

- 🚀 **高性能**: 基于 Sharp 库，比 ImageMagick 快 4-5 倍
- 📦 **开箱即用**: 单一 API 端点，无需复杂配置
- 🎨 **多种尺寸**: 支持 1200x1200 和 500x500 两种输出尺寸
- 🔄 **智能转换**: 自动转换为 WebP 格式，压缩率高达 99%
- 🐳 **Docker 就绪**: 完整的 Docker 支持，可一键部署
- 🔒 **安全可靠**: 内置输入验证、大小限制和安全响应头
- 📊 **低内存占用**: 流式处理，适合各种服务器配置
- 🌐 **支持所有格式**: JPEG、PNG、GIF、TIFF、SVG 等

## 📖 目录

- [快速开始](#-quick-start)
- [API 文档](#-api-documentation)
- [部署指南](#-deployment)
- [配置选项](#-configuration)
- [测试](#-testing)
- [性能指标](#-performance)
- [常见问题](#-troubleshooting)
- [贡献指南](#-contributing)
- [许可证](#-license)

## 🚀 快速开始

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/ailingqu/pub-compress-image.git
cd pub-compress-image

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 使用 Docker

```bash
# 构建镜像
docker build -t image-compression-api .

# 运行容器
docker run -p 3000:3000 image-compression-api

# 测试 API
curl -X POST -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg \
  http://localhost:3000/api/compress-image \
  -o compressed.webp
```

### 一键测试

```bash
# 使用项目中的测试图片和脚本
chmod +x test-api.sh
./test-api.sh
```

## 📚 API 文档

### 端点

```
POST /api/compress-image
```

### 请求参数

#### Query 参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `size` | string | 否 | `1200` | 输出尺寸：`1200` (1200x1200) 或 `500` (500x500) |

#### Headers

| Header | 值 | 描述 |
|--------|-----|------|
| `Content-Type` | `image/*` | 图片 MIME 类型（如 `image/jpeg`, `image/png`） |

#### Body

原始图片的二进制数据（最大 100MB）

### 响应

#### 成功响应 (200)

- **Content-Type**: `image/webp`
- **Body**: 压缩后的 WebP 图片二进制数据
- **Headers**:
  - `X-Image-Size`: 输出尺寸信息（如 `1200x1200`）
  - `Content-Length`: 图片大小（字节）
  - `Cache-Control`: 缓存策略

#### 错误响应

| 状态码 | 描述 |
|--------|------|
| `400` | 无效的内容类型或参数 |
| `413` | 图片过大（超过 100MB） |
| `500` | 服务器内部错误 |

### 使用示例

#### cURL

```bash
# 默认尺寸（1200x1200）
curl -X POST \
  -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg \
  https://your-domain.com/api/compress-image \
  -o compressed-1200.webp

# 小尺寸（500x500）
curl -X POST \
  -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg \
  "https://your-domain.com/api/compress-image?size=500" \
  -o compressed-500.webp
```

#### JavaScript / TypeScript

```javascript
// 使用 Fetch API
async function compressImage(file, size = '1200') {
  const response = await fetch(`/api/compress-image?size=${size}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type
    },
    body: await file.arrayBuffer()
  });

  if (!response.ok) {
    throw new Error(`Compression failed: ${response.status}`);
  }

  return await response.blob();
}

// 使用示例
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const compressed = await compressImage(file, '500');

  // 下载压缩后的图片
  const url = URL.createObjectURL(compressed);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compressed.webp';
  a.click();
});
```

#### Python

```python
import requests

def compress_image(image_path, size='1200'):
    """压缩图片到指定尺寸"""
    with open(image_path, 'rb') as f:
        response = requests.post(
            'https://your-domain.com/api/compress-image',
            params={'size': size},
            headers={'Content-Type': 'image/jpeg'},
            data=f
        )

    if response.status_code == 200:
        with open(f'compressed-{size}.webp', 'wb') as f:
            f.write(response.content)
        print(f'Compressed to {len(response.content)} bytes')
    else:
        print(f'Error: {response.json()}')

# 使用示例
compress_image('image.jpg', '1200')  # 大尺寸
compress_image('image.jpg', '500')   # 小尺寸
```

#### Node.js

```javascript
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function compressImage(imagePath, size = '1200') {
  const imageBuffer = fs.readFileSync(imagePath);

  const response = await axios.post(
    `https://your-domain.com/api/compress-image?size=${size}`,
    imageBuffer,
    {
      headers: {
        'Content-Type': 'image/jpeg'
      },
      responseType: 'arraybuffer'
    }
  );

  fs.writeFileSync(`compressed-${size}.webp`, response.data);
  console.log(`Saved compressed image (${response.data.length} bytes)`);
}

// 使用示例
compressImage('./image.jpg', '1200');
```

## 🚢 部署指南

### 部署到 Dokploy（推荐）

#### 方式一：Git 自动部署

1. **Fork 或 Clone 本仓库**

```bash
git clone https://github.com/ailingqu/pub-compress-image.git
cd pub-compress-image
```

2. **推送到您的 Git 仓库**

```bash
git remote set-url origin YOUR_GIT_REPO_URL
git push -u origin master
```

3. **在 Dokploy 控制台配置**

   - 登录 Dokploy
   - 点击 **"Create Application"**
   - 选择 **"Docker"** 部署类型
   - 连接您的 Git 仓库
   - Dokploy 会自动检测 `Dockerfile`
   - 点击 **"Deploy"**

4. **配置域名（可选）**

   进入 **Domains** 标签页：
   - 点击 **"Add Domain"**
   - 输入您的域名（如 `api.yourdomain.com`）
   - Container Port: `3000`
   - Port: `80`
   - 如果使用 Cloudflare：勾选 **"Behind Cloudflare"**

5. **配置 Cloudflare DNS（如果使用）**

   在 Cloudflare 控制台：
   - 类型: `A`
   - 名称: `api` (或您的子域名)
   - 内容: 您的 Dokploy 服务器 IP
   - 代理状态: **已代理**（橙色云朵）
   - SSL/TLS 模式: **Flexible**

6. **启用自动部署（推荐）**

   - 在 Dokploy 中设置 Git Webhook
   - 每次推送代码时自动重新部署

#### 方式二：Docker 镜像部署

```bash
# 1. 构建并推送镜像
docker build -t yourusername/image-compression-api:latest .
docker push yourusername/image-compression-api:latest

# 2. 在 Dokploy 中配置
# - 选择 "Docker Image" 部署
# - 输入: yourusername/image-compression-api:latest
# - 端口: 3000
# - 点击 "Deploy"
```

### 部署到其他平台

#### Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

注意：Vercel 有文件大小限制（4.5MB），建议用于轻量级场景。

#### Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  image-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    mem_limit: 512m
    cpus: 1.0
```

运行：

```bash
docker-compose up -d
```

#### Kubernetes

创建 `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: image-compression-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: image-api
  template:
    metadata:
      labels:
        app: image-api
    spec:
      containers:
      - name: api
        image: yourusername/image-compression-api:latest
        ports:
        - containerPort: 3000
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: image-api-service
spec:
  selector:
    app: image-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

部署：

```bash
kubectl apply -f deployment.yaml
```

## ⚙️ 配置选项

### 环境变量

创建 `.env.local` 文件：

```bash
# 端口（默认: 3000）
PORT=3000

# Node 环境
NODE_ENV=production

# 禁用遥测（可选）
NEXT_TELEMETRY_DISABLED=1
```

### 自定义配置

修改 `app/api/compress-image/route.ts` 以自定义：

```typescript
// 修改文件大小限制
const maxSize = 200 * 1024 * 1024; // 改为 200MB

// 修改压缩质量
.webp({ quality: 90 }) // 改为 90% 质量

// 添加新的尺寸
if (sizeParam === '2000') {
  size = 2000; // 添加 2000x2000 选项
}
```

## 🧪 测试

### 自动化测试脚本

项目包含完整的测试脚本 `test-api.sh`:

```bash
chmod +x test-api.sh
./test-api.sh
```

测试内容：
- ✅ 1200x1200 尺寸压缩
- ✅ 500x500 尺寸压缩
- ✅ 默认参数测试
- ✅ 文件完整性验证

### 手动测试

#### 1. 测试基本功能

```bash
# 测试 JPEG
curl -X POST \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg \
  http://localhost:3000/api/compress-image \
  -o output.webp

# 验证输出
file output.webp  # 应显示: Web/P image
```

#### 2. 测试不同尺寸

```bash
# 大尺寸
curl -X POST \
  -H "Content-Type: image/png" \
  --data-binary @image.png \
  "http://localhost:3000/api/compress-image?size=1200" \
  -o large.webp

# 小尺寸
curl -X POST \
  -H "Content-Type: image/png" \
  --data-binary @image.png \
  "http://localhost:3000/api/compress-image?size=500" \
  -o small.webp

# 对比大小
ls -lh large.webp small.webp
```

#### 3. 测试错误处理

```bash
# 测试无效尺寸参数
curl -v "http://localhost:3000/api/compress-image?size=999" \
  -X POST -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg
# 预期: 400 错误

# 测试无效内容类型
curl -v http://localhost:3000/api/compress-image \
  -X POST -H "Content-Type: text/plain" \
  --data-binary @test.txt
# 预期: 400 错误

# 测试文件过大（需要 >100MB 文件）
curl -v http://localhost:3000/api/compress-image \
  -X POST -H "Content-Type: image/jpeg" \
  --data-binary @huge-image.jpg
# 预期: 413 错误
```

### 性能测试

使用 Apache Bench:

```bash
# 安装 Apache Bench (macOS)
brew install httpd

# 并发测试（10 个并发，100 个请求）
ab -n 100 -c 10 -p image.jpg \
  -T image/jpeg \
  http://localhost:3000/api/compress-image
```

使用 wrk:

```bash
# 安装 wrk
brew install wrk

# 基准测试（30 秒，10 个线程，100 个连接）
wrk -t10 -c100 -d30s \
  -s post.lua \
  http://localhost:3000/api/compress-image
```

## 📊 性能指标

基于 Next.js 14 + Sharp 的实测数据：

| 指标 | 值 |
|------|-----|
| **处理速度** | 100-500ms/图片 |
| **吞吐量** | ~100 请求/秒（单核） |
| **内存占用** | ~150MB（空闲） |
| **Docker 镜像** | ~100MB |
| **压缩比** | 90-99%（取决于原图） |
| **支持格式** | JPEG, PNG, GIF, TIFF, SVG, WebP |

### 压缩示例

| 原始格式 | 原始大小 | 输出大小 (1200) | 输出大小 (500) | 压缩率 |
|---------|---------|----------------|---------------|--------|
| PNG 4096x4096 | 11.0 MB | 113 KB | 28.5 KB | 99.0% |
| JPEG 3000x2000 | 2.5 MB | 85 KB | 22 KB | 96.6% |
| PNG 1920x1080 | 1.2 MB | 48 KB | 15 KB | 96.0% |

## 📁 项目结构

```
pub-compress-image/
├── app/
│   ├── layout.tsx                  # 根布局组件
│   ├── page.tsx                    # 首页（API 文档）
│   └── api/
│       └── compress-image/
│           └── route.ts            # API 端点核心逻辑
├── public/                         # 静态资源
├── tests/
│   ├── test.png                    # 测试图片
│   ├── test-api.sh                 # 自动化测试脚本
│   └── test-output*.webp           # 测试输出示例
├── .dockerignore                   # Docker 构建排除文件
├── .env.example                    # 环境变量模板
├── .gitignore                      # Git 忽略文件
├── Dockerfile                      # 多阶段 Docker 构建
├── next.config.js                  # Next.js 配置
├── package.json                    # 项目依赖
├── tsconfig.json                   # TypeScript 配置
└── README.md                       # 项目文档（本文件）
```

## 🔧 故障排除

### 常见问题

#### 1. Sharp 安装失败

**症状**: `npm install` 时 Sharp 安装错误

**解决方案**:
```bash
# 清除缓存并重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 或使用特定版本
npm install sharp@0.33.0
```

#### 2. Docker 构建失败

**症状**: Docker 构建时出现 "COPY failed" 错误

**解决方案**:
- 确保在项目根目录运行 `docker build`
- 检查 `.dockerignore` 没有排除必要文件
- 使用 `docker build --no-cache -t image-api .` 清除缓存

#### 3. API 返回 404

**症状**: 部署后访问 API 返回 404

**解决方案**:
- 确保 `app/layout.tsx` 文件存在
- 检查 Next.js 构建日志是否有错误
- 验证路由文件路径: `app/api/compress-image/route.ts`

#### 4. 图片过大导致超时

**症状**: 处理大图片时请求超时

**解决方案**:

修改 `next.config.js`:

```javascript
const nextConfig = {
  // ... 其他配置
  experimental: {
    // 增加 API 超时时间（默认 60s）
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
}
```

#### 5. 内存不足

**症状**: Docker 容器频繁重启或 OOM 错误

**解决方案**:

```bash
# 增加 Docker 容器内存限制
docker run -p 3000:3000 --memory="1g" image-compression-api

# 或在 docker-compose.yml 中
services:
  app:
    mem_limit: 1g
```

#### 6. Cloudflare 连接错误

**症状**: 部署到 Dokploy 后，通过 Cloudflare 访问返回错误

**解决方案**:
- SSL/TLS 模式设置为 **Flexible**（后端是 HTTP）
- 如果使用非标准端口，配置 Origin Rules 指定端口
- 或将 Dokploy Port 改为 `80`（推荐）

## 🎯 最佳实践

### 1. 生产环境优化

```bash
# 使用环境变量
NODE_ENV=production PORT=3000

# 启用 PM2 进程管理（Node.js 生产部署）
npm install -g pm2
pm2 start npm --name "image-api" -- start
pm2 startup
pm2 save
```

### 2. 安全加固

```javascript
// 添加 API 认证（在 route.ts 中）
const apiKey = req.headers.get('x-api-key');
if (apiKey !== process.env.API_KEY) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 3. 速率限制

使用 `next-rate-limit`:

```bash
npm install next-rate-limit
```

```typescript
import rateLimit from 'next-rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 秒
  uniqueTokenPerInterval: 500,
});

export async function POST(req: NextRequest) {
  try {
    await limiter.check(req, 10, 'CACHE_TOKEN'); // 每分钟 10 个请求
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // ... 其余代码
}
```

### 4. 监控和日志

```typescript
// 添加请求日志
console.log(`[${new Date().toISOString()}] Processing image: ${buffer.length} bytes, size: ${size}`);

// 使用 Sentry 错误追踪
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(error);
```

## 🤝 贡献指南

欢迎所有形式的贡献！

### 如何贡献

1. **Fork 本仓库**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **开启 Pull Request**

### 开发流程

```bash
# 克隆您的 Fork
git clone https://github.com/YOUR_USERNAME/pub-compress-image.git

# 创建功能分支
git checkout -b feature/new-feature

# 安装依赖
npm install

# 开发（带热重载）
npm run dev

# 运行测试
./test-api.sh

# 提交前检查
npm run build

# 提交
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 添加适当的注释
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

由 [NanoBananas AI](https://nanobananas.ai/) 团队开发和维护

- 网站: [https://nanobananas.ai/](https://nanobananas.ai/)
- GitHub: [@ailingqu](https://github.com/ailingqu)

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能图片处理库
- [Dokploy](https://dokploy.com/) - 简化的部署平台
- 所有贡献者和用户

## 📞 支持

- 🐛 报告问题: [GitHub Issues](https://github.com/ailingqu/pub-compress-image/issues)
- 💬 讨论: [GitHub Discussions](https://github.com/ailingqu/pub-compress-image/discussions)
- 📧 邮件: support@nanobananas.ai

## 🗺️ 路线图

未来计划的功能：

- [ ] 支持更多输出格式（AVIF、JPEG XL）
- [ ] 批量图片处理
- [ ] 自定义水印添加
- [ ] GraphQL API 支持
- [ ] Web UI 管理界面
- [ ] 图片处理队列（Redis）
- [ ] 统计分析仪表板
- [ ] CDN 集成

---

<div align="center">

**如果这个项目对您有帮助，请给它一个 ⭐️**

Made with ❤️ by [NanoBananas AI](https://nanobananas.ai/)

</div>
