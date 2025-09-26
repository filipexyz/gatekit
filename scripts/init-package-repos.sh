#!/bin/bash

# Initialize package repositories for multi-repo publishing
# Run this script once to set up the target repositories

set -e

echo "🚀 Initializing package repositories for multi-repo publishing..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configure git
git config --global user.email "luis@filipe.xyz"
git config --global user.name "filipexyz"

# SDK Repository
echo -e "${BLUE}📦 Setting up gatekit-sdk repository...${NC}"
if [ -d "temp-sdk" ]; then rm -rf temp-sdk; fi
git clone git@github.com:filipexyz/gatekit-sdk.git temp-sdk
cd temp-sdk

# Create main branch if it doesn't exist
git checkout -b main 2>/dev/null || git checkout main

# Create initial structure
cat > README.md << 'EOF'
# @gatekit/sdk

TypeScript SDK for GateKit - Universal messaging gateway API.

This repository contains the automatically generated TypeScript SDK for the GateKit API.

## Installation

```bash
npm install @gatekit/sdk
```

See the full documentation in the README after package generation.
EOF

cat > package.json << 'EOF'
{
  "name": "@gatekit/sdk",
  "version": "0.0.1",
  "description": "TypeScript SDK for GateKit API",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/filipexyz/gatekit-sdk.git"
  },
  "author": "GateKit",
  "license": "MIT"
}
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
*.tgz
.DS_Store
EOF

git add .
git commit -m "Initial repository setup"
git push origin main
cd ..
rm -rf temp-sdk
echo -e "${GREEN}✅ SDK repository initialized${NC}"

# CLI Repository
echo -e "${BLUE}🖥️ Setting up gatekit-cli repository...${NC}"
if [ -d "temp-cli" ]; then rm -rf temp-cli; fi
git clone git@github.com:filipexyz/gatekit-cli.git temp-cli
cd temp-cli

# Create main branch if it doesn't exist
git checkout -b main 2>/dev/null || git checkout main

# Create initial structure
cat > README.md << 'EOF'
# @gatekit/cli

Official CLI for GateKit - Universal messaging gateway.

This repository contains the automatically generated CLI for the GateKit API.

## Installation

```bash
npm install -g @gatekit/cli
```

See the full documentation in the README after package generation.
EOF

cat > package.json << 'EOF'
{
  "name": "@gatekit/cli",
  "version": "0.0.1",
  "description": "Official CLI for GateKit API",
  "bin": {
    "gatekit": "dist/index.js"
  },
  "main": "dist/index.js",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/filipexyz/gatekit-cli.git"
  },
  "author": "GateKit",
  "license": "MIT"
}
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
*.tgz
.DS_Store
EOF

git add .
git commit -m "Initial repository setup"
git push origin main
cd ..
rm -rf temp-cli
echo -e "${GREEN}✅ CLI repository initialized${NC}"

# n8n Repository
echo -e "${BLUE}🎨 Setting up n8n-nodes-gatekit repository...${NC}"
if [ -d "temp-n8n" ]; then rm -rf temp-n8n; fi
git clone git@github.com:filipexyz/n8n-nodes-gatekit.git temp-n8n
cd temp-n8n

# Create main branch if it doesn't exist
git checkout -b main 2>/dev/null || git checkout main

# Create initial structure
cat > README.md << 'EOF'
# n8n-nodes-gatekit

n8n community nodes for GateKit - Universal messaging gateway.

This repository contains the automatically generated n8n community nodes for visual automation workflows.

## Installation

In n8n, go to Settings → Community Nodes and install:

```
n8n-nodes-gatekit
```

See the full documentation in the README after package generation.
EOF

cat > package.json << 'EOF'
{
  "name": "n8n-nodes-gatekit",
  "version": "0.0.1",
  "description": "n8n community nodes for GateKit API",
  "main": "dist/index.js",
  "n8n": {
    "nodes": ["dist/nodes/GateKit.node.js"],
    "credentials": ["dist/credentials/GateKitApi.credentials.js"]
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/filipexyz/n8n-nodes-gatekit.git"
  },
  "author": "GateKit",
  "license": "MIT",
  "keywords": ["n8n", "n8n-community-node", "gatekit", "messaging"]
}
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
*.tgz
.DS_Store
EOF

git add .
git commit -m "Initial repository setup"
git push origin main
cd ..
rm -rf temp-n8n
echo -e "${GREEN}✅ n8n repository initialized${NC}"

echo ""
echo -e "${GREEN}🎉 All package repositories initialized successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Add PERSONAL_ACCESS_TOKEN secret to your main repo"
echo "2. Run the Multi-Repo Package Publishing workflow"
echo "3. Review and merge the generated PRs"
echo ""
echo "Repository links:"
echo "• https://github.com/filipexyz/gatekit-sdk"
echo "• https://github.com/filipexyz/gatekit-cli"
echo "• https://github.com/filipexyz/n8n-nodes-gatekit"