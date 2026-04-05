#!/bin/bash

SIZE=$(du -sm src-tauri/target | cut -f1)

if [ "$SIZE" -gt 5000 ]; then
  echo "Cleaning Tauri build (too big)..."
  cd src-tauri && cargo clean
else
  echo "Tauri build size is fine"
fi