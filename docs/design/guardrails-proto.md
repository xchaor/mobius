# Guardrails Service — Phase 2 Interface Design

Phase 2 will implement Hermes-style Tool Guardrails as an independent Python process.
Below is the predefined gRPC interface contract.

## Service: GuardrailsService

### CheckToolCall
- Request: agent_id, tool_name, tool_params_json, iteration_count
- Response: decision (ALLOW/DENY/WARN/REQUIRE_HUMAN), reason, warnings[]

### ScanContext
- Request: agent_id, context_text
- Response: safe (bool), threats_found[]

### ReportExecution
- Request: agent_id, tool_name, result_summary, duration_ms
- Response: anomaly_detected (bool), anomaly_description

Phase 1 equivalent: `packages/core/src/guardrails/simple-guardrails.ts`
