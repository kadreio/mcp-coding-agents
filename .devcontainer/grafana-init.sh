#!/bin/sh
# This script initializes Grafana with dashboards on startup

# Wait for Grafana to be ready
until curl -s http://localhost:3000/api/health | grep -q "ok"; do
  echo "Waiting for Grafana to start..."
  sleep 2
done

echo "Grafana is ready, importing dashboards..."

# Function to import a dashboard
import_dashboard() {
  local file=$1
  local folder_id=${2:-0}
  local dashboard_name=$(basename "$file")
  
  echo "Importing $dashboard_name to folder $folder_id..."
  
  # Create temporary file with import wrapper
  cat > /tmp/import.json << EOF
{
  "dashboard": $(cat "$file"),
  "overwrite": true,
  "folderId": $folder_id
}
EOF
  
  # Import the dashboard
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n admin:admin | base64)" \
    -d @/tmp/import.json \
    http://localhost:3000/api/dashboards/db | grep -q "success"
    
  if [ $? -eq 0 ]; then
    echo "✓ Imported $dashboard_name"
  else
    echo "✗ Failed to import $dashboard_name"
  fi
}

# Import our custom dashboards (folder 0 = General)
if [ -f /dashboards/chat-messages.json ]; then
  import_dashboard /dashboards/chat-messages.json 0
fi

if [ -f /dashboards/jetstream-monitoring.json ]; then
  import_dashboard /dashboards/jetstream-monitoring.json 0
fi

# Import Docker Logs dashboards (folder 1 = Docker Logs)
for dashboard in /dashboards/docker-*.json /dashboards/tempo-*.json /dashboards/unified-*.json; do
  if [ -f "$dashboard" ]; then
    import_dashboard "$dashboard" 1
  fi
done

echo "Dashboard import complete!"