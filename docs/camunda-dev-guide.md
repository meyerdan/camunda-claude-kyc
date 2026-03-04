# Camunda 8 Development Guide for Claude Code

This document teaches you how to develop solutions on Camunda 8. Read it before starting any Camunda project.

---

## 1. Environment

### Camunda 8.9 Run (Local Development)

| Component | URL |
|-----------|-----|
| REST API | http://localhost:8080/v2/ |
| MCP Server | http://localhost:8080/mcp/cluster |
| Operate (monitoring) | http://localhost:8080/operate |
| Tasklist (human tasks) | http://localhost:8080/tasklist |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Zeebe gRPC | localhost:26500 |

**Authentication:** None for local dev (default in C8 Run 8.9).

### MCP Tools Available

The Camunda MCP server exposes these tools (use them for deployment, instance management, and monitoring):

- `getClusterStatus` / `getTopology` — health check
- `searchProcessDefinitions` / `getProcessDefinition` / `getProcessDefinitionXml` — inspect deployed processes
- `createProcessInstance` — start a process (supports `awaitCompletion`)
- `searchProcessInstances` / `getProcessInstance` — query instances
- `searchIncidents` / `getIncident` / `resolveIncident` — find and fix stuck processes
- `searchVariables` / `getVariable` — inspect process data

### REST API (for operations not in MCP)

Deploy resources (BPMN, DMN, Forms) — not available via MCP, use REST:
```bash
curl -X POST http://localhost:8080/v2/deployments \
  -F "resources=@bpmn/my-process.bpmn" \
  -F "resources=@dmn/my-decision.dmn" \
  -F "resources=@forms/my-form.form"
```

Start an instance via REST:
```bash
curl -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{"bpmnProcessId": "my-process", "variables": {"key": "value"}}'
```

Search user tasks:
```bash
curl -X POST http://localhost:8080/v2/user-tasks/search \
  -H "Content-Type: application/json" -d '{}'
```

Complete a user task:
```bash
curl -X PATCH http://localhost:8080/v2/user-tasks/{key}/completion \
  -H "Content-Type: application/json" \
  -d '{"variables": {"approved": true}}'
```

---

## 2. BPMN Generation

### Generating New Processes

Write raw BPMN 2.0 XML directly. LLMs are effective at producing structured XML. Always include these namespaces and attributes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  xmlns:modeler="http://camunda.org/schema/modeler/1.0"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn"
                  exporter="Claude Code"
                  exporterVersion="1.0.0"
                  modeler:executionPlatform="Camunda Cloud"
                  modeler:executionPlatformVersion="8.9.0">
  <bpmn:process id="my-process" name="My Process" isExecutable="true">
    <!-- process elements here -->
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="my-process">
      <!-- shapes and edges here -->
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

**Critical rules:**
- `isExecutable="true"` is required on the process element
- Every element needs `<bpmn:incoming>` and `<bpmn:outgoing>` flow references (except start/end events which have one)
- Sequence flow IDs must match the incoming/outgoing references
- The `bpmndi:BPMNDiagram` section is required for the diagram to render in Operate/Modeler

### BPMN Element Patterns

**Start Event:**
```xml
<bpmn:startEvent id="start" name="Order Received">
  <bpmn:outgoing>flow1</bpmn:outgoing>
</bpmn:startEvent>
```

**Service Task (custom job worker):**
```xml
<bpmn:serviceTask id="validate" name="Validate Order">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="validate-order" retries="3"/>
  </bpmn:extensionElements>
  <bpmn:incoming>flow1</bpmn:incoming>
  <bpmn:outgoing>flow2</bpmn:outgoing>
</bpmn:serviceTask>
```

**User Task (with Camunda Form):**
```xml
<bpmn:userTask id="review" name="Review Application">
  <bpmn:extensionElements>
    <zeebe:formDefinition formId="review-form"/>
    <zeebe:assignmentDefinition candidateGroups="compliance"/>
  </bpmn:extensionElements>
  <bpmn:incoming>flow2</bpmn:incoming>
  <bpmn:outgoing>flow3</bpmn:outgoing>
</bpmn:userTask>
```

**Business Rule Task (DMN):**
```xml
<bpmn:businessRuleTask id="assess-risk" name="Risk Assessment">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="risk-assessment" resultVariable="riskLevel"/>
  </bpmn:extensionElements>
  <bpmn:incoming>flow3</bpmn:incoming>
  <bpmn:outgoing>flow4</bpmn:outgoing>
</bpmn:businessRuleTask>
```

