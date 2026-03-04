#!/bin/bash
# Sanctions hit: Name contains "SANCTIONED" → blocked
set -e

echo "Starting sanctions hit scenario (SANCTIONED Person)..."
curl -s -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "kyc-onboarding",
    "variables": {
      "applicantName": "SANCTIONED Person",
      "email": "blocked@test.com",
      "dateOfBirth": "1975-07-04",
      "country": "US",
      "idDocumentNumber": "US111111"
    }
  }' | jq .
