#!/bin/bash

echo "=== Testing Image Compression API ==="
echo ""

# Test 1: Check if output.webp exists and show content
if [ -f output.webp ]; then
    echo "1. File info:"
    file output.webp
    echo ""
    echo "2. File size:"
    ls -lh output.webp
    echo ""
    echo "3. First 200 bytes (might be JSON error):"
    head -c 200 output.webp
    echo ""
    echo ""
fi

# Test 2: Try downloading again with verbose output
echo "4. Testing API with verbose output:"
echo ""
curl -v -X POST \
  -H "Content-Type: image/png" \
  --data-binary @/Users/admin/Downloads/微信图片_20260112141705_24_3968.png \
  https://processimage.mexxxxai.win/api/compress-image \
  -o test-output.webp

echo ""
echo ""
echo "5. Test output file:"
if [ -f test-output.webp ]; then
    file test-output.webp
    ls -lh test-output.webp
    echo ""
    echo "Content preview:"
    head -c 200 test-output.webp
fi
