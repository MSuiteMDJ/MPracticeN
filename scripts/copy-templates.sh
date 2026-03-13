#!/bin/bash

# Copy all HTML templates from MDJ_Generated_Templates to parent directory
# This replaces old templates with new M Duty branded versions

SOURCE_DIR="mdj_full_template_library/MDJ_Generated_Templates"
DEST_DIR="mdj_full_template_library"

echo "Copying templates from $SOURCE_DIR to $DEST_DIR"
echo "================================================"

count=0
for file in "$SOURCE_DIR"/*.html; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Skip the colour guide
        if [ "$filename" != "M Colours.html" ]; then
            cp "$file" "$DEST_DIR/"
            echo "✓ Copied: $filename"
            ((count++))
        fi
    fi
done

echo "================================================"
echo "Complete! Copied $count templates"
