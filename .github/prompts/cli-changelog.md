# CLI Changelog Generation

You are generating a PR description for the **@gatekit/cli** package update.

## Your Task

1. **Compare current CLI repo with new generated CLI**:

   The CLI repo has been cloned to `$GITHUB_WORKSPACE/cli-repo/` and new files copied from `generated/cli/`.

   ```bash
   cd $GITHUB_WORKSPACE/cli-repo
   git diff --staged
   ```

   This shows the differences between the old CLI (in the repo) and new CLI (just copied).

2. **Read contract metadata**:

   ```bash
   cat $GITHUB_WORKSPACE/generated/contracts/contracts.json
   ```

3. **Understand what changed**:
   - New CLI commands added
   - Changed command patterns
   - New flags/options
   - Permission system updates
   - Breaking changes in command structure

4. **Generate PR title and description**:
   - Write PR title to `/tmp/cli-pr-title.txt` (single line, no markdown)
   - Write PR body to `/tmp/cli-pr-body.md` (full markdown description)

## Output Format

**File 1: `/tmp/cli-pr-title.txt`** (Single line, no emojis, descriptive)

```
Update CLI with [brief description of main changes]
```

Examples:

- "Update CLI with new message commands"
- "Update CLI with breaking changes to platform commands"
- "Update CLI with permission-aware command system"

**File 2: `/tmp/cli-pr-body.md`** (Full markdown description)

Write a GitHub PR description to `/tmp/cli-pr-body.md` with this structure:

````markdown
## 🚀 Auto-generated CLI Update

**Version**: v{VERSION}
**Source**: [{COMMIT_SHA}](https://github.com/GateKit/backend/commit/{COMMIT_SHA})

### 📋 Changes

#### ✨ New Commands

- `gatekit command-name` - Description
- List all new commands added

#### 🔧 Improvements

- Enhanced pattern system
- Better error messages
- Permission-aware command discovery

#### ⚠️ Breaking Changes

(Only if applicable)

- List breaking changes in command structure
- Explain migration path for users

#### 🎯 Revolutionary Pattern System

Show examples of new command patterns:

```bash
# Simple targets
gatekit messages send --target "platformId:user:123" --text "Message"

# Multiple targets
gatekit messages send --targets "p1:user:123,p2:channel:456" --text "Broadcast"

# New functionality
gatekit new-command --option "value"
```
````

#### 📊 Technical Details

- X new commands generated
- Y contracts covered
- Z permission scopes supported

### 💡 Usage Examples

```bash
# Example 1: New feature
gatekit example-command --flag value

# Example 2: Updated pattern
gatekit updated-command --new-option
```

### 🎯 Testing Checklist

- [ ] All commands compile
- [ ] CLI help text accurate
- [ ] Permission discovery working
- [ ] Breaking changes documented

---

🤖 Generated with Claude Code - Ready for review and merge

```

## Important Rules

- Focus ONLY on CLI changes (ignore SDK/n8n)
- Emphasize command-line usability
- Show practical bash examples
- Highlight pattern system improvements
- No hallucination - only document real changes
- Write PR title to `/tmp/cli-pr-title.txt` (one line, no emoji)
- Write the complete PR body to `/tmp/cli-pr-body.md`

## Environment Variables Available

- `VERSION`: Package version
- `COMMIT_SHA`: Git commit hash
- `COMMIT_MSG`: Original commit message
```
