# Loop Service — Phase 2 Interface Design

Phase 2 supports gRPC remote triggering for multi-channel access (Slack/Feishu/HTTP).

## Service: LoopService

### RunLoop
- Request: loop_definition_yaml, task_context
- Response: session_id

### GetLoopStatus
- Request: session_id
- Response: phase, iteration, last_eval_score

### InterruptLoop
- Request: session_id
- Response: success

Phase 1 equivalent: CLI `mobius run <name>`
