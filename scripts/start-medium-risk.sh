#!/bin/bash
# Medium risk: Customer from BR → requires compliance review
set -e

echo "Starting medium risk scenario (Bob Martinez - Medium Risk)..."
curl -s -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "kyc-onboarding",
    "variables": {
      "applicantName": "Bob Martinez",
      "email": "bob@test.com",
      "dateOfBirth": "1985-06-20",
      "country": "BR",
      "idDocumentNumber": "BR789012"
    }
  }' | jq .
