#!/bin/bash
# setup.sh - Intelligent Model Router Installation & Setup Script
# Run with: bash setup.sh

set -e  # Exit on any error

echo "🚀 Intelligent Model Router - Setup Script"
echo "==========================================="

# 1. Check prerequisites
echo "→ Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found."
    exit 1
fi

echo "✅ Node.js $(node --version) and npm found."

# 2. Install dependencies
echo "→ Installing dependencies..."
npm install

# 3. Compile TypeScript
echo "→ Compiling TypeScript..."
npm run compile

# 4. Run tests
echo "→ Running full test suite..."
npm test

# 5. Package the extension
echo "→ Packaging VS Code extension (.vsix)..."
if ! command -v vsce &> /dev/null; then
    echo "→ Installing vsce globally..."
    npm install -g @vscode/vsce
fi
vsce package

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📦 Extension packaged as: intelligent-model-router-*.vsix"
echo ""
echo "Next steps:"
echo "   1. Install the .vsix in VS Code (Extensions → Install from VSIX...)"
echo "   2. Set your API keys (ANTHROPIC_API_KEY, etc.)"
echo "   3. Run Ollama with a strong coding model (e.g. deepseek-coder-v2)"
echo "   4. Open a workspace and run 'Router: Start New Session'"
echo ""
echo "For development:"
echo "   npm run compile     # Rebuild"
echo "   npm test            # Run tests"
echo "   F5 in VS Code       # Launch extension development host"
