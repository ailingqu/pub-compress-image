export const metadata = {
  title: 'Image Compression API',
  description: 'A simple API to compress images to WebP format',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
