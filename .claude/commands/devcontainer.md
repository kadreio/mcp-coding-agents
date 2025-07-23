Your goal is to create a devcontainer to be able to use this project in vscode and codespaces.

You will create a new container in ./devcontainers to set up.

You must include this feature:
"features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0.5": {}
}

You have access to the devcontainer cli, and should test all changes against that cli to make sure the container starts correctly and behaves expectedly.

You can find the specific docs on configuring a development environment here docs/contributing/development/

We do not wish to use the docker-compose method, and we primarily care about working on the superset frontend and backend.

Our goal for the end of this feature is that we are able to

1. Launch a devcontainer
2. That devcontainer automatically sets up all dependancies
3. If this is the first time launching it (postgres is not configured), we automatically set that up
4. The devcontainer automatically starts the frontend and backend
5. We can connect to those processes from exposed ports
6. Changes to code are automatically picked up and redeployed
