# AGENTS.md

## Purpose

This repository contains additional contextual documentation in the `context/` directory.

All agents (including Codex or similar code-generation agents) MUST read and use the files in the `context/` directory before generating code, making architectural decisions, or answering repository-related questions.

---

## Required Behavior for Agents

1. **Always load the `context/` directory first**
   - Recursively read all `.md` files inside `context/`
   - Treat them as authoritative project context
   - Assume they contain architectural decisions, constraints, conventions, and domain-specific rules

2. **Context Has Priority**
   - If instructions in `context/` conflict with generic best practices, follow the project-specific context.
   - Do not ignore constraints described in those files.

3. **Before Writing Code**
   - Check for:
     - Architecture constraints
     - Naming conventions
     - Dependency rules
     - Security assumptions
     - Performance requirements
     - Style guidelines

4. **When Unsure**
   - Re-scan the `context/` directory before making assumptions.
   - Do not invent architectural patterns if the context specifies one.

5. **Updating Context**
   - If new architectural decisions are made, update or add a file in `context/`.
   - Keep context modular: one topic per file.

## Summary

The `context/` directory functions as long-term project memory.

Agents must treat it as required reading before producing output.
Failure to do so may result in incorrect or non-compliant implementations.
