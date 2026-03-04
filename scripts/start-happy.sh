#!/bin/bash
# Happy path: Low risk customer from US → auto-approved
set -e

echo "Starting happy path scenario (Alice Johnson - Low Risk)..."
curl -s -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "kyc-onboarding",
    "variables": {
      "applicantName": "Alice Johnson",
      "email": "alice@test.com",
      "dateOfBirth": "1990-01-15",
      "country": "US",
      "idDocumentNumber": "AB123456"
    }
  }' | jq .
