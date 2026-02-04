# MCP Troubleshooting Bot (Node.js)

This is a Webex Bot powered by the **Model Context Protocol (MCP)** and an LLM (OpenAI/Compatible). It acts as a troubleshooting assistant that can connect to an MCP server to retrieve logs, analyze issues, and provide technical support using a "Chain of Thought" reasoning process.

> **Acknowledgement**: The bot framework used in this project is based on [Webex Bot Starter](https://github.com/WebexSamples/webex-bot-starter).

## 🚀 Key Features

*   **MCP Client Integration**: Connects to MCP servers via SSE (Server-Sent Events) to discover and utilize tools dynamically.
*   **Webex Integration**: Responds to messages in Webex Spaces or 1:1 chats.
*   **Chain of Thought**: Uses advanced prompting (defined in `SKILL.md`) to plan, execute, and analyze troubleshooting steps.
*   **Robust Error Handling**: Auto-retries connections and handles JSON-RPC protocols over HTTP/SSE.

## 📋 Prerequisites

*   **Node.js**: **v20 (LTS)** is strictly required.
    *   *Warning*: Node.js v22+ is currently **incompatible** with the `webex-node-bot-framework` (causes `TypeError: Cannot set property navigator`).
*   **Webex Bot Token**: Create a bot at [developer.webex.com](https://developer.webex.com/my-apps/new/bot).
*   **MCP Server**: Access to a running MCP server (HTTP/SSE).
*   **LLM Provider**: OpenAI API Key or a compatible service (e.g., vLLM, internal proxy).

---

## 🛠️ Installation & Setup

### 1. Local Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/oliverzhu2005/webex-bot-starter.git
    cd webex-bot-starter
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configuration**:
    Create a `.env` file in the root directory:
    ```ini
    # Webex Identity
    BOTTOKEN=your_webex_bot_token_starting_with_M...

    # LLM Provider (OpenAI Compatible)
    CI_TOKEN=your_api_key_here
    LLM_BASE_URL=https://api.openai.com/v1  # or your proxy url
    LLM_MODEL=gpt-4o                        # or your model name
    
    # Optional
    CISCO_APP_NAME=mcp-troubleshooter
    ```

4.  **MCP Server Config**:
    Ensure `mcp_server_config.json` is present in the root. This file tells the bot where to find the MCP tools.
    ```json
    {
      "servers": {
        "mcp-server-1": {
          "type": "http",
          "url": "https://your-mcp-server-url/mcp/",
          "headers": { ... }
        }
      }
    }
    ```

5.  **Run the Bot**:
    ```bash
    npm start
    ```

---

## ☁️ Deployment on Remote Server (e.g., Ubuntu)

If you are deploying this to a server/VM:

1.  **Clone to the specific folder**:
    ```bash
    git clone https://github.com/oliverzhu2005/webex-bot-starter.git
    cd webex-bot-starter
    ```
    *Important: Do not run `npm install` in your home directory (`~`). Always `cd` into the project folder first.*

2.  **Install tools (if missing)**:
    ```bash
    sudo apt update
    sudo apt install nodejs npm
    # Ensure you are on Node v20. If not, use nvm to install v20.
    ```

3.  **Setup Environment**:
    Create your `.env` file on the server using `nano .env` or `vi .env`.

4.  **Start with Process Manager (Optional)**:
    Use `pm2` to keep the bot running:
    ```bash
    npm install -g pm2
    pm2 start index.js --name "webex-mcp-bot"
    pm2 save
    ```

---

## 💡 Usage

1.  Add the bot to a Webex Space or send it a Direct Message.
2.  Mention the bot (in a space) or just type (in DM).
3.  **Example Prompts**:
    *   *"Check the logs for user janedoe@example.com having crashing issues."*
    *   *"Search for tracking ID 12345-67890."*
    *   *"Why is the meeting audio failing for the last 3 hours?"*

The bot will:
1.  Acknowledge the request.
2.  Use the `SKILL.md` system prompt to "think" about the problem.
3.  Call the necessary MCP tools (search logs, analyze patterns).
4.  Return a summarized answer.

---

## 📂 Project Structure

*   `index.js`: Main entry point. Initializes Webex Framework and MCP Client.
*   `lib/mcpClient.js`: Custom MCP Client implementation handling SSE and JSON-RPC.
*   `lib/botLogic.js`: Handles the troubleshooting logic and LLM interaction.
*   `skills/troubleshooter/SKILL.md`: The "Brain" of the bot – contains the system prompt and reasoning rules.
*   `mcp_server_config.json`: Configuration for upstream MCP servers.
