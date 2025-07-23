# Start with Debian 12
FROM debian:12

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential packages in one layer
RUN apt-get update  
RUN apt-get install -y --no-install-recommends zsh \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    sudo \
    locales \
    build-essential \
    pkg-config \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libx11-xcb1 \
    libx11-xcb-dev \
    xdg-utils \
    tmux \
    openssh-client

RUN curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh
RUN sudo -E bash nodesource_setup.sh
RUN sudo apt-get install -y nodejs

RUN rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Set shell
ENV SHELL=/bin/zsh

# Install Go
ENV GO_VERSION=1.24.4
RUN ARCH=$(dpkg --print-architecture) && \
    wget -q https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz \
    && tar -xzf go${GO_VERSION}.linux-${ARCH}.tar.gz -C /usr/local \
    && rm go${GO_VERSION}.linux-${ARCH}.tar.gz

# Set up Go environment
ENV GOROOT=/usr/local/go
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:$GOROOT/bin:$PATH

# Create go directories
RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 777 "$GOPATH"

# Create non-root user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME -s /bin/zsh \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Install minimal Go tools
ENV GOROOT=/usr/local/go
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:$GOROOT/bin:$PATH
ENV CGO_ENABLED=0
RUN go version && \
    go install golang.org/x/tools/gopls@v0.18.1 && \
    go install github.com/go-delve/delve/cmd/dlv@v1.24.1

# Install NATS CLI
RUN go install github.com/nats-io/natscli/nats@latest && \
    nats --version

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

RUN curl -sS https://starship.rs/install.sh | sh -s -- --yes 

# Switch to non-root user
USER $USERNAME

RUN sudo npm i -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli

RUN mkdir -p /home/$USERNAME/.config && \
    echo 'eval "$(starship init zsh)"' >> /home/$USERNAME/.zshrc && \
    echo 'export GOPATH=$HOME/go' >> /home/$USERNAME/.zshrc && \
    echo 'export PATH=$GOPATH/bin:$PATH' >> /home/$USERNAME/.zshrc && \
    echo '# NATS CLI configuration' >> /home/$USERNAME/.zshrc && \
    echo 'export NATS_URL=nats://siai:siai_dev@localhost:4222' >> /home/$USERNAME/.zshrc && \
    echo 'alias nats-local="nats --server=nats://siai:siai_dev@localhost:4222"' >> /home/$USERNAME/.zshrc && \
    echo '# uv configuration' >> /home/$USERNAME/.zshrc && \
    echo 'export PATH="/root/.local/bin:$PATH"' >> /home/$USERNAME/.zshrc

# Set working directory
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]