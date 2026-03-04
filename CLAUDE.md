# KYC Customer Onboarding — Camunda 8 Process Application

## Reference

For general Camunda 8 development patterns (BPMN generation, editing, deployment, workers, connectors, forms, DMN), see `docs/camunda-dev-guide.md`. **Read it before starting any work.**

---

## Project Overview

Build a Know Your Customer (KYC) onboarding process that takes a customer application through identity verification, sanctions screening, credit scoring, risk assessment, and (when needed) manual compliance review. The solution runs entirely on a local Camunda 8.9 Run instance with simulated external APIs.

## Architecture

```
Camunda 8.9 Run (localhost:8080)
  ├── Zeebe Engine (executes KYC BPMN)
  ├── Operate (monitor at localhost:8080/operate)
  ├── Tasklist (human tasks at localhost:8080/tasklist)
  └── Connectors Runtime (REST connector built-in)

Mock API Server (localhost:3001)        ← Express.js, simulates external KYC services
Job Workers (gRPC to localhost:26500)   ← Node.js/TypeScript via @camunda8/sdk

Deployed Resources:
  ├── kyc-onboarding.bpmn              ← main process
  ├── risk-assessment.dmn              ← decision table
  ├── review-application.form          ← compliance review form
  └── request-documents.form           ← document request form
```

---

## The Process

### Flow

```
Start
  → [Prepare Application] (worker: prepare-application)
  → [Identity Verification] (REST connector → localhost:3001/api/identity-verify)
  → <ID Verified?> (XOR gateway)
      ├─ NO → [Notify: verification failed] (worker) → End
      └─ YES → [Sanctions Check] (REST connector → localhost:3001/api/sanctions-check)
          → <Sanctions Hit?> (XOR gateway)
              ├─ YES → [Notify: sanctions block] (worker) → End
              └─ NO → [Credit Score] (REST connector → localhost:3001/api/credit-score)
                  → [Risk Assessment] (DMN: risk-assessment)
                  → <Risk Level?> (XOR gateway)
                      ├─ HIGH → [Notify: rejected] (worker) → End
                      ├─ LOW → [Create Account] (worker) → [Notify: approved] (worker) → End
                      └─ MEDIUM → [Compliance Review] (user task, form: review-application)
                          → <Review Decision?> (XOR gateway)
                              ├─ approved → [Create Account] → [Notify: approved] → End
                              ├─ rejected → [Notify: rejected] → End
                              └─ request_docs → [Request Documents] (user task, form: request-documents)
                                  → loop back to [Compliance Review]
```

### Error Handling

- **Identity Verification REST failure** (HTTP 500): The REST connector will create an incident. Model an error boundary event on the identity verification task that catches connector errors → routes to "Notify: verification failed" → End.
- **Sanctions Hit**: Not an error — it's a normal business outcome. After the sanctions check, use an XOR gateway checking `sanctionsHit = true`.
- **Review Timeout**: Attach a non-interrupting timer boundary event to the Compliance Review user task:
  - First timer (PT10S for demo): fires a reminder notification via the send-notification worker
  - Second timer / escalation (PT20S for demo): interrupting timer that auto-rejects

### Process Variables

| Variable | Type | Set By | Description |
|----------|------|--------|-------------|
| `applicantName` | String | Start | Full name |
| `email` | String | Start | Email address |
| `dateOfBirth` | String | Start | YYYY-MM-DD |
| `country` | String | Start | Country code (US, GB, DE, etc.) |
| `idDocumentNumber` | String | Start | Passport/ID number |
| `applicationId` | String | prepare-application worker | Generated unique ID |
| `applicationStartedAt` | String | prepare-application worker | ISO timestamp |
| `identityVerified` | Boolean | REST connector result | ID check passed |
| `identityScore` | Number | REST connector result | Confidence 0-100 |
| `sanctionsHit` | Boolean | REST connector result | On sanctions list |
| `creditScore` | Number | REST connector result | Score 300-850 |
| `riskLevel` | String | DMN output | LOW / MEDIUM / HIGH |
| `reviewDecision` | String | User task form | approved / rejected / request_docs |
| `reviewComments` | String | User task form | Reviewer notes |
| `documentsRequested` | String | User task form | What docs are needed |
| `accountId` | String | create-account worker | Created account ID |
| `notificationType` | String | Set before notify tasks | approved / rejected / verification-failed / sanctions-block / reminder |

