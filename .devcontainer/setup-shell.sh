#!/bin/bash
set -e
# Configure zsh history
cat >> ~/.zshrc << 'EOF'

# History configuration
export HISTFILE=~/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000

# History options
setopt HIST_IGNORE_DUPS      # Don't record duplicate commands
setopt SHARE_HISTORY         # Share history between sessions
setopt HIST_REDUCE_BLANKS    # Remove extra blanks from commands
setopt HIST_VERIFY           # Show command before executing from history
setopt APPEND_HISTORY        # Append to history file, don't overwrite
setopt INC_APPEND_HISTORY    # Add commands immediately to history
EOF

echo "Shell history configured successfully"

# Setup database and environment
echo "Setting up database environment..."

# Create .env file from example if it doesn't exist
# if [ ! -f /workspaces/siai/server/.env ]; then
#     echo "Creating .env file from .env.example..."
#     cp /workspaces/siai/server/.env.example /workspaces/siai/server/.env
# fi

# Wait for PostgreSQL to be ready
# echo "Waiting for PostgreSQL to be ready..."
# until pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; do
#     echo "PostgreSQL is not ready yet. Waiting..."
#     sleep 2
# done

# echo "PostgreSQL is ready!"

# # Run database migrations
# echo "Running database migrations..."
# cd /workspaces/siai/server && make migrate-up

# echo "Database setup completed successfully"