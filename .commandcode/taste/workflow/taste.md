# Workflow

- Expects the agent to actually launch/serve the app locally itself (e.g. `npm start` in the background) and hand back ready-to-use localhost URLs plus login credentials, rather than just telling them which commands to run. Confidence: 0.65
- Prefers the agent to verify a service is really up (HTTP status/redirect checks per route) before declaring it running. Confidence: 0.55
- Wants recommendations grounded in a full-codebase audit rather than guesses: expects the agent to actually scan routes/views/services and cite concrete file/line evidence before proposing changes. Confidence: 0.6
- Prefers a plan/recommendation first and gives explicit approval before the agent executes structural changes; expects the agent to wait for a go-ahead and offer to proceed stage-by-stage, and approves with a terse "oke" that then lets the agent run large multi-file refactors hands-off without further check-ins. Confidence: 0.6
- When approving a risky/tuning change, pairs the go-ahead with a risk check ("gas tapi ada bakal masalah gak?") — expects the agent to name the concrete failure modes/side effects (e.g. false "Offline" flags) and the mitigations, and will proceed once risks are bounded. Confidence: 0.5
