# CLI Changelog Generation

Generate a PR description for the **@gatekit/cli** package based on actual code changes.

## Your Task

1. **Analyze the git diff** to see what actually changed:

   ```bash
   cd $GITHUB_WORKSPACE/cli-repo
   git diff --staged
   ```

2. **Understand the changes** - Look for:
   - New commands
   - Updated dependencies
   - Command structure changes
   - Flag/option changes
   - Breaking changes

3. **Write concise output files**:
   - `/tmp/cli-pr-title.txt` - One line title (no emojis)
   - `/tmp/cli-pr-body.md` - Markdown PR description

## Output Guidelines

**Title** (`/tmp/cli-pr-title.txt`):

- One line, descriptive, no emojis
- Focus on the MAIN change
- Examples: "Update CLI dependencies", "Add message commands", "Fix config handling"

**Body** (`/tmp/cli-pr-body.md`):

- Start with brief summary
- List only ACTUAL changes from git diff
- Include version info: `**Version**: v{VERSION}`
- Link to source: `**Source**: [{COMMIT_SHA}](https://github.com/filipexyz/gatekit/commit/{COMMIT_SHA})`
- Keep it concise and direct

## Structure (adapt as needed)

````markdown
## Summary

[1-2 sentence description of what changed]

**Version**: v{VERSION}
**Source**: [{COMMIT_SHA}](https://github.com/filipexyz/gatekit/commit/{COMMIT_SHA})

### Changes

[List actual changes - be specific and direct]

- If new commands: list them with brief description
- If dependency updates: list old→new versions
- If breaking changes: explain clearly
- If bug fixes: mention what was fixed

### Usage Examples (only if new features)

```bash
# Show actual new commands if applicable
gatekit new-command --option value
```
````

### Migration (only if breaking changes)

[Instructions if needed]

```

## Important Rules

✅ **DO**:
- Be flexible - adapt structure to fit actual changes
- Focus on what matters - skip sections if not applicable
- Be direct and concise
- Use actual command names from git diff
- Include only relevant information
- Show real command examples if adding new features

❌ **DON'T**:
- Add sections that don't apply
- Include placeholder text like "X commands generated" if not relevant
- Add generic "improvements" that aren't real
- Use rigid template when simple is better
- Hallucinate commands

## Environment Variables

- `VERSION` - Package version
- `COMMIT_SHA` - Commit hash
- `COMMIT_MSG` - Commit message
```
