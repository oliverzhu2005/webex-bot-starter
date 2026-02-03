//Webex Bot Starter - featuring the webex-node-bot-framework
require("dotenv").config();
var framework = require("webex-node-bot-framework");
var webhook = require("webex-node-bot-framework/webhook");
var express = require("express");
var bodyParser = require("body-parser");
const fs = require('fs');
const McpClient = require('./lib/mcpClient');
const BotLogic = require('./lib/botLogic');

var app = express();
app.use(bodyParser.json());
app.use(express.static("images"));

const config = {
  token: process.env.BOTTOKEN || process.env.WEBEX_BOT_TOKEN,
};

if (process.env.WEBHOOKURL && process.env.PORT) {
  config.webhookUrl = process.env.WEBHOOKURL;
  config.port = process.env.PORT;
}

// --- MCP and AI Setup ---
let mcpUrl;
try {
    const configPath = './mcp_server_config.json';
    if (fs.existsSync(configPath)) {
         const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
         // Adjust based on your config structure. Assuming single server for now.
         const firstServerKey = Object.keys(mcpConfig.servers)[0];
         mcpUrl = mcpConfig.servers[firstServerKey].url;
         console.log(`Loaded MCP URL: ${mcpUrl}`);
    } else {
        console.warn("mcp_server_config.json not found.");
    }
} catch (e) {
    console.error("Could not load mcp_server_config.json", e);
}

let systemPrompt = "You are a helpful assistant.";
try {
    // Try to load from the structured skill directory first
    const skillPaths = [
        './skills/troubleshooter/SKILL.md',
        './SKILL.md'
    ];
    
    let loaded = false;
    for (const skillPath of skillPaths) {
         if (fs.existsSync(skillPath)) {
            const skillContent = fs.readFileSync(skillPath, 'utf8');
            const skillParts = skillContent.split('---');
            if (skillParts.length >= 3) {
                systemPrompt = skillParts[2].trim();
            }
            console.log(`Loaded System Prompt from ${skillPath}`);
            loaded = true;
            break;
        }
    }
    
    if (!loaded) {
        console.warn("SKILL.md not found in standard locations.");
    }
} catch (e) {
    console.error("Could not load SKILL.md", e);
}

// Init MCP Client
const mcpClient = new McpClient(mcpUrl);

// Store logical bots per room to maintain history context
const bots = new Map();

// --- Framework Setup ---
var framework = new framework(config);
framework.start();
console.log("Starting framework, please wait...");

framework.on("initialized", async () => {
  console.log("framework is all fired up! [Press CTRL-C to quit]");
  if (mcpUrl) {
      try {
          await mcpClient.connect();
          await mcpClient.initialize();
      } catch (e) {
          console.error("Failed to connect/init MCP Server on startup:", e);
      }
  }
});

framework.on("spawn", (bot, id, actorId) => {
  if (actorId) {
    // New interaction
    bot.webex.people.get(actorId).then((user) => {
      bot.say(`Hello ${user.displayName}. I am the MCP Troubleshooter Bot. Ask me anything!`);
    });
  }
});

framework.on("log", (msg) => {
  // console.log(msg); // verbose logging
});

// --- Command Handling ---

// Catch-all handler for troubleshooting
framework.hears(/.*/, async (bot, trigger) => {
    // Ignore own messages
    if (trigger.personId === bot.person.id) return;
    
    console.log(`Received message from ${trigger.personEmail}: ${trigger.text}`);
    
    // Only process if MCP is connected
    if (!mcpClient.isReady) {
        bot.say("⚠️ MCP Server is not connected. Please try again later.");
        try {
            await mcpClient.connect(); // Try reconnecting
        } catch(e) { console.error("Reconnect failed", e); }
        return;
    }

    const roomId = bot.room.id;
    let botLogic = bots.get(roomId);
    
    // Create new BotLogic instance for this room if not exists
    if (!botLogic) {
        botLogic = new BotLogic(mcpClient, systemPrompt);
        bots.set(roomId, botLogic);
    }
    
    try {
        const response = await botLogic.processRequest(trigger.text);
        bot.say("markdown", response);
    } catch (e) {
        console.error("Error processing request:", e);
        bot.say(`❌ Error: ${e.message}`);
    }
});

// --- Express Server ---
app.get("/", (req, res) => {
  res.send(`I'm alive.`);
});

app.post("/", webhook(framework));

var server = app.listen(config.port, () => {
  framework.debug("framework listening on port %s", config.port);
});

process.on("SIGINT", () => {
  framework.debug("stopping...");
  server.close();
  framework.stop().then(() => {
    process.exit();
  });
});
