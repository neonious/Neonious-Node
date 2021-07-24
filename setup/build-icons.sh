#!/bin/bash

function build_icon() {
    rm -rf $1.iconset $1.icns
    mkdir $1.iconset
    sips -z 16 16     $1.png --out $1.iconset/icon_16x16.png
    sips -z 32 32     $1.png --out $1.iconset/icon_16x16@2x.png
    sips -z 32 32     $1.png --out $1.iconset/icon_32x32.png
    sips -z 64 64     $1.png --out $1.iconset/icon_32x32@2x.png
    sips -z 128 128   $1.png --out $1.iconset/icon_128x128.png
    sips -z 256 256   $1.png --out $1.iconset/icon_128x128@2x.png
    sips -z 256 256   $1.png --out $1.iconset/icon_256x256.png
    sips -z 512 512   $1.png --out $1.iconset/icon_256x256@2x.png
    sips -z 512 512   $1.png --out $1.iconset/icon_512x512.png
    sips -z 1024 1024 $1.png --out $1.iconset/icon_1024x1024.png
    cp $1.iconset/icon_16x16.png ../app/tray
    cp $1.iconset/icon_16x16@2x.png ../app/tray
    iconutil -c icns -o $1.icns $1.iconset
    rm -rf $1.iconset
}

build_icon app-icon