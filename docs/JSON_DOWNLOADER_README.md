# JSON URL 下载器使用指南

## 🎯 快速开始

### 1. 访问页面
- 直接访问: **http://localhost:3000/json-downloader**
- 或在首页点击 **📦 JSON下载** 按钮

### 2. 使用示例JSON测试
项目包含了一个测试示例: `docs/json-example.json`

```bash
# 查看示例内容
cat docs/json-example.json

# 或直接复制下面的JSON到页面测试
```

**测试JSON内容**:
```json
{
  "gallery": {
    "photos": [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4/photo.jpg",
      "https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg"
    ],
    "videos": [
      "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
    ]
  },
  "user": {
    "avatar": "https://i.pravatar.cc/300.png",
    "cover": "https://picsum.photos/1200/400.jpg"
  }
}
```

### 3. 操作步骤
1. 在左侧文本框粘贴JSON字符串
2. 点击 **🔍 解析 JSON** 按钮
3. 在右侧查看提取的URL列表
4. 点击 **📥 打包下载** 开始下载

---

## 📁 已创建的文件

1. **前端页面**: `app/json-downloader/page.tsx`
2. **后端API**: `app/api/download-urls/route.ts`

## ⚠️ 权限问题修复

在启动开发服务器之前，需要先修复 `.next` 目录的权限问题：

```bash
# 方法1: 修改所有者 (推荐)
sudo chown -R admin:staff .next

# 方法2: 删除 .next 目录并重新构建
sudo rm -rf .next
```

## 🚀 启动服务

修复权限后，启动开发服务器：

```bash
npm run dev
```

服务器启动后，访问: **http://localhost:3000/json-downloader**

## 📖 功能说明

### 1. 解析JSON字符串
- 在左侧文本框中粘贴包含URL的JSON字符串
- **支持双引号和单引号格式**（标准JSON或JavaScript对象格式）
- **支持纯文本格式**（JSON解析失败时自动使用正则提取）⭐
- 支持任意嵌套层级的JSON结构
- 自动递归提取所有HTTP(S) URL
- **无需文件扩展名**（智能识别图片/视频类型）⭐

### 2. 支持的文件类型

**图片格式**:
- JPG/JPEG
- PNG
- GIF
- WEBP
- BMP
- SVG

**视频格式**:
- MP4
- AVI
- MOV
- WMV
- FLV
- MKV
- WEBM

### 3. 下载功能
- 批量下载提取的URL
- 保持原URL的完整目录结构
- 生成ZIP压缩包
- 包含下载报告

## 📝 使用示例

### 示例JSON 1: 标准双引号格式

```json
{
  "user": {
    "avatar": "https://example.com/images/users/avatar.jpg",
    "cover": "https://example.com/images/users/cover.png"
  },
  "videos": [
    "https://example.com/media/intro.mp4",
    "https://example.com/media/demo.webm"
  ]
}
```

### 示例JSON 2: 单引号格式（也支持）

```javascript
{
  'user': {
    'avatar': 'https://example.com/images/users/avatar.jpg',
    'cover': 'https://example.com/images/users/cover.png'
  },
  'videos': [
    'https://example.com/media/intro.mp4',
    'https://example.com/media/demo.webm'
  ]
}
```

### 示例JSON 3: 嵌套结构

```json
{
  "posts": [
    {
      "id": 1,
      "images": [
        "https://cdn.example.com/posts/2024/01/photo1.jpg",
        "https://cdn.example.com/posts/2024/01/photo2.png"
      ],
      "thumbnail": "https://cdn.example.com/thumbs/post1.webp"
    },
    {
      "id": 2,
      "video": "https://cdn.example.com/videos/2024/clip.mp4",
      "cover": "https://cdn.example.com/videos/2024/cover.jpg"
    }
  ]
}
```

### 示例JSON 4: 复杂API响应

```json
{
  "status": "success",
  "data": {
    "gallery": {
      "photos": [
        "https://storage.example.com/user-uploads/2024/january/IMG_001.jpg",
        "https://storage.example.com/user-uploads/2024/january/IMG_002.jpg"
      ],
      "videos": [
        "https://storage.example.com/user-uploads/2024/january/VID_001.mp4"
      ]
    }
  }
}
```

## 📁 下载的ZIP结构

下载的ZIP文件会保持URL的目录结构：

```
downloaded-files-{timestamp}.zip
├── example.com/
│   ├── images/
│   │   └── users/
│   │       ├── avatar.jpg
│   │       └── cover.png
│   └── media/
│       ├── intro.mp4
│       └── demo.webm
├── cdn.example.com/
│   ├── posts/
│   │   └── 2024/
│   │       └── 01/
│   │           ├── photo1.jpg
│   │           └── photo2.png
│   └── videos/
│       └── 2024/
│           ├── clip.mp4
│           └── cover.jpg
├── _errors/                    # 下载失败的文件记录
│   └── (failed files).txt
└── _download_report.txt        # 下载报告
```

## ⚙️ 技术特性

### 前端 (page.tsx)
- ✅ 递归JSON解析
- ✅ **支持单引号和双引号**（自动识别并转换）
- ✅ **正则表达式回退**（JSON失败时自动提取URL）⭐
- ✅ **智能类型识别**（无扩展名也能识别图片/视频）⭐
- ✅ URL类型识别 (图片/视频/未知)
- ✅ 实时进度提示
- ✅ 响应式UI设计
- ✅ 错误处理
- ✅ 内联样式（与项目保持一致）

### 后端 (route.ts)
- ✅ 批量下载 (限制100个URL)
- ✅ 并发控制 (5个并发)
- ✅ 超时保护 (60秒/文件)
- ✅ 目录结构保持
- ✅ ZIP压缩打包
- ✅ 下载报告生成
- ✅ 错误日志记录

## 🔧 配置说明

### API限制
在 `app/api/download-urls/route.ts` 中可调整：

```typescript
// 最大URL数量
if (urls.length > 100) { ... }  // 可修改为其他值

// 并发下载数
const concurrentLimit = 5;      // 可修改为其他值

// 单个文件超时时间
setTimeout(() => controller.abort(), 60000);  // 60秒
```

## 🐛 常见问题

### 1. 下载失败
- 检查URL是否可访问
- 某些网站可能需要认证或有防盗链保护
- 查看 `_download_report.txt` 了解具体错误

### 2. 超时
- 视频文件较大时可能超时
- 调整 `maxDuration` 参数 (默认300秒)
- 减少并发数或分批下载

### 3. 内存问题
- 一次下载大量大文件可能导致内存不足
- 建议分批下载
- 减少并发数

## 📄 依赖说明

项目已包含所需依赖 (`package.json`):
- `jszip`: 用于ZIP文件生成
- `next`: Next.js 框架
- `react`: React库

## 🎨 界面预览

页面包含:
- 📝 左侧: JSON输入区域
- 📊 右侧: URL列表展示
- 🎯 底部: 使用说明
- 🎨 现代化渐变背景
- 📱 响应式设计

## 🔐 安全性

- ✅ URL验证
- ✅ 文件类型检查
- ✅ 数量限制保护
- ✅ 超时控制
- ✅ 错误隔离

## 📞 使用建议

1. **小批量测试**: 先用少量URL测试功能
2. **检查URL**: 确保URL可公开访问
3. **网络稳定**: 确保网络连接稳定
4. **磁盘空间**: 确保有足够的磁盘空间
5. **查看报告**: 下载完成后查看报告了解详情

---

**创建日期**: 2026-01-25
**版本**: 1.0.0
