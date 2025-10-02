# SDK Changelog Generation

Generate a PR description for the **@gatekit/sdk** package based on actual code changes.

## Your Task

1. **Analyze the git diff** to see what actually changed:

   ```bash
   cd $GITHUB_WORKSPACE/sdk-repo
   git diff --staged
   ```

2. **Understand the changes** - Look for:
   - New methods/endpoints
   - Updated dependencies
   - Type changes
   - Configuration updates
   - Breaking changes

3. **Write concise output files**:
   - `/tmp/sdk-pr-title.txt` - One line title (no emojis)
   - `/tmp/sdk-pr-body.md` - Markdown PR description

## Output Guidelines

**Title** (`/tmp/sdk-pr-title.txt`):

- One line, descriptive, no emojis
- Focus on the MAIN change
- Examples: "Update SDK dependencies", "Add webhook support", "Fix message delivery"

**Body** (`/tmp/sdk-pr-body.md`):

- Start with brief summary
- List only ACTUAL changes from git diff
- Include version info using $VERSION: `**Version**: v$VERSION`
- Link to source backend: `**Source**: [GateKit Backend](https://github.com/filipexyz/gatekit)`
- Keep it concise and direct

## Structure (adapt as needed)

```markdown
## Summary

[1-2 sentence description of what changed]

**Version**: v$VERSION
**Source**: [GateKit Backend](https://github.com/filipexyz/gatekit)

### Changes

[List actual changes - be specific and direct]

- If new features: describe them
- If dependency updates: list old→new versions
- If breaking changes: explain clearly
- If bug fixes: mention what was fixed

### Migration (only if breaking changes)

[Instructions if needed]
```

## Important Rules

✅ **DO**:

- Be flexible - adapt structure to fit actual changes
- Focus on what matters - skip sections if not applicable
- Be direct and concise
- Use actual code/version numbers from git diff
- Include only relevant information

❌ **DON'T**:

- Add sections that don't apply
- Include placeholder text like "X contracts extracted" if not relevant
- Add generic "improvements" that aren't real
- Use rigid template when simple is better
- Hallucinate features

## Environment Variables

Available as shell environment variables (access with `$VARIABLE_NAME`):

- `$VERSION` - Package version (e.g., "1.2.1")
- `$COMMIT_SHA` - Commit hash (e.g., "a1b2c3d")
- `$COMMIT_MSG` - Commit message
- `$GITHUB_WORKSPACE` - Workspace directory

**IMPORTANT**: Use these actual values in your output, not placeholder text!
