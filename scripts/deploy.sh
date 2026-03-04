#!/bin/bash
# Deploy all resources to Camunda 8 Run
set -e

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Deploying KYC onboarding resources..."
curl -s -X POST http://localhost:8080/v2/deployments \
  -F "resources=@${BASE_DIR}/bpmn/kyc-onboarding.bpmn" \
  -F "resources=@${BASE_DIR}/dmn/risk-assessment.dmn" \
  -F "resources=@${BASE_DIR}/forms/review-application.form" \
  -F "resources=@${BASE_DIR}/forms/request-documents.form" | jq .

echo "Deployment complete."
