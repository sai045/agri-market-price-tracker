#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ALERT_EMAIL=you@example.com bash infra/scripts/setup-cost-guardrails.sh
#
# Creates:
# - Monthly cost budget ($5) with 60%/80%/100% thresholds
# - Billing alarms in us-east-1 ($3 and $5)

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUDGET_NAME="${BUDGET_NAME:-market-price-tracker-monthly-budget}"
MONTHLY_LIMIT="${MONTHLY_LIMIT:-5}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SNS_TOPIC_NAME="${SNS_TOPIC_NAME:-market-price-tracker-billing-alerts}"

echo "Setting guardrails for account ${ACCOUNT_ID}"

if [[ -n "${ALERT_EMAIL}" ]]; then
  echo "Creating/using SNS topic for alerts..."
  TOPIC_ARN="$(aws sns create-topic --name "${SNS_TOPIC_NAME}" --query TopicArn --output text --region us-east-1)"
  aws sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol email \
    --notification-endpoint "${ALERT_EMAIL}" \
    --region us-east-1 >/dev/null || true
  echo "Check your inbox and confirm SNS subscription: ${ALERT_EMAIL}"
else
  TOPIC_ARN=""
  echo "ALERT_EMAIL not set, skipping SNS subscription."
fi

if [[ -n "${TOPIC_ARN}" ]]; then
  aws cloudwatch put-metric-alarm \
    --alarm-name "market-price-tracker-billing-3usd" \
    --alarm-description "Alarm when estimated AWS charges exceed USD 3" \
    --namespace AWS/Billing \
    --metric-name EstimatedCharges \
    --dimensions Name=Currency,Value=USD \
    --statistic Maximum \
    --period 21600 \
    --evaluation-periods 1 \
    --threshold 3 \
    --comparison-operator GreaterThanThreshold \
    --alarm-actions "${TOPIC_ARN}" \
    --region us-east-1

  aws cloudwatch put-metric-alarm \
    --alarm-name "market-price-tracker-billing-5usd" \
    --alarm-description "Alarm when estimated AWS charges exceed USD 5" \
    --namespace AWS/Billing \
    --metric-name EstimatedCharges \
    --dimensions Name=Currency,Value=USD \
    --statistic Maximum \
    --period 21600 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --alarm-actions "${TOPIC_ARN}" \
    --region us-east-1
fi

BUDGET_JSON="$(mktemp)"
cat >"${BUDGET_JSON}" <<EOF
{
  "BudgetName": "${BUDGET_NAME}",
  "BudgetLimit": { "Amount": "${MONTHLY_LIMIT}", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {},
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false,
    "IncludeRefund": false,
    "IncludeCredit": false,
    "IncludeUpfront": true,
    "IncludeRecurring": true,
    "IncludeOtherSubscription": true,
    "IncludeSupport": true,
    "IncludeDiscount": true,
    "UseAmortized": false
  }
}
EOF

if [[ -n "${ALERT_EMAIL}" ]]; then
  NOTIFICATIONS_JSON="$(mktemp)"
  cat >"${NOTIFICATIONS_JSON}" <<EOF
[
  {
    "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 60, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${ALERT_EMAIL}" } ]
  },
  {
    "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 80, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${ALERT_EMAIL}" } ]
  },
  {
    "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 100, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [ { "SubscriptionType": "EMAIL", "Address": "${ALERT_EMAIL}" } ]
  }
]
EOF

  if aws budgets describe-budget --account-id "${ACCOUNT_ID}" --budget-name "${BUDGET_NAME}" >/dev/null 2>&1; then
    aws budgets update-budget --account-id "${ACCOUNT_ID}" --new-budget "file://${BUDGET_JSON}"
  else
    aws budgets create-budget \
      --account-id "${ACCOUNT_ID}" \
      --budget "file://${BUDGET_JSON}" \
      --notifications-with-subscribers "file://${NOTIFICATIONS_JSON}"
  fi
  rm -f "${NOTIFICATIONS_JSON}"
else
  if aws budgets describe-budget --account-id "${ACCOUNT_ID}" --budget-name "${BUDGET_NAME}" >/dev/null 2>&1; then
    aws budgets update-budget --account-id "${ACCOUNT_ID}" --new-budget "file://${BUDGET_JSON}"
  else
    aws budgets create-budget --account-id "${ACCOUNT_ID}" --budget "file://${BUDGET_JSON}"
  fi
fi

rm -f "${BUDGET_JSON}"
echo "Cost guardrails configured. Monthly budget: USD ${MONTHLY_LIMIT}."