**Exclusive Gateway (XOR):**
```xml
<bpmn:exclusiveGateway id="gw1" name="Risk Level?">
  <bpmn:incoming>flow4</bpmn:incoming>
  <bpmn:outgoing>flow_low</bpmn:outgoing>
  <bpmn:outgoing>flow_high</bpmn:outgoing>
</bpmn:exclusiveGateway>

<bpmn:sequenceFlow id="flow_low" sourceRef="gw1" targetRef="approve">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">=riskLevel = "LOW"</bpmn:conditionExpression>
</bpmn:sequenceFlow>

<bpmn:sequenceFlow id="flow_high" sourceRef="gw1" targetRef="reject">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">=riskLevel = "HIGH"</bpmn:conditionExpression>
</bpmn:sequenceFlow>
```
Note: Add `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` to the definitions element when using `xsi:type`.

**End Event:**
```xml
<bpmn:endEvent id="end" name="Done">
  <bpmn:incoming>flow5</bpmn:incoming>
</bpmn:endEvent>
```

**Error Boundary Event (on a service task):**
```xml
<bpmn:boundaryEvent id="error-boundary" name="Verification Failed" attachedToRef="verify-identity">
  <bpmn:outgoing>flow_error</bpmn:outgoing>
  <bpmn:errorEventDefinition id="ErrorEventDef_1" errorRef="Error_1"/>
</bpmn:boundaryEvent>

<!-- Define the error at the definitions level -->
<bpmn:error id="Error_1" name="VerificationError" errorCode="VERIFICATION_FAILED"/>
```

**Timer Boundary Event (non-interrupting, for reminders):**
```xml
<bpmn:boundaryEvent id="timer-reminder" name="Reminder" attachedToRef="review-task" cancelActivity="false">
  <bpmn:outgoing>flow_reminder</bpmn:outgoing>
  <bpmn:timerEventDefinition id="TimerDef_1">
    <bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT48H</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
</bpmn:boundaryEvent>
```

### Sequence Flows

Every connection between elements needs a sequence flow element AND corresponding DI edge:

```xml
<!-- Semantic model -->
<bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="validate"/>

<!-- DI (diagram) -->
<bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
  <di:waypoint x="215" y="117"/>
  <di:waypoint x="270" y="117"/>
</bpmndi:BPMNEdge>
```

### DI (Diagram Interchange)

Every BPMN element needs a corresponding shape in the BPMNDiagram section:

```xml
<!-- Start event (circle, 36x36) -->
<bpmndi:BPMNShape id="start_di" bpmnElement="start">
  <dc:Bounds x="179" y="99" width="36" height="36"/>
</bpmndi:BPMNShape>

<!-- Task (rectangle, 100x80) -->
<bpmndi:BPMNShape id="validate_di" bpmnElement="validate">
  <dc:Bounds x="270" y="77" width="100" height="80"/>
</bpmndi:BPMNShape>

<!-- Gateway (diamond, 50x50) -->
<bpmndi:BPMNShape id="gw1_di" bpmnElement="gw1" isMarkerVisible="true">
  <dc:Bounds x="425" y="92" width="50" height="50"/>
</bpmndi:BPMNShape>

<!-- End event (circle, 36x36) -->
<bpmndi:BPMNShape id="end_di" bpmnElement="end">
  <dc:Bounds x="552" y="99" width="36" height="36"/>
</bpmndi:BPMNShape>
```

**Spacing guidelines:** Place elements ~120px apart horizontally. Tasks are 100x80, events are 36x36, gateways are 50x50. Center elements vertically at the same y coordinate for a straight horizontal flow.

### Auto-Layout Alternative

If you skip the DI section or it gets messy after edits, use `bpmn-auto-layout`:

```typescript
import { layoutProcess } from 'bpmn-auto-layout';
const layoutedXml = await layoutProcess(rawXml);
```

Install: `npm install bpmn-auto-layout`

---

## 3. REST Connector (calling external APIs from BPMN)

The REST connector (`io.camunda:http-json:1`) is built into C8 Run. Configure it via `zeebe:ioMapping` and `zeebe:taskHeaders` in the BPMN XML.

### Working Example (from a real deployed process)

