# MCP Troubleshooting Bot (Node.js)

This is a Webex Bot powered by the **Model Context Protocol (MCP)** and an LLM (OpenAI/Compatible). It acts as a troubleshooting assistant that can connect to an MCP server to retrieve logs, analyze issues, and provide technical support using a "Chain of Thought" reasoning process.

## Prerequisites

-   **Node.js**: **v20 (LTS)** recommended.
    -   *Note: Node.js v22+ may cause issues with the current Webex SDK.*
-   **Webex Bot Token**: From [developer.webex.com](https://developer.webex.com/my-apps/new/bot).
-   **MCP Server**: A running MCP server (HTTP/SSE) to provide tools.
-   **LLM Provider**: OpenAI API Key or compatible service (e.g., standard OpenAI or Cisco internal clouds).

## Installation

1.  **Clone/Download** this repository.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```

## Configuration

### 1. Environment Variables (`.env`)
Create a `.env` file in the root directory with the following variables:

```ini
# Webex Bot Token
BOTTOKEN=your_webex_bot_token_here

# LLM Configuration (OpenAI Compatible)
CI_TOKEN=your_openai_or_proxy_api_key
LLM_BASE_URL=https://api.openai.com/v1  # Or your internal proxy URL
LLM_MODEL=gpt-4                         # Or your preferred model

# Optional Identity
CISCO_APP_NAME=mcp-troubleshooter
```

### 2. MCP Server Config (`mcp_server_config.json`)
Ensure `mcp_server_config.json` exists in the root and points to your MCP server:

```json
{
    "servers": {
        "mcp-webex-tools-http": {
            "type": "http",
            "url": "https://your-mcp-server.example.com/mcp/",
            "headers": {
                "VERSION": "1.2",
                "Connection": "keep-alive"
            }
        }
    }
}
```

### 3. Bot Skill Only (`skills/troubleshooter/SKILL.md`)
The system prompt and behavior are defined here. You can modify the `<system_instructions>` or time range rules in this file.

## Running the Bot

Start the bot using:

```bash
npm start
```

You should see logs indicating the framework has started and the MCP session is connected:
```text
Loaded MCP URL: ...
Loaded System Prompt from ...
framework is all fired up!
🔌 Connecting to MCP Server...
✨ MCP Session Connected via SSE
```

## Usage

1.  Add the bot to a Webex Space or Direct Message it.
2.  Ask a troubleshooting question, e.g.:
    *   "Check logs for trackingId abc-123"
    *   "Why did the meeting fail?"
3.  The bot will:
    *   Think (Chain of Thought).
    *   Call MCP tools (via the configured server).
    *   Analyze the results.
    *   Provide a summary.
