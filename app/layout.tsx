export const metadata = {
  title: 'Image Compression API',
  description: 'Simple image compression service for converting images to WebP format',
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
