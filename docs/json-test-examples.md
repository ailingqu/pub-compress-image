# 测试示例 - 包含无扩展名URL和非JSON格式

## 示例1: 标准JSON（有扩展名）
```json
{
  "images": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.png"
  ]
}
```

## 示例2: 无扩展名URL（JSON格式）
```json
{
  "user": {
    "avatar": "https://i.pravatar.cc/300",
    "cover": "https://picsum.photos/1200/400"
  },
  "gallery": [
    "https://placekitten.com/800/600",
    "https://loremflickr.com/640/480"
  ]
}
```

## 示例3: 混合URL（有和无扩展名）
```json
{
  "media": {
    "images": [
      "https://via.placeholder.com/150",
      "https://dummyimage.com/600x400/000/fff",
      "https://cdn.example.com/photos/sunset.jpg"
    ],
    "videos": [
      "https://storage.googleapis.com/media/video",
      "https://example.com/clips/demo.mp4"
    ]
  }
}
```

## 示例4: 非JSON格式（纯文本，使用正则提取）
```
这是一些图片URL：
https://picsum.photos/200/300
https://via.placeholder.com/400
https://i.pravatar.cc/150

还有一些视频：
https://sample-videos.com/video/mp4/720/big_buck_bunny.mp4
https://storage.example.com/videos/intro

混合内容：
查看这个图片 https://example.com/images/photo1.jpg 和
这个视频 https://example.com/media/clip1
```

## 示例5: 畸形JSON（自动回退到正则提取）
```
{
  "images": [
    https://example.com/img1.jpg,
    https://example.com/img2.png
  }
}
```

## 示例6: 真实场景 - 社交媒体API响应
```json
{
  "posts": [
    {
      "id": 1,
      "user": {
        "avatar": "https://cdn.example.com/avatars/user123",
        "banner": "https://cdn.example.com/banners/user123"
      },
      "media": [
        "https://cdn.example.com/photos/post1/img1",
        "https://cdn.example.com/photos/post1/img2.jpg",
        "https://cdn.example.com/videos/post1/clip.mp4"
      ]
    }
  ]
}
```

## 示例7: 常见图片服务（无扩展名）
```
https://picsum.photos/800/600
https://placekitten.com/400/300
https://loremflickr.com/640/480
https://via.placeholder.com/150
https://dummyimage.com/600x400
https://i.pravatar.cc/300
https://source.unsplash.com/random/800x600
```

## 测试要点

### 应该能正确识别为图片的URL：
- ✅ `https://picsum.photos/200/300` (路径包含 photos)
- ✅ `https://via.placeholder.com/150` (域名是 placeholder)
- ✅ `https://i.pravatar.cc/300` (域名包含 avatar)
- ✅ `https://example.com/images/photo` (路径包含 image)
- ✅ `https://cdn.com/thumb/user123` (路径包含 thumb)

### 应该能正确识别为视频的URL：
- ✅ `https://example.com/videos/clip` (路径包含 video)
- ✅ `https://storage.com/media/intro` (路径包含 media)
- ✅ `https://youtube.com/watch?v=xxx` (域名是 youtube)

### 应该标记为未知的URL：
- ⚠️ `https://example.com/api/data` (无法判断类型)
- ⚠️ `https://cdn.example.com/files/doc123` (无法判断类型)