---

## Components to Build

### 1. Mock API Server (`mock-server/`)

Simple Express.js server on port 3001. Deterministic responses for testability.

```
POST /api/identity-verify
  Body: { name, dateOfBirth, idDocumentNumber }
  Responses:
    - idDocumentNumber starts with "FAIL" → { verified: false, score: 0, error: "Document not recognized" }
    - idDocumentNumber starts with "ERROR" → HTTP 500 { error: "Service unavailable" }
    - otherwise → { verified: true, score: 85 + random(0,15) }

POST /api/sanctions-check
  Body: { name, dateOfBirth, country }
  Responses:
    - name contains "SANCTIONED" → { hit: true, lists: ["OFAC", "EU"] }
    - otherwise → { hit: false, lists: [] }

POST /api/credit-score
  Body: { name, dateOfBirth, country }
  Responses:
    - country == "XX" → HTTP 503 { error: "Credit bureau unavailable" }
    - otherwise → { score: deterministic_score_from_name(600-850) }
```

### 2. BPMN Process (`bpmn/kyc-onboarding.bpmn`)

Generate as described in the Flow section above. Key configuration:

- **REST connector tasks**: Use `io.camunda:http-json:1` with `method=POST`, `url=http://localhost:3001/api/...`, `authentication.type=noAuth`
- **REST connector result expressions**: Map response body fields into process variables (e.g., `={identityVerified: response.body.verified, identityScore: response.body.score}`)
- **DMN task**: `<zeebe:calledDecision decisionId="risk-assessment" resultVariable="riskLevel"/>`
- **User tasks**: Use `<zeebe:formDefinition formId="review-application"/>` and `<zeebe:formDefinition formId="request-documents"/>`
- **Notification tasks**: Before each send-notification worker task, set `notificationType` using a FEEL expression in an ioMapping or use separate task types per notification (your choice, simpler is better)

### 3. DMN Decision Table (`dmn/risk-assessment.dmn`)

Decision ID: `risk-assessment` | Hit policy: FIRST

| # | identityScore (number) | creditScore (number) | country (string) | → riskLevel (string) |
|---|------------------------|----------------------|-------------------|----------------------|
| 1 | < 50 | | | "HIGH" |
| 2 | >= 50 | < 500 | | "HIGH" |
| 3 | >= 50 | [500..650) | | "MEDIUM" |
| 4 | >= 50 | >= 650 | "US","GB","DE","FR" | "LOW" |
| 5 | >= 50 | >= 650 | | "MEDIUM" |

Empty cells = match anything.

### 4. Camunda Forms (`forms/`)

**review-application.form**
- Read-only: applicationId, applicantName, email, country, identityScore, creditScore, riskLevel
- Select dropdown `reviewDecision`: approved / rejected / request_docs
- Textarea: reviewComments

**request-documents.form**
- Read-only: applicationId, applicantName
- Textarea: documentsRequested (what documents are needed)
- Textfield: documentNotes

### 5. Job Workers (`workers/src/handlers/`)

**prepare-application** (taskType: `prepare-application`)
- Validates required fields: applicantName, email, dateOfBirth, country, idDocumentNumber
- If any missing → `job.fail("Missing required field: ...")`
- Generates `applicationId` = `KYC-${Date.now()}`
- Sets `applicationStartedAt` = ISO timestamp
- Completes with these variables

**send-notification** (taskType: `send-notification`)
- Reads: email, applicantName, notificationType
- Logs to console: `[NOTIFICATION] To: ${email}, Type: ${notificationType}, Name: ${applicantName}`
- Sets `notificationSentAt` = ISO timestamp
- Completes

**create-account** (taskType: `create-account`)
- Reads: applicantName, email, country
- Generates `accountId` = `ACC-${Math.random().toString(36).substr(2, 9)}`
- Logs to console: `[ACCOUNT CREATED] ${accountId} for ${applicantName}`
- Sets `accountCreatedAt` = ISO timestamp
- Completes

