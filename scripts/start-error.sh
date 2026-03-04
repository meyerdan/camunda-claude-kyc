#!/bin/bash
# Service error: ID doc starts with "ERROR" → HTTP 500 from mock server
set -e

echo "Starting service error scenario (Frank Error)..."
curl -s -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "kyc-onboarding",
    "variables": {
      "applicantName": "Frank Error",
      "email": "frank@test.com",
      "dateOfBirth": "1980-04-01",
      "country": "US",
      "idDocumentNumber": "ERROR500"
    }
  }' | jq .
