# /rules

Mandatory Rules followed guide for operation and development

# Mandatory Pre-Action (No Exceptions)

**Treat this as mandatory. No task is too small to skip it.**

Before running any other tool or writing any code or answer that implements a user request:

1. **First:** Check `.cursor/rules/` — review rule files (e.g. `AGENT.mdc`, `AGENTS.mdc`, `production.mdc`, `rules.mdc`) relevant to the task so your actions align with project standards.
2. **Second:** Check `.cursor/wiki/` — read wiki docs (e.g. `robots.txt`, crawler/scope boundaries, project wiki) that apply to the request.
3. **Third:** List or read `.cursor/skills/` and identify skills that apply. Read the relevant `SKILL.md` (or skill docs) for those skills.
4. **Fourth:** Check `.cursor/llm/` for any docs or prompts that apply (e.g. `llm.txt`, usage constraints).
5. **Then:** Proceed with your reply or implementation using those resources.

**Enforcement:** Your first actions in the conversation must be steps 1–4 when the user asks you to do something (implement, create, fix, plan). Do not run unrelated tools or write code before completing this check. If the task is trivial (e.g. "what is 2+2"), you may skip; for any coding, planning, or project task, do the check first.

This rule works together with `AGENTS.mdc` and `AGENT.mdc`; together they require that `.cursor/` resources are always consulted before action.