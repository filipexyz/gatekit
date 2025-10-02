# SDK Changelog Generation

You are generating a PR description for the **@gatekit/sdk** package update.

## Your Task

1. **Compare current SDK repo with new generated SDK**:

   The SDK repo has been cloned to `$GITHUB_WORKSPACE/sdk-repo/` and new files copied from `generated/sdk/`.

   ```bash
   cd $GITHUB_WORKSPACE/sdk-repo
   git diff --staged
   ```

   This shows the differences between the old SDK (in the repo) and new SDK (just copied).

2. **Read contract metadata**:

   ```bash
   cat $GITHUB_WORKSPACE/generated/contracts/contracts.json
   ```

3. **Understand what changed**:
   - New API endpoints added to SDK
   - Changed method signatures
   - New types extracted
   - Breaking changes in contracts
   - Removed functionality

4. **Generate PR title and description**:
   - Write PR title to `/tmp/sdk-pr-title.txt` (single line, no markdown)
   - Write PR body to `/tmp/sdk-pr-body.md` (full markdown description)

## Output Format

**File 1: `/tmp/sdk-pr-title.txt`** (Single line, no emojis, descriptive)

```
Update SDK with [brief description of main changes]
```

Examples:

- "Update SDK with webhook notification support"
- "Update SDK with breaking changes to message API"
- "Update SDK with new platform capabilities"

**File 2: `/tmp/sdk-pr-body.md`** (Full markdown description)

Write a GitHub PR description to `/tmp/sdk-pr-body.md` with this structure:

````markdown
## 🚀 Auto-generated SDK Update

**Version**: v{VERSION}
**Source**: [{COMMIT_SHA}](https://github.com/GateKit/backend/commit/{COMMIT_SHA})

### 📋 Changes

#### ✨ New Features

- List new endpoints/methods added
- Highlight new capabilities

#### 🔧 Improvements

- Enhanced type safety
- Better error handling
- Performance improvements

#### ⚠️ Breaking Changes

(Only if applicable)

- List breaking changes
- Explain migration path

#### 📊 Technical Details

- X contracts extracted
- Y types auto-discovered
- Z new methods generated

### 💡 Usage Examples

(Provide 1-2 code examples showing new features)

```typescript
// Example of new functionality
const gk = new GateKit({ apiKey: 'your-key' });
await gk.newFeature.doSomething();
```
````

### 🎯 Testing Checklist

- [ ] All TypeScript types compile
- [ ] SDK integration tests pass
- [ ] No breaking changes without migration guide
- [ ] Documentation updated

---

🤖 Generated with Claude Code - Ready for review and merge

```

## Important Rules

- Focus ONLY on SDK changes (ignore CLI/n8n)
- Be concise but thorough
- Highlight breaking changes prominently
- Use actual examples from the code
- No hallucination - only document real changes
- Use emojis sparingly and professionally
- Write PR title to `/tmp/sdk-pr-title.txt` (one line, no emoji)
- Write the complete PR body to `/tmp/sdk-pr-body.md`

## Environment Variables Available

- `VERSION`: Package version
- `COMMIT_SHA`: Git commit hash
- `COMMIT_MSG`: Original commit message
```
