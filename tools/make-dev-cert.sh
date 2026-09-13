#!/usr/bin/env bash
# 生成本机 https 自签证书。浏览器只在安全上下文（https）下给定位权限，
# 手机通过局域网打开 App 时必须走 https，所以本机也绕不开证书。
# 换网络（换个 Wi-Fi、或用笔记本热点）后 IP 变了就重跑一次。
#   用法：bash tools/make-dev-cert.sh [额外IP ...]
set -e
cd "$(dirname "$0")/.."

# 家里 Wi-Fi 的地址 + Windows 移动热点的固定地址（生日当天带笔记本开热点时用）
IPS=("192.168.3.97" "192.168.137.1" "$@")
SAN="IP:127.0.0.1,DNS:localhost"
for ip in "${IPS[@]}"; do SAN="$SAN,IP:$ip"; done

mkdir -p .certs
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout .certs/dev-key.pem -out .certs/dev-cert.pem \
  -subj "/CN=exploration-atlas.local" -addext "subjectAltName=$SAN" 2>/dev/null

echo "已生成 .certs/dev-cert.pem，覆盖地址："
openssl x509 -in .certs/dev-cert.pem -noout -ext subjectAltName
