# JSON URL 下载器 - 快速测试指南

## 🧪 测试单引号支持

### 测试1: 双引号JSON（标准格式）
```json
{
  "gallery": {
    "photos": ["https://picsum.photos/800/600.jpg"]
  }
}
```

### 测试2: 单引号JSON（JavaScript格式）
```javascript
{
  'gallery': {
    'photos': ['https://picsum.photos/800/600.jpg']
  }
}
```

### 测试3: 混合URL（包含特殊字符）
```json
{
  "images": [
    "https://via.placeholder.com/600x400.png",
    "https://picsum.photos/id/237/500/300.jpg"
  ],
  "videos": [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  ]
}
```

## 📋 测试步骤

1. 打开浏览器访问: http://localhost:3000/json-downloader
2. 复制上面任一测试JSON到左侧文本框
3. 点击"🔍 解析 JSON"按钮
4. 验证右侧是否正确显示提取的URL
5. 点击"📥 打包下载"测试下载功能

## ✅ 预期结果

### 解析成功后应该显示：
- 右侧标题显示: "提取的URL (X)"，X为提取的URL数量
- 每个URL条目显示：
  - 🖼️ 图片 或 🎬 视频 标签
  - 文件名
  - 完整路径
  - 可点击的URL链接

### 下载成功后应该得到：
- 一个名为 `downloaded-files-{timestamp}.zip` 的文件
- ZIP内包含：
  - 按域名和路径组织的目录结构
  - 下载的所有图片/视频文件
  - `_download_report.txt` 下载报告
  - `_errors/` 目录（如有失败的文件）

## 🔍 功能验证清单

- [ ] 双引号JSON能正常解析
- [ ] 单引号JSON能正常解析
- [ ] URL能正确提取
- [ ] 图片/视频类型能正确识别
- [ ] 能成功下载并生成ZIP
- [ ] ZIP中的目录结构正确
- [ ] 下载报告包含详细信息

## 💡 提示

- 可以使用 `docs/json-example.json` 中的示例测试
- 可以使用 `docs/json-examples.txt` 中的多个示例
- 建议先用小量URL测试，确认功能正常后再使用大量URL
