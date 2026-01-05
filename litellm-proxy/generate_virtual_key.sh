#!/bin/bash
# Generate a virtual key for LiteLLM proxy
# Usage: ./generate_virtual_key.sh [model1,model2,...]

cd "$(dirname "$0")"

# Read master key from config
MASTER_KEY=$(grep "master_key:" litellm_config.yaml | awk '{print $2}' | tr -d '"')

if [ -z "$MASTER_KEY" ] || [ "$MASTER_KEY" = "sk-1234-change-me" ]; then
    echo "ERROR: Please set a secure master_key in litellm_config.yaml first"
    exit 1
fi

# Default models if not provided
MODELS="${1:-claude-sonnet-4-5,claude-haiku-4-5,claude-opus-4-5}"

# Convert comma-separated to JSON array
MODELS_JSON=$(echo "$MODELS" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')

echo "Generating virtual key for models: $MODELS"
echo ""

# Generate the key
curl -X POST 'http://localhost:4000/key/generate' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $MASTER_KEY" \
  -d "{
    \"models\": $MODELS_JSON,
    \"metadata\": {
      \"user\": \"cursor-ide\",
      \"purpose\": \"development\"
    }
  }" 2>/dev/null | python3 -m json.tool

echo ""
echo "⚠️  Save this key immediately - you won't see it again!"
echo "Use it in Cursor Settings → Models → OpenAI API Key"

