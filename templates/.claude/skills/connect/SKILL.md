---
name: connect
description: Resolve eventmodelers connection config (token, boardId, baseUrl) from .eventmodelers/config.json — ask the user for missing values, persist them, and add the file to .gitignore. All other skills invoke this first.
---

# Connect — Resolve Eventmodelers Config

**Every other skill invokes this skill first** before making any API calls. Do not proceed past this skill until all three values (`TOKEN`, `BOARD_ID`, `BASE_URL`) are resolved.

---

## What this skill produces

After running, the following variables are available for the rest of the session:

| Variable | Header sent to API | Description |
|----------|--------------------|-------------|
| `TOKEN` | `x-token` | API token UUID |
| `BOARD_ID` | `x-board-id` | Target board UUID |
| `BASE_URL` | — | Base URL, e.g. `http://localhost:3000` |

Every API call in every skill must include these three headers:
```
x-token: <TOKEN>
x-board-id: <BOARD_ID>
x-user-id: <skill-name>   ← set by each skill individually
```

---

## Step 1 — Read config file

Check whether `.eventmodelers/config.json` exists in the current working directory:

```bash
cat .eventmodelers/config.json 2>/dev/null
```

If the file exists and is valid JSON, extract:
- `token` → `TOKEN`
- `boardId` → `BOARD_ID`
- `baseUrl` → `BASE_URL` (default: `http://localhost:3000` if missing)

If all three are present, skip to **Step 4 — Verify**.

---

## Step 2 — Ask for missing values

If the file does not exist or any required field is missing, ask the user for only what's missing. Ask all missing fields in a single message:

| Field | What to ask |
|-------|-------------|
| `token` | "Please provide your eventmodelers API token (a UUID from your workspace settings)." |
| `boardId` | "Please provide the board ID you want to work with (the UUID from the board URL)." |
| `baseUrl` | Do **not** ask — default to `http://localhost:3000` silently. |

Where to find the token: users generate API tokens in their workspace settings at the eventmodelers platform. The token is shown only once at creation time. It is a UUID and must belong to the same organization as the board.

---

## Step 3 — Persist config

Once all values are collected, write the config file:

```bash
mkdir -p .eventmodelers
cat > .eventmodelers/config.json << 'EOF'
{
  "token": "<TOKEN>",
  "boardId": "<BOARD_ID>",
  "baseUrl": "<BASE_URL>"
}
EOF
```

Then ensure `.eventmodelers/config.json` is in `.gitignore`. Check whether it is already present:

```bash
grep -q ".eventmodelers/config.json" .gitignore 2>/dev/null || echo "MISSING"
```

If `MISSING`, append it:

```bash
echo ".eventmodelers/config.json" >> .gitignore
```

Tell the user: `"Config saved to .eventmodelers/config.json and added to .gitignore."`

---

## Step 4 — Verify

Confirm the token and board are valid with a lightweight call:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-token: <TOKEN>" \
  -H "x-board-id: <BOARD_ID>" \
  -H "x-user-id: connect-skill" \
  "<BASE_URL>/api/boards/<BOARD_ID>/nodes?type=CHAPTER"
```

| Response | Action |
|----------|--------|
| `200` | Config is valid. Print one line: `"Connected — board <BOARD_ID>"` and return. |
| `401` | Token is invalid or missing. Tell the user and re-run from Step 2, clearing `token`. |
| `403` | Token organization does not match board. Tell the user to check that the token was issued for the correct workspace. Re-run from Step 2 for both fields. |
| `404` | Board not found. Tell the user and re-run from Step 2, clearing `boardId`. |
| Any other | Print the status code and raw response. Ask the user how to proceed. |

---

## Config file format

`.eventmodelers/config.json`:
```json
{
  "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "boardId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "baseUrl": "http://localhost:3000"
}
```

The `token` field is a secret. It is never logged or shown after initial confirmation.

---

## Security notes

- The config file is workspace-local and gitignored — never commit it.
- The token grants write access to all boards in its organization — treat it like a password.
- If a skill receives a `401` or `403` mid-session, re-invoke this skill to refresh the config before retrying.