```xml
<bpmn:serviceTask id="call-api" name="Call External API">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:http-json:1" retries="3"/>
    <zeebe:ioMapping>
      <zeebe:input source="noAuth" target="authentication.type"/>
      <zeebe:input source="POST" target="method"/>
      <zeebe:input source="http://localhost:3001/api/my-endpoint" target="url"/>
      <zeebe:input source="={&#10;  &quot;name&quot;: applicantName,&#10;  &quot;email&quot;: email&#10;}" target="body"/>
      <zeebe:input source="20" target="connectionTimeoutInSeconds"/>
      <zeebe:input source="20" target="readTimeoutInSeconds"/>
    </zeebe:ioMapping>
    <zeebe:taskHeaders>
      <zeebe:header key="resultVariable" value="apiResponse"/>
      <zeebe:header key="resultExpression" value="={&#10;  status: response.status,&#10;  data: response.body&#10;}"/>
      <zeebe:header key="retryBackoff" value="PT0S"/>
    </zeebe:taskHeaders>
  </bpmn:extensionElements>
  <bpmn:incoming>flow1</bpmn:incoming>
  <bpmn:outgoing>flow2</bpmn:outgoing>
</bpmn:serviceTask>
```

### Input Mappings Reference

| Target | Description | Example |
|--------|-------------|---------|
| `method` | HTTP method | `GET`, `POST`, `PUT`, `DELETE` |
| `url` | Target URL (can use FEEL) | `http://localhost:3001/api/data` |
| `authentication.type` | Auth type | `noAuth`, `bearer`, `basic`, `oauth-client-credentials-body` |
| `authentication.token` | Bearer token | `={{secrets.MY_TOKEN}}` |
| `body` | Request body (FEEL expression) | `={"key": variable}` |
| `headers` | HTTP headers (FEEL map) | `={"X-Api-Key": "abc"}` |
| `queryParameters` | Query params (FEEL map) | `={"page": "1"}` |
| `connectionTimeoutInSeconds` | Connection timeout | `20` |
| `readTimeoutInSeconds` | Read timeout | `20` |

### Output Mappings Reference

Use `resultVariable` to store the whole response, or `resultExpression` to extract specific fields:

```xml
<!-- Store entire response -->
<zeebe:header key="resultVariable" value="apiResponse"/>

<!-- Or extract specific fields into process variables -->
<zeebe:header key="resultExpression" value="={
  verified: response.body.verified,
  score: response.body.score
}"/>
```

The response object has: `response.status` (number), `response.headers` (map), `response.body` (parsed JSON).

### FEEL Expressions in XML

FEEL expressions in BPMN XML must be prefixed with `=`. When embedded in XML attributes, escape special characters:
- `"` → `&quot;` or `&#34;`
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- Newlines → `&#10;`

Example body with variables:
```xml
<zeebe:input source="={&#10;  &quot;name&quot;: applicantName,&#10;  &quot;country&quot;: country&#10;}" target="body"/>
```

### Error Handling for REST Connectors

The REST connector throws a BPMN error when the HTTP call fails. Catch it with an error boundary event on the service task. The error code depends on the HTTP status or connection failure.

---

## 4. Editing Existing BPMN

For surgical edits to existing BPMN files (adding tasks, rewiring flows, changing properties), use `bpmn-moddle` + `zeebe-bpmn-moddle`:

```typescript
import { BpmnModdle } from 'bpmn-moddle';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

const moddle = new BpmnModdle({ zeebe: zeebeModdle });

// Parse existing BPMN
const { rootElement: definitions } = await moddle.fromXML(existingXml);
const process = definitions.rootElements.find(e => e.$type === 'bpmn:Process');

// Create new elements
const taskDef = moddle.create('zeebe:TaskDefinition', { type: 'my-task' });
const extElements = moddle.create('bpmn:ExtensionElements', { values: [taskDef] });
const newTask = moddle.create('bpmn:ServiceTask', {
  id: 'new-task',
  name: 'New Task',
  extensionElements: extElements
});
process.flowElements.push(newTask);

// Serialize back
const { xml } = await moddle.toXML(definitions);
```

After editing, re-layout with `bpmn-auto-layout` if you changed the process structure.

Install: `npm install bpmn-moddle zeebe-bpmn-moddle bpmn-auto-layout`

---

## 5. Job Workers (Node.js/TypeScript)

### Setup

```bash
npm install @camunda8/sdk typescript @types/node ts-node
```

