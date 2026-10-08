# Ask Keyholder v2: plan (2026-10-08, founder: "loads for too long ... the output format is shit ... we can do much better with the feature")

One job: answer "who can move this money, how fast, and did that change?" for any program, key or question, in seconds, as a picture of the control, with every fact linked to its record.

## Measured today
- 31.9 s per question (POST /api/v1/ask, claude-opus-5-5, two tool calls, no streaming). Nothing shows until the end.
- Output is one markdown string rendered as plain paragraphs: `**bold**` and backticks show raw; addresses are 44-character walls; nothing links.
- Ask and the Stage map ignore each other.

## What changes
1. **Instant answer for names and addresses (no model):** a program name, program id, signer key or multisig address resolves from the record in under 300 ms and renders the answer card at once. About 80% of real questions are "tell me about X".
2. **Streaming for real questions:** the server streams events (SSE): each tool step as it runs ("Searching programs at Stage 0 ...", "Reading Kamino Lend's record"), then the answer. First feedback under 1 s.
3. **Model for speed:** claude-sonnet-5-5 at effort low for Ask (Opus stays for the pending-vote explanations, written offline). Target: full answer under 8 s.
4. **Structured output, not prose:** the model ends by calling an `answer` tool: `{ verdict (one sentence), programs[], keys[], facts[{label, value, weak|holds}], followups[3] }`. The page renders:
   - verdict as the large line;
   - per program a compact control card (stage chip, each path with threshold and delay, the path that sets the stage marked);
   - facts as a two-column ledger;
   - every address shortened, monospace, linked (/programs/[id], /signers/[key]), copy on click;
   - "Read from the record" chips for each tool call;
   - three follow-up questions as buttons.
5. **Ask drives the map:** when the answer names programs, the Stage map below picks the first one (camera glides to it, keys fan out). The page scrolls to the map with one link: "See it on the map".
6. **Conversation:** follow-ups keep the thread (last 3 turns sent); the URL carries `?ask=` so an answer can be shared.
7. **Failure is plain:** timeouts, rate limits and refusals each say what happened and offer the instant record lookup instead.

## Kept
- Answers only from Control Record tools; no outside knowledge; the five existing tools plus name search.

## Cost of not doing it
- The home page's primary action stays a 32 s spinner that returns a text wall.
