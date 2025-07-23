
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
tmux attach -t dev