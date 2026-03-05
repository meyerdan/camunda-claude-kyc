# BPMN Modeling Best Practices

Reference guide synthesized from the [Camunda modeling best practices documentation](https://docs.camunda.io/docs/components/best-practices/best-practices-overview/#modeling-best-practices). Use these guidelines when creating or improving BPMN process models.

---

## 1. Labeling BPMN Elements

The single most important thing for readable models is to use well-chosen labels. The clarity and meaning of a process is only as good as its labels.

### Activities (Tasks)

- **Pattern:** `[Object] + [Verb in infinitive]`
- Describes *what you do with an object*
- Examples: `Verify identity`, `Create account`, `Send notification`, `Review application`
- For subprocesses/call activities, use a nominalized verb: `Payment processing`, `Order fulfillment`
- Avoid broad/general verbs like "Handle invoice" or "Process order" — be specific about the business action

### Events

- **Pattern:** `[Object] + [Verb reflecting a state]`
- Describes *which state an object is in* when the process leaves the event
- Examples: `Application received`, `Account created`, `Invoice paid`, `Order rejected`
- Be specific about success vs failure states:
  - Good: `Invoice paid` (success) / `Invoice rejected` (failure)
  - Bad: `Invoice processed` (ambiguous — could be either)
- Avoid broad verbs like "Invoice processed" or "Order handled"

### Gateways

- **Splitting XOR gateways:** Label with a **question**
  - Example: `ID verified?`, `Risk level?`, `Review decision?`
- **Outgoing sequence flows:** Label with **answers** to the gateway question
  - Example: `Yes` / `No`, `HIGH` / `MEDIUM` / `LOW`
- **Joining gateways:** Do NOT label (flow semantics are always the same)
- **Parallel gateways:** Do NOT label
- **Event-based gateways:** Do NOT label, but ensure subsequent events are named

### Processes

- Name pools with `[Object] + [Nominalized verb]`: `Customer onboarding`, `Tweet approval`
- Name lanes with the organizational role: `Compliance team`, `Credit bureau`
- Align the BPMN file name with the process ID

### General Conventions

- Use **sentence case** (first letter uppercase, rest lowercase, except proper nouns/acronyms)
- Avoid purely technical terms (class names, method names, service names)
- Avoid abbreviations — if used, explain them in brackets or annotations

---

## 2. Creating Readable Process Models

### Essential: Model from Left to Right

- Follow the reading direction (for western audiences)
- Position symbols left to right according to when they occur in time
- Supports the human field of vision which prefers wide screens

### Essential: Model Symmetrically

- Identify related splitting and joining gateways
- Form recognizable visual *blocks* with paired gateways
- Position gateway pairs as symmetrically as possible
- Enables readers to quickly identify and jump between logical parts of the diagram

### Essential: Emphasize the Happy Path

- Place happy path tasks, events, and gateways on a **straight sequence flow in the center** of the diagram
- Exception/error paths branch off above or below the happy path
- Readers can quickly follow the main business outcome

### Essential: Create Readable Sequence Flows

**Do:**
- Overlap sequence flows when multiple flows lead to the same target (reduces clutter)
- Keep flows going left-to-right whenever possible

**Don't:**
- Sequence flows violating reading direction (no outgoing flows on the left, no incoming flows on the right)
- Flows crossing each other
- Flows crossing many pools or lanes
- Very long (multi-page) sequence flows, especially against reading direction — use link events instead

**Tip:** Rearrange the order of lanes and paths to minimize crossing lines. There is often a "natural" order that reflects the order of first involvement.

---

## 3. Modeling Explicitly

Favor explicit constructs over implicit ones for better readability.

### Use Gateways Instead of Conditional Flows

- Always use gateway symbols for splitting process flow
- Don't use conditional sequence flows directly from tasks
- Readers understand gateway flow semantics better

### Always Show Start and End Events

- Always explicitly show start and end event symbols
- Process models without start/end events cannot be executed on Camunda
- Be specific about the business state reached at each end event

### Separate Splitting and Joining Gateways

- Use **two separate symbols** for split and join — don't combine them
- Readers often overlook join semantics when a gateway serves both purposes
- Supports symmetrical modeling with clear visual blocks
- Exception: a merging XOR directly after a start event can decrease readability — implicit merge is acceptable there

### Use XOR Gateway Markers

- Always show the **X** symbol on exclusive gateways
- Don't use blank/unmarked gateways — the X marker distinguishes XOR from other gateway types

### Always Use Explicit Parallel Gateway Symbols

- Don't draw multiple outgoing flows directly from a task
- The reader needs deeper BPMN knowledge to understand implicit parallelism

---

## 4. Layout and Visual Guidelines

### Symbol Size and Color

- Leave symbol sizes at their **defaults** — different sizes imply unwarranted importance
- Use short, consistent labels instead of enlarging symbols for long text
- Avoid excessive use of colors — they suggest different things to different readers
- Valid exception: mark the happy path with a visually weak color
- Valid exception: distinguish human vs technical flows by coloring pool headers

### Avoid Lanes (Usually)

- Lanes tend to conflict with symmetrical modeling, happy path emphasis, and readable sequence flows
- For operational models, prefer **collaboration diagrams** with separate pools per participant
- If lanes are needed, consider alternatives:
  - Include the role in the task name: `Review tweet [Boss]`
  - Use text annotations

### Data Objects

- Avoid excessive data objects and associations — they clutter the model
- Show only the **most important** data aspects
- Use data stores for coupling processes via shared data

### Avoid Modeling Retry Behavior

- Don't model retry loops in BPMN — use Camunda's built-in retry mechanisms and Operate tooling instead

---

## 5. Naming Technically Relevant IDs

For executable processes, use meaningful IDs that will appear in logs and tooling.

### Naming Convention Table

| Element | Prefix | Example |
|---------|--------|---------|
| Process | *(none or domain)* | `KycOnboardingProcess` |
| Start Event | `StartEvent_` | `StartEvent_ApplicationReceived` |
| End Event | `EndEvent_` | `EndEvent_AccountCreated` |
| Service Task | `Task_` | `Task_VerifyIdentity` |
| User Task | `Task_` | `Task_ReviewApplication` |
| XOR Gateway | `Gateway_` | `Gateway_IdVerified` |
| Sequence Flow | `Flow_` | `Flow_IdVerifiedYes` |
| Boundary Event | `BoundaryEvent_` | `BoundaryEvent_ReviewTimeout` |
| Error | `Error_` | `Error_VerificationFailed` |
| Message | `Message_` | `Message_ApplicationSubmitted` |

### Guidelines

- Use **PascalCase** (or adapt to your project's convention)
- IDs show up in logs, Operate, and debugging — meaningful IDs save time
- Align the BPMN file name with the process ID
- Change IDs early — renaming late can break tests and process logic
- Keep DI section IDs in sync with execution semantics (Modeler handles this automatically)

---

## 6. Quick Checklist for BPMN Review

- [ ] All elements are labeled using the naming conventions above
- [ ] Process flows left to right
- [ ] Happy path is on a straight horizontal line in the center
- [ ] Gateway pairs are symmetric (split/join form visual blocks)
- [ ] No sequence flows violate reading direction
- [ ] No unnecessary crossing flows
- [ ] Splitting and joining gateways are separate symbols
- [ ] XOR gateways have the X marker
- [ ] Start and end events are explicitly shown and labeled
- [ ] End events describe specific business outcomes (not generic "processed")
- [ ] Technical IDs are meaningful and follow naming conventions
- [ ] No excessive colors, data objects, or symbol size changes
- [ ] Retry behavior is NOT modeled (use Camunda tooling instead)

---

*Sources:*
- [Creating Readable Process Models](https://docs.camunda.io/docs/components/best-practices/modeling/creating-readable-process-models/)
- [Naming BPMN Elements](https://docs.camunda.io/docs/components/best-practices/modeling/naming-bpmn-elements/)
- [Naming Technically Relevant IDs](https://docs.camunda.io/docs/components/best-practices/modeling/naming-technically-relevant-ids/)