---

## Project Structure

```
kyc-onboarding/
├── CLAUDE.md                          ← this file
├── docs/
│   └── camunda-dev-guide.md           ← general Camunda 8 dev patterns
├── bpmn/
│   └── kyc-onboarding.bpmn
├── dmn/
│   └── risk-assessment.dmn
├── forms/
│   ├── review-application.form
│   └── request-documents.form
├── mock-server/
│   ├── package.json
│   └── server.js
├── workers/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── handlers/
│           ├── prepare-application.ts
│           ├── send-notification.ts
│           └── create-account.ts
└── scripts/
    ├── deploy.sh
    ├── start-happy.sh
    ├── start-medium-risk.sh
    ├── start-sanctions.sh
    └── start-error.sh
```

---

## Test Scenarios

Use these to verify the solution works end-to-end. Each scenario uses specific input data that triggers deterministic behavior in the mock server.

| Scenario | Variables | Expected Path |
|----------|-----------|---------------|
| **Happy path (low risk)** | `applicantName: "Alice Johnson", email: "alice@test.com", dateOfBirth: "1990-01-15", country: "US", idDocumentNumber: "AB123456"` | Prepare → ID ✓ → Sanctions ✓ → Credit → DMN=LOW → Create Account → Notify approved → End |
| **Medium risk → approve** | `applicantName: "Bob Martinez", email: "bob@test.com", dateOfBirth: "1985-06-20", country: "BR", idDocumentNumber: "BR789012"` | ...DMN=MEDIUM → Compliance Review → Reviewer approves → Create Account → Notify approved → End |
| **Medium risk → reject** | `applicantName: "Carol Chen", email: "carol@test.com", dateOfBirth: "1992-03-10", country: "CN", idDocumentNumber: "CN345678"` | ...DMN=MEDIUM → Compliance Review → Reviewer rejects → Notify rejected → End |
| **Medium risk → request docs** | `applicantName: "Dave Wilson", email: "dave@test.com", dateOfBirth: "1988-11-05", country: "IN", idDocumentNumber: "IN901234"` | ...DMN=MEDIUM → Compliance Review → Request docs → Review again → Approve → End |
| **Sanctions hit** | `applicantName: "SANCTIONED Person", email: "blocked@test.com", dateOfBirth: "1975-07-04", country: "US", idDocumentNumber: "US111111"` | ...Sanctions check → hit=true → Notify sanctions block → End |
| **ID verification fail** | `applicantName: "Eve Fail", email: "eve@test.com", dateOfBirth: "1995-12-25", country: "US", idDocumentNumber: "FAIL999"` | ...ID check → verified=false → Notify verification failed → End |
| **Service error** | `applicantName: "Frank Error", email: "frank@test.com", dateOfBirth: "1980-04-01", country: "US", idDocumentNumber: "ERROR500"` | ...ID check → HTTP 500 → Error boundary → Notify verification failed → End |

Create shell scripts in `scripts/` that start each scenario via curl.

---

## Build Order

Build in this order, testing each step before moving to the next:

1. **Scaffold** the project directory and install dependencies
2. **Mock server** — build, start on :3001, test each endpoint with curl
3. **BPMN process** — generate the XML (start simple: just start → prepare → end), deploy, verify in Operate
4. **Extend BPMN incrementally** — add the REST connector calls one at a time, deploying and testing after each addition
5. **DMN** — generate risk-assessment.dmn, deploy alongside BPMN
6. **Forms** — generate both .form files, deploy alongside BPMN
7. **Workers** — implement all three handlers, run them, test happy path end-to-end
8. **Test all scenarios** — run each test scenario, verify correct path in Operate
9. **Add error handling** — error boundary events, timer events
10. **Polish** — verify all scenarios pass cleanly

---

## Technical Notes

- C8 Run is **native** (not Docker), so REST connector URLs use `http://localhost:3001`
- No authentication needed for any local API
- Deploy all resources in a single curl command for atomic deployment
- The mock server must be running before starting process instances that hit REST connectors
- Workers must be running for service tasks and notification tasks to complete
- User tasks require manual completion via Tasklist UI or REST API
