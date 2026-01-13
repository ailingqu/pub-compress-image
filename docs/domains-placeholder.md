# Dokploy 域名配置示例

由于无法在此提交实际截图，请参考以下配置说明：

## 域名配置界面

在 Dokploy 的 **Domains** 标签页中，配置应如下所示：

```
┌─────────────────────────────────────────────────┐
│ Domain                                          │
│                                                 │
│ Host                                            │
│ processimage.yourdomain.com                     │
│                                                 │
│ Path                                            │
│ /                                               │
│                                                 │
│ Internal Path                                   │
│ /                                               │
│                                                 │
│ Container Port  ⚠️ 重要                         │
│ 3000                                            │
│                                                 │
│ ☐ Strip Path                                   │
│                                                 │
│ ☑ Behind Cloudflare                            │
│                                                 │
│ [Update]                                        │
└─────────────────────────────────────────────────┘
```

## 关键配置项

| 项目 | 值 | 说明 |
|------|-----|------|
| Host | processimage.yourdomain.com | 您的完整域名 |
| Path | / | 根路径 |
| Internal Path | / | 内部路径，保持默认 |
| **Container Port** | **3000** | ⚠️ 必须是 3000！ |
| Behind Cloudflare | ✓ | 如使用 CF 代理需勾选 |

## 截图说明

要添加实际截图：
1. 在 Dokploy 控制台截取域名配置页面
2. 保存为 `domains.png`
3. 放入 `docs/` 目录
4. README.md 会自动显示图片
