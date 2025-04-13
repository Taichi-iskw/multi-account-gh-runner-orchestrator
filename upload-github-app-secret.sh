#!/bin/bash

# 使用方法
# ./upload-github-app-secret.sh <secret-name> <path-to-private-key-pem> 

set -e

SECRET_NAME=$1
PRIVATE_KEY_PATH=$2

if [ -z "$SECRET_NAME" ] || [ -z "$PRIVATE_KEY_PATH" ]; then
  echo "Usage: $0 <secret-name> <path-to-private-key-pem> "
  exit 1
fi

# Private Keyを読み込んで改行コードを安全に処理する
PRIVATE_KEY_CONTENT=$(awk 'BEGIN{ORS="\\n"} {print}' "$PRIVATE_KEY_PATH")

# JSON形式を作成
SECRET_JSON=$(cat <<EOF
{
  "PRIVATE_KEY": "$PRIVATE_KEY_CONTENT"
}
EOF
)

# AWS CLIでSecrets Managerに登録
aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string "$SECRET_JSON" || \
aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$SECRET_JSON"

echo "✅ Successfully uploaded GitHub App secret to Secrets Manager: $SECRET_NAME"