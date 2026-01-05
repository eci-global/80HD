#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="${OTELCOL_CONFIG:-$ROOT_DIR/observability/otelcol-debug.yaml}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Collector config not found at $CONFIG_FILE" >&2
  exit 1
fi

if command -v otelcol-contrib >/dev/null 2>&1; then
  OTELCOL_BIN="otelcol-contrib"
elif command -v otelcol >/dev/null 2>&1; then
  OTELCOL_BIN="otelcol"
else
  echo "ERROR: otelcol-contrib (or otelcol) is not installed. Install from https://github.com/open-telemetry/opentelemetry-collector-releases" >&2
  exit 1
fi

forward_endpoint="${CORALOGIX_COLLECTOR_FORWARD_ENDPOINT:-${CX_ENDPOINT:-}}"
if [ -z "$forward_endpoint" ]; then
  echo "ERROR: Set CORALOGIX_COLLECTOR_FORWARD_ENDPOINT or CX_ENDPOINT to your Coralogix ingress host (e.g. ingress.us1.coralogix.com:443)." >&2
  exit 1
fi

forward_token="${CORALOGIX_COLLECTOR_FORWARD_TOKEN:-${CORALOGIX_TOKEN:-${CX_TOKEN:-${CX_SEND_DATA_TOKEN:-}}}}"
if [ -z "$forward_token" ]; then
  echo "ERROR: Provide CORALOGIX_COLLECTOR_FORWARD_TOKEN (or CX_TOKEN/CX_SEND_DATA_TOKEN)." >&2
  exit 1
fi

export CORALOGIX_COLLECTOR_FORWARD_ENDPOINT="$forward_endpoint"
export CORALOGIX_COLLECTOR_FORWARD_TOKEN="$forward_token"
export CORALOGIX_COLLECTOR_RECEIVER_ENDPOINT="${CORALOGIX_COLLECTOR_RECEIVER_ENDPOINT:-0.0.0.0:4317}"
export CORALOGIX_COLLECTOR_HTTP_ENDPOINT="${CORALOGIX_COLLECTOR_HTTP_ENDPOINT:-0.0.0.0:4318}"
export CORALOGIX_COLLECTOR_SERVICE_NAME="${CORALOGIX_COLLECTOR_SERVICE_NAME:-litellm-proxy-debug}"
export CORALOGIX_COLLECTOR_SERVICE_NAMESPACE="${CORALOGIX_COLLECTOR_SERVICE_NAMESPACE:-litellm}"
export CORALOGIX_COLLECTOR_FORWARD_INSECURE="${CORALOGIX_COLLECTOR_FORWARD_INSECURE:-false}"
# Coralogix requires cx.application.name and cx.subsystem.name resource attributes
export CX_APPLICATION_NAME="${CX_APPLICATION_NAME:-claude-code}"
export CX_SUBSYSTEM_NAME="${CX_SUBSYSTEM_NAME:-litellm-proxy}"

printf "Starting local OTEL collector (receiver grpc=%s, forwarding to %s)\n" \
  "$CORALOGIX_COLLECTOR_RECEIVER_ENDPOINT" "$CORALOGIX_COLLECTOR_FORWARD_ENDPOINT"

exec "$OTELCOL_BIN" --config "$CONFIG_FILE" "$@"
