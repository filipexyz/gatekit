# n8n Node Changelog Generation

You are generating a PR description for the **n8n-nodes-gatekit** package update.

## Your Task

1. **Compare current n8n repo with new generated n8n**:

   The n8n repo has been cloned to `$GITHUB_WORKSPACE/n8n-repo/` and new files copied from `generated/n8n/`.

   ```bash
   cd $GITHUB_WORKSPACE/n8n-repo
   git diff --staged
   ```

   This shows the differences between the old n8n nodes (in the repo) and new n8n nodes (just copied).

2. **Read contract metadata**:

   ```bash
   cat $GITHUB_WORKSPACE/generated/contracts/contracts.json
   ```

3. **Understand what changed**:
   - New n8n operations added
   - Changed node parameters
   - New workflow capabilities
   - Visual UI improvements
   - Breaking changes in node structure

4. **Generate PR title and description**:
   - Write PR title to `/tmp/n8n-pr-title.txt` (single line, no markdown)
   - Write PR body to `/tmp/n8n-pr-body.md` (full markdown description)

## Output Format

**File 1: `/tmp/n8n-pr-title.txt`** (Single line, no emojis, descriptive)

```
Update n8n nodes with [brief description of main changes]
```

Examples:

- "Update n8n nodes with new messaging operations"
- "Update n8n nodes with webhook support"
- "Update n8n nodes with platform management operations"

**File 2: `/tmp/n8n-pr-body.md`** (Full markdown description)

Write a GitHub PR description to `/tmp/n8n-pr-body.md` with this structure:

```markdown
## 🚀 Auto-generated n8n Nodes Update

**Version**: v{VERSION}
**Source**: [{COMMIT_SHA}](https://github.com/GateKit/backend/commit/{COMMIT_SHA})

### 📋 Changes

#### ✨ New Operations

- **Operation Name** - Description
- List all new n8n operations added

#### 🔧 Improvements

- Enhanced visual workflow capabilities
- Better parameter validation
- Improved error handling in nodes

#### ⚠️ Breaking Changes

(Only if applicable)

- List breaking changes in node structure
- Migration guide for existing workflows

#### 🎨 n8n Community Impact

- 🎯 **300k+ n8n users** benefit from GateKit automation
- 🔧 **Visual workflows** for messaging platforms
- 🚀 **Drag-and-drop** platform management

#### 📊 Technical Details

- X new operations generated
- Y contracts converted to nodes
- Z workflow capabilities added

### 💡 Workflow Examples

Describe new workflow possibilities:
```

1. [Trigger] → [GateKit: New Operation] → [Action]
2. [Schedule] → [GateKit: Send Message] → [Notification]

```

### 🎯 Testing Checklist

- [ ] n8n package compiles
- [ ] Node descriptions accurate
- [ ] Parameter validation working
- [ ] Credentials flow functional

---

🤖 Generated with Claude Code - Ready for review and merge
```

## Important Rules

- Focus ONLY on n8n node changes (ignore SDK/CLI)
- Emphasize visual workflow capabilities
- Highlight community impact (300k+ users)
- Use n8n terminology (operations, nodes, workflows)
- No hallucination - only document real changes
- Write PR title to `/tmp/n8n-pr-title.txt` (one line, no emoji)
- Write the complete PR body to `/tmp/n8n-pr-body.md`

## Environment Variables Available

- `VERSION`: Package version
- `COMMIT_SHA`: Git commit hash
- `COMMIT_MSG`: Original commit message