Environment variables:
```bash
export ZEEBE_REST_ADDRESS='http://localhost:8080'
export ZEEBE_GRPC_ADDRESS='grpc://localhost:26500'
export CAMUNDA_AUTH_STRATEGY=NONE
```

### Worker Pattern

```typescript
import { Camunda8 } from '@camunda8/sdk';

const c8 = new Camunda8();
const zeebe = c8.getZeebeGrpcApiClient();

// Register a worker for a task type
zeebe.createWorker({
  taskType: 'my-task-type',
  taskHandler: async (job) => {
    const { orderId, items } = job.variables;

    // Do work...
    const result = await processOrder(orderId, items);

    // Complete with output variables
    return job.complete({
      orderProcessed: true,
      processedAt: new Date().toISOString()
    });
  }
});

// Worker for failures
zeebe.createWorker({
  taskType: 'risky-task',
  taskHandler: async (job) => {
    try {
      const result = await riskyOperation();
      return job.complete({ result });
    } catch (error) {
      // Fail the job (will retry based on retries config)
      return job.fail(`Operation failed: ${error.message}`);

      // Or throw a BPMN error (caught by error boundary events)
      // return job.error('ERROR_CODE', `Operation failed: ${error.message}`);
    }
  }
});

console.log('Workers started. Ctrl+C to exit.');
```

### Worker Entry Point (registering multiple workers)

```typescript
// src/index.ts
import { Camunda8 } from '@camunda8/sdk';
import { validateHandler } from './handlers/validate';
import { notifyHandler } from './handlers/notify';

const c8 = new Camunda8();
const zeebe = c8.getZeebeGrpcApiClient();

zeebe.createWorker({ taskType: 'validate-order', taskHandler: validateHandler });
zeebe.createWorker({ taskType: 'send-notification', taskHandler: notifyHandler });

console.log('All workers registered.');
```

---

## 6. DMN Decision Tables

### DMN 1.3 XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="Definitions_1"
             name="My Decisions"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="risk-assessment" name="Risk Assessment">
    <decisionTable id="DecisionTable_1" hitPolicy="FIRST">
      <input id="Input_1" label="Credit Score">
        <inputExpression id="InputExpr_1" typeRef="number">
          <text>creditScore</text>
        </inputExpression>
      </input>
      <input id="Input_2" label="Country">
        <inputExpression id="InputExpr_2" typeRef="string">
          <text>country</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Risk Level" name="riskLevel" typeRef="string"/>

      <!-- Rule 1: Low credit score → HIGH risk -->
      <rule id="Rule_1">
        <inputEntry id="IE_1"><text>&lt; 500</text></inputEntry>
        <inputEntry id="IE_2"><text></text></inputEntry>
        <outputEntry id="OE_1"><text>"HIGH"</text></outputEntry>
      </rule>

      <!-- Rule 2: Good score + safe country → LOW risk -->
      <rule id="Rule_2">
        <inputEntry id="IE_3"><text>&gt;= 650</text></inputEntry>
        <inputEntry id="IE_4"><text>"US","GB","DE","FR"</text></inputEntry>
        <outputEntry id="OE_2"><text>"LOW"</text></outputEntry>
      </rule>

      <!-- Rule 3: Default → MEDIUM -->
      <rule id="Rule_3">
        <inputEntry id="IE_5"><text></text></inputEntry>
        <inputEntry id="IE_6"><text></text></inputEntry>
        <outputEntry id="OE_3"><text>"MEDIUM"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
