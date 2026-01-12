export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Image Compression API</h1>
      <p>POST your image to <code>/api/compress-image</code> to compress it to WebP format.</p>

      <h2>Usage</h2>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`curl -X POST \\
  -H "Content-Type: image/jpeg" \\
  --data-binary @image.jpg \\
  http://localhost:3000/api/compress-image \\
  -o compressed.webp`}
      </pre>

      <h2>Specifications</h2>
      <ul>
        <li>Max size: 1200x1200px (aspect ratio preserved)</li>
        <li>Output format: WebP</li>
        <li>Quality: 85%</li>
        <li>Max upload size: 100MB</li>
      </ul>

      <h2>Response Codes</h2>
      <ul>
        <li><strong>200</strong>: Success - compressed image returned</li>
        <li><strong>400</strong>: Invalid content type</li>
        <li><strong>413</strong>: Image too large (max 100MB)</li>
        <li><strong>500</strong>: Processing error</li>
      </ul>

      <h2>Example with JavaScript</h2>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`const response = await fetch('/api/compress-image', {
  method: 'POST',
  headers: { 'Content-Type': file.type },
  body: await file.arrayBuffer()
});

const blob = await response.blob();`}
      </pre>
    </main>
  )
}
