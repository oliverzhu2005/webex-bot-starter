const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class BotLogic {
    constructor(mcpClient, systemPrompt) {
        this.mcpClient = mcpClient;
        this.systemPrompt = systemPrompt;
        this.history = []; 
        
        // Setup Logging
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        this.logFile = path.join(logDir, 'bot_activity.log');
        
        const baseURL = process.env.LLM_BASE_URL ? 
            (process.env.LLM_BASE_URL.endsWith('/openai/v1') ? process.env.LLM_BASE_URL : `${process.env.LLM_BASE_URL}/openai/v1`) 
            : undefined;
            
        this.openai = new OpenAI({
            apiKey: process.env.CI_TOKEN || process.env.OPENAI_API_KEY,
            baseURL: baseURL,
            defaultHeaders: {
                "x-cisco-app": process.env.CISCO_APP_NAME || "mcp-bot"
            }
        });
        
        this.model = process.env.LLM_MODEL || "gpt-4";
        this.history.push({ role: "system", content: this.systemPrompt });
    }

    logToFile(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(this.logFile, logEntry);
    }

    async processRequest(userInput) {
        this.history.push({ role: "user", content: userInput });

        const tools = await this.mcpClient.listTools();
        const openaiTools = tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema
            }
        }));

        let finalResponse = "";
        
        // Loop for tool usage
        while (true) {
            console.log("🤖 Bot is thinking...");

            // DEBUG: Log payload sent to LLM
            const logMsg = [
                "--- REQUEST TO LLM ---",
                `Model: ${this.model}`,
                `Messages Count: ${this.history.length}`,
                `Tools Metadata (First 3): ${JSON.stringify(openaiTools.slice(0, 3), null, 2)}`,
                `Latest Message: ${JSON.stringify(this.history[this.history.length - 1], null, 2)}`,
                "----------------------"
            ].join('\n');

            console.log(logMsg);
            this.logToFile(logMsg);

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.history,
                tools: openaiTools,
                tool_choice: "auto"
            });

            const message = response.choices[0].message;
            this.history.push(message);

            if (message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    const functionName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`🛠️ Calling tool: ${functionName}`);

                    try {
                        const mcpResult = await this.mcpClient.callTool(functionName, args);
                        // Extract text content from MCP result
                        const toolOutput = mcpResult.content
                            .filter(c => c.type === 'text')
                            .map(c => c.text)
                            .join("");
                        
                        const outputLog = `TOOL OUTPUT (First 200 chars): ${toolOutput.substring(0, 200)}...`;
                        console.log(outputLog);
                        this.logToFile(outputLog);

                        this.history.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolOutput
                        });
                    } catch (e) {
                         this.history.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: `Error: ${e.message}`
                        });
                    }
                }
            } else {
                finalResponse = message.content;
                break;
            }
        }
        
        return finalResponse;
    }
}

module.exports = BotLogic;
