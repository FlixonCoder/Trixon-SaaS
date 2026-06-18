# Trixon — Fix: Chat Access to Raw Code Snippets

---

## CONTEXT

The chat currently can't answer questions like "what system prompts are used in this codebase" because its context is built entirely from generated reports, scores, and action items — never from the actual raw source code. The `key_files` dict built during static extraction (README, entry points, route files, capped at 30 files / 8000 chars each) is used transiently to construct LLM prompts during analysis, then discarded — never persisted anywhere. By the time a user is chatting, there's nothing left to search.

This fix persists that snapshot and extends the existing lightweight keyword-retrieval pattern (from the v3.3 report-retrieval fix) to also search raw code when relevant.

**Scope honesty:** this only makes the already-selected `key_files` set searchable — not the entire repo. Deeply nested files that weren't selected as "key" during static extraction remain unsearchable. This is forward-only — existing analyses won't retroactively gain this capability unless re-analyzed.

---

## CHANGES

### 1. Persist the Key Files Snapshot

#### [NEW] Table: `code_snapshots`

```sql
CREATE TABLE IF NOT EXISTS public.code_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  key_files jsonb NOT NULL,  -- { "path/to/file": "content...", ... }
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.code_snapshots ENABLE ROW LEVEL SECURITY;
-- RLS policy: users can only read snapshots for analyses belonging to their own projects
CREATE POLICY "Users can view their own code snapshots" ON public.code_snapshots
  FOR SELECT USING (
    analysis_id IN (
      SELECT a.id FROM analyses a
      JOIN projects p ON p.id = a.project_id
      WHERE p.user_id = auth.uid()
    )
  );
```

#### [MODIFY] `analyze.py` — persist `key_files` after extraction, before generation

```python
# After static extraction completes (Step 2), before building LLM context layers:
supabase.table("code_snapshots").insert({
    "analysis_id": analysis_id,
    "key_files": extraction.key_files,  # already capped at 30 files / 8000 chars each
}).execute()
```

---

### 2. Raw Code Retrieval Function

#### [MODIFY] `chat.py` — new function, mirrors `retrieve_relevant_reports()` from v3.3

```python
def fetch_code_snapshot(analysis_id: str) -> dict[str, str]:
    """Fetches the persisted key_files snapshot for this analysis, if it exists."""
    result = supabase.table("code_snapshots")\
        .select("key_files")\
        .eq("analysis_id", analysis_id)\
        .single().execute().data
    return result["key_files"] if result else {}


CODE_SEARCH_TRIGGER_PATTERNS = [
    "system prompt", "config", "env var", "environment variable", "function",
    "class", "import", "dependency", "route", "endpoint", "schema", "model",
    "how is", "where is", "show me", "find", "code for", "implementation",
]

def retrieve_relevant_code(user_message: str, key_files: dict[str, str], max_tokens: int = 2000) -> str:
    """
    Lightweight keyword search across the persisted key_files snapshot.
    Only triggers when the question looks like a code-search question
    (avoids wasting tokens on every message).
    """
    message_lower = user_message.lower()

    looks_like_code_question = any(p in message_lower for p in CODE_SEARCH_TRIGGER_PATTERNS)
    if not looks_like_code_question:
        return ""

    # Extract probable search terms from the message (simple heuristic: words >3 chars,
    # excluding common stopwords) to match against file content
    search_terms = [w for w in re.findall(r'\b\w{4,}\b', message_lower)
                     if w not in {"what", "where", "show", "find", "code", "this", "that", "have"}]

    matches = []
    for path, content in key_files.items():
        content_lower = content.lower()
        match_count = sum(1 for term in search_terms if term in content_lower)
        if match_count > 0:
            matches.append((match_count, path, content))

    if not matches:
        return ""

    matches.sort(reverse=True)
    context_parts = []
    used_tokens = 0

    for _, path, content in matches[:3]:  # top 3 most relevant files
        estimated = len(content) // 4
        if used_tokens + estimated > max_tokens:
            remaining_chars = (max_tokens - used_tokens) * 4
            content = content[:remaining_chars] + "\n[truncated]"
        context_parts.append(f"### Code from `{path}`\n```\n{content}\n```")
        used_tokens += estimated
        if used_tokens >= max_tokens:
            break

    return "\n\n".join(context_parts)
```

---

### 3. Integrate into Chat Context Building

#### [MODIFY] `chat.py` — `build_chat_context()`

Add the code retrieval as an additional context layer, with its own token budget separate from the existing report-retrieval budget:

```python
# After existing report retrieval (v3.3):
key_files = fetch_code_snapshot(latest["id"])
code_context = retrieve_relevant_code(user_message, key_files, max_tokens=2000) if key_files else ""

# Include in the final context block, clearly labeled so the model knows this is real source:
if code_context:
    context_block += f"\n\n### Relevant Code From the Repository\n{code_context}"
```

Update the system prompt slightly to let the model know code snippets may be available:

```python
# Add to CHAT_SYSTEM_PROMPT:
"If relevant code snippets are included in your context below, you may reference them "
"directly and quote short relevant excerpts. If a question requires code that isn't "
"included in your context, say so honestly rather than guessing — suggest the user "
"check that specific file directly."
```

---

## SUCCESS CRITERIA

- [ ] New analyses persist a `code_snapshots` row containing the `key_files` dict
- [ ] Asking "what system prompts are used in this codebase" (or similar code-search questions) on a NEW analysis returns real file content, not a deflection
- [ ] Asking a non-code-search question (e.g. "what's my health score") does NOT trigger code retrieval — confirm via logs that `retrieve_relevant_code` returns empty for non-matching questions, keeping token usage low
- [ ] RLS confirmed: a user cannot fetch another user's `code_snapshots` row
- [ ] Chat is honest when asked about something not in the `key_files` selection (e.g. a deeply nested utility file) — should say it doesn't have that file rather than guessing
- [ ] Existing (pre-fix) analyses correctly show "no code snapshot available" behavior rather than erroring
