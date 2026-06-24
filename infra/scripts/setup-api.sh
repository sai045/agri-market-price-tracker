#!/usr/bin/env bash
set -euo pipefail

: "${INSTANCE_NAME:=market-price-tracker-api}"
: "${KEY_NAME:?Set KEY_NAME env var for SSH keypair}"

aws ec2 run-instances \
  --image-id ami-0f58b397bc5c1f2e8 \
  --instance-type t3.micro \
  --key-name "$KEY_NAME" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]"

echo "EC2 instance launch requested: $INSTANCE_NAME"
