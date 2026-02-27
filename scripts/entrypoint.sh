#!/bin/bash

# Harbinger Entrypoint Script - COMPLETELY DYNAMIC CONFIGURATION
set -e

echo "🦞 Starting Harbinger Bug Bounty Platform..."

# Function to create required directories
create_directories() {
    echo "📁 Creating required directories..."
    mkdir -p /app/logs /app/data /app/config /app/mcp-plugins /app/tmp
    chmod 755 /app/logs /app/data /app/tmp
}

# Function to validate environment
validate_environment() {
    echo "🔍 Validating environment variables..."
    
    if [ "$APP_ENV" = "production" ]; then
        if [ "$DB_PASSWORD" = "change-me" ]; then
            echo "❌ ERROR: Cannot run production with default database password"
            exit 1
        fi
        
        if [ "$JWT_SECRET" = "change-me-in-production" ]; then
            echo "❌ ERROR: Cannot run production with default JWT secret"
            exit 1
        fi
    fi
}

# Function to generate dynamic configuration
generate_config() {
    echo "⚙️ Generating dynamic configuration..."
    
    # Create runtime config file
    cat > /app/config/runtime.env << EOF
APP_NAME=$APP_NAME
APP_VERSION=$APP_VERSION
APP_ENV=$APP_ENV
APP_PORT=$APP_PORT
APP_HOST=$APP_HOST
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=$REDIS_DB
NEO4J_HOST=$NEO4J_HOST
NEO4J_PORT=$NEO4J_PORT
NEO4J_USER=$NEO4J_USER
NEO4J_PASSWORD=$NEO4J_PASSWORD
MCP_ENABLED=$MCP_ENABLED
MCP_PLUGINS_DIR=$MCP_PLUGINS_DIR
MCP_HEXRIDGE_URL=$MCP_HEXRIDGE_URL
MCP_PENTAGI_URL=$MCP_PENTAGI_URL
MCP_UI_URL=$MCP_UI_URL
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=$JWT_EXPIRES_IN
CORS_ORIGIN=$CORS_ORIGIN
RATE_LIMIT_REQUESTS=$RATE_LIMIT_REQUESTS
RATE_LIMIT_WINDOW=$RATE_LIMIT_WINDOW
LOG_LEVEL=$LOG_LEVEL
LOG_FORMAT=$LOG_FORMAT
LOG_FILE=$LOG_FILE
API_BASE_URL=$API_BASE_URL
WS_URL=$WS_URL
FRONTEND_URL=$FRONTEND_URL
HACKERONE_API_URL=$HACKERONE_API_URL
HACKERONE_API_KEY=$HACKERONE_API_KEY
HACKERONE_USERNAME=$HACKERONE_USERNAME
BUGCROWD_API_URL=$BUGCROWD_API_URL
BUGCROWD_API_KEY=$BUGCROWD_API_KEY
BUGCROW_USERNAME=$BUGCROW_USERNAME
NIKTO_PATH=$NIKTO_PATH
DIRSEARCH_PATH=$DIRSEARCH_PATH
NUCLEI_PATH=$NUCLEI_PATH
BURP_PATH=$BURP_PATH
OWASP_ZAP_PATH=$OWASP_ZAP_PATH
SQLMAP_PATH=$SQLMAP_PATH
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_MODEL=$OPENAI_MODEL
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ANTHROPIC_MODEL=$ANTHROPIC_MODEL
SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL
DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
TEAMS_WEBHOOK_URL=$TEAMS_WEBHOOK_URL
AWS_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
S3_ACCESS_KEY=$S3_ACCESS_KEY
S3_SECRET_KEY=$S3_SECRET_KEY
CDN_URL=$CDN_URL
EOF

    # Create JSON configuration
    cat > /app/config/runtime.json << EOF
{
  "application": {
    "name": "$APP_NAME",
    "version": "$APP_VERSION",
    "environment": "$APP_ENV",
    "port": $APP_PORT,
    "host": "$APP_HOST"
  },
  "database": {
    "host": "$DB_HOST",
    "port": $DB_PORT,
    "name": "$DB_NAME",
    "user": "$DB_USER",
    "ssl": $DB_SSL
  },
  "redis": {
    "host": "$REDIS_HOST",
    "port": $REDIS_PORT,
    "db": $REDIS_DB
  },
  "neo4j": {
    "host": "$NEO4J_HOST",
    "port": $NEO4J_PORT,
    "user": "$NEO4J_USER"
  },
  "mcp": {
    "enabled": $MCP_ENABLED,
    "plugins_dir": "$MCP_PLUGINS_DIR",
    "hexridge_url": "$MCP_HEXRIDGE_URL",
    "pentagi_url": "$MCP_PENTAGI_URL",
    "ui_url": "$MCP_UI_URL"
  },
  "security": {
    "jwt_expires_in": "$JWT_EXPIRES_IN",
    "cors_origin": "$CORS_ORIGIN",
    "rate_limit_requests": $RATE_LIMIT_REQUESTS
  },
  "logging": {
    "level": "$LOG_LEVEL",
    "format": "$LOG_FORMAT",
    "file": "$LOG_FILE"
  }
}
EOF
}

# Function to perform health checks
health_check() {
    echo "🏥 Performing health checks..."
    
    if [ ! -f "/app/config/runtime.env" ]; then
        echo "❌ ERROR: Configuration file not found"
        exit 1
    fi
    
    if ! command -v harbinger-api &> /dev/null; then
        echo "❌ ERROR: harbinger-api binary not found"
        exit 1
    fi
    
    echo "✅ All health checks passed"
}

# Function to start the application
start_application() {
    echo "🚀 Starting Harbinger application..."
    
    chmod +x /app/harbinger-api
    exec /app/harbinger-api server --config=/app/config/runtime.env
}

# Function to display startup banner
startup_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🦞  HARBINGER                          ║"
    echo "║           Professional Bug Bounty Hunting Platform          ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Version: $APP_VERSION                                    ║"
    echo "║  Environment: $APP_ENV                                  ║"
    echo "║  Port: $APP_PORT                                          ║"
    echo "║  MCP Enabled: $MCP_ENABLED                                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# Main execution function
main() {
    startup_banner
    
    create_directories
    validate_environment
    generate_config
    health_check
    
    start_application
}

# Execute main function
main "$@"