```

### Key Rules
- **Hit policy:** FIRST (top-down, first match wins), COLLECT, UNIQUE, etc.
- **Input types:** `string`, `number`, `boolean`, `date`
- **Empty input entries** match anything (wildcard)
- **String values** in output entries must be quoted: `"HIGH"` not `HIGH`
- **Comparison operators** in input entries: `< 500`, `>= 650`, `[500..700]`
- **List matching** for strings: `"US","GB","DE"` (matches any in list)
- Reference in BPMN via `<zeebe:calledDecision decisionId="risk-assessment" resultVariable="riskLevel"/>`

---

## 7. Camunda Forms (JSON)

### Structure

```json
{
  "components": [
    {
      "label": "Application ID",
      "type": "textfield",
      "key": "applicationId",
      "disabled": true
    },
    {
      "label": "Decision",
      "type": "select",
      "key": "decision",
      "valuesExpression": "=[\n  {\"label\": \"Approve\", \"value\": \"approved\"},\n  {\"label\": \"Reject\", \"value\": \"rejected\"}\n]"
    },
    {
      "label": "Comments",
      "type": "textarea",
      "key": "comments"
    },
    {
      "label": "Approved",
      "type": "checkbox",
      "key": "isApproved"
    }
  ],
  "type": "default",
  "id": "my-form-id",
  "schemaVersion": 16
}
```

### Available Component Types
- `textfield` — single-line text input
- `textarea` — multi-line text input
- `number` — numeric input
- `checkbox` — boolean toggle
- `select` — dropdown (use `values` array or `valuesExpression` for FEEL)
- `radio` — radio button group
- `taglist` — multi-select tags
- `text` — read-only display text (supports markdown-like formatting)
- `spacer` — visual spacing
- `separator` — horizontal rule
- `group` — groups child components
- `dynamiclist` — repeating component group
- `button` — action button
- `datetime` — date and/or time picker
- `image` — display an image
- `table` — display tabular data

### Linking Form to User Task in BPMN

```xml
<bpmn:userTask id="review" name="Review">
  <bpmn:extensionElements>
    <zeebe:formDefinition formId="my-form-id"/>
  </bpmn:extensionElements>
</bpmn:userTask>
```

The form's `key` values map to process variables. When the user completes the form in Tasklist, those variables are set on the process instance.

### Deploying Forms

Deploy `.form` files alongside BPMN:
```bash
curl -X POST http://localhost:8080/v2/deployments \
  -F "resources=@forms/my-form.form"
```

---

## 8. Deployment

### Deploy All Resources Together

Deploy BPMN, DMN, and Forms in a single request:

```bash
curl -X POST http://localhost:8080/v2/deployments \
  -F "resources=@bpmn/my-process.bpmn" \
  -F "resources=@dmn/my-decision.dmn" \
  -F "resources=@forms/review-form.form" \
  -F "resources=@forms/request-form.form"
```

This is an atomic operation — either all deploy or none do. The response includes the keys for each deployed resource.

### Starting Process Instances

```bash
curl -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "my-process",
    "variables": {
      "applicantName": "Alice Johnson",
      "email": "alice@example.com",
      "country": "US"
    }
  }'
```

Or use the MCP `createProcessInstance` tool.

---

## 9. Testing Workflow

1. **Deploy** all resources (BPMN + DMN + Forms) via REST
2. **Start** a process instance with test variables
3. **Check Operate** (http://localhost:8080/operate) for the instance status
4. **Run workers** (`cd workers && npx ts-node src/index.ts`)
5. **Search instances** via MCP to verify progress
6. **Search incidents** via MCP if something failed
7. **Complete user tasks** via Tasklist (http://localhost:8080/tasklist) or REST API
8. **Iterate** — fix BPMN/DMN/workers, redeploy, test again

### Debugging

- **Instance stuck?** Search incidents via MCP → read error message → fix root cause → resolve incident
- **Worker not picking up jobs?** Check the `taskType` matches between BPMN and worker registration
- **REST connector failing?** Check that the target URL is reachable from the C8 Run process (localhost works for native installs)
- **DMN not evaluating?** Check that input variable names in DMN match process variables exactly
- **Form not appearing in Tasklist?** Ensure the `formId` in BPMN matches the `id` in the form JSON, and both are deployed together

---

## 10. Project Structure (Recommended)

```
my-camunda-project/
├── CLAUDE.md                       # Project-specific instructions
├── docs/
│   └── camunda-dev-guide.md        # This file (reusable across projects)
├── bpmn/
│   └── *.bpmn                      # BPMN process definitions
├── dmn/
│   └── *.dmn                       # DMN decision tables
├── forms/
│   └── *.form                      # Camunda Forms (JSON)
├── workers/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Worker entry point
│       └── handlers/               # Individual task handlers
├── mock-server/                    # Optional: mock external APIs
│   ├── package.json
│   └── server.js
└── scripts/
    └── deploy.sh                   # Deploy all resources
```

### Worker package.json essentials:
```json
{
  "dependencies": {
    "@camunda8/sdk": "latest",
    "bpmn-moddle": "latest",
    "zeebe-bpmn-moddle": "latest",
    "bpmn-auto-layout": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "@types/node": "latest",
    "ts-node": "latest"
  }
}
```

### Worker tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```
