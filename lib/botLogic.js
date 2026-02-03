const OpenAI = require('openai');

class BotLogic {
    constructor(mcpClient, systemPrompt) {
        this.mcpClient = mcpClient;
        this.systemPrompt = systemPrompt;
        this.history = []; 
        
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
                        
                        console.log(`TOOL OUTPUT (First 200 chars): ${toolOutput.substring(0, 200)}...`);

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
