#!/bin/bash
# Initialize Grafana dashboards after container startup
# Run this script after devcontainer is created

set -e

echo "Initializing Grafana dashboards..."

# Wait for Grafana to be ready
until curl -s http://localhost:3000/api/health | grep -q "ok"; do
  echo "Waiting for Grafana to start..."
  sleep 2
done

# Get or create Docker Logs folder
FOLDER_ID=$(curl -s http://admin:admin@localhost:3000/api/folders | jq -r '.[] | select(.title == "Docker Logs") | .id')
if [ -z "$FOLDER_ID" ]; then
  echo "Creating Docker Logs folder..."
  FOLDER_ID=$(curl -s -X POST -H "Content-Type: application/json" -d '{"title":"Docker Logs"}' http://admin:admin@localhost:3000/api/folders | jq -r '.id')
fi

echo "Docker Logs folder ID: $FOLDER_ID"

# Function to import dashboard
import_dashboard() {
  local file=$1
  local folder_id=${2:-0}
  local name=$(basename "$file")
  
  echo "Importing $name..."
  
  jq "{dashboard: ., overwrite: true, folderId: $folder_id}" "$file" > /tmp/import-temp.json
  
  result=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d @/tmp/import-temp.json \
    http://admin:admin@localhost:3000/api/dashboards/db)
  
  if echo "$result" | grep -q "success"; then
    echo "✓ Imported $name"
  else
    echo "✗ Failed to import $name: $result"
  fi
}

# Import custom dashboards to General folder
cd /workspaces/siai/.devcontainer/grafana-provisioning/dashboards

# Import dashboards if they exist
if [ -f "chat-messages.json" ]; then
  import_dashboard "chat-messages.json" 0
else
  echo "⚠ chat-messages.json not found, skipping..."
fi

if [ -f "jetstream-monitoring.json" ]; then
  import_dashboard "jetstream-monitoring.json" 0
else
  echo "⚠ jetstream-monitoring.json not found, skipping..."
fi

# Import Docker/Tempo dashboards to Docker Logs folder
for dashboard in docker-*.json tempo-*.json unified-*.json; do
  if [ -f "$dashboard" ]; then
    import_dashboard "$dashboard" "$FOLDER_ID"
  fi
done

echo "Dashboard initialization complete!"
echo ""
echo "To ensure dashboards persist across restarts, add this to your .devcontainer/devcontainer.json:"
echo '  "postStartCommand": ".devcontainer/init-grafana-dashboards.sh"'

cd /workspaces/siai/


# Enable pane borders with titles
tmux new-session -d -s dev
tmux set -g pane-border-status bottom
tmux set -g pane-border-format "#{pane_index}: #{pane_title}"

# Server pane
tmux select-pane -T "Server"
tmux send-keys 'cd server && make dev' C-m

# Worker pane
tmux split-window -h
tmux select-pane -T "Worker"
tmux send-keys 'cd server && make dev-worker' C-m

# Client pane
tmux split-window -v
tmux select-pane -T "Client"
tmux send-keys 'cd client && npm run dev' C-m

tmux select-pane -t 0
echo "alias cdev='tmux attach -t dev'" >> ~/.zshrc

