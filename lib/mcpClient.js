const EventSource = require('eventsource');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class McpClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.eventSource = null;
        this.pendingRequests = new Map();
        this.isReady = false;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to MCP Server: ${this.serverUrl}`);
            this.eventSource = new EventSource(this.serverUrl);

            this.eventSource.onopen = () => {
                console.log('✨ MCP Session Connected via SSE');
                this.isReady = true;
                resolve();
            };

            this.eventSource.onerror = (err) => {
                console.error('❌ MCP Connection Error:', err);
                if (!this.isReady) reject(err);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.id && this.pendingRequests.has(message.id)) {
                        const { resolve, reject } = this.pendingRequests.get(message.id);
                        if (message.error) {
                            reject(message.error);
                        } else {
                            resolve(message.result);
                        }
                        this.pendingRequests.delete(message.id);
                    } else if (message.method) {
                        console.log("Received notification:", message.method);
                    }
                } catch (e) {
                    console.error("Error parsing SSE message:", e);
                }
            };
        });
    }

    async initialize() {
        console.log("🤝 Performing MCP Handshake...");
        const result = await this.call("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {
                roots: { listChanged: true },
                sampling: {}
            },
            clientInfo: {
                name: "webex-bot-starter",
                version: "1.0.0"
            }
        });
        console.log("✅ MCP Initialized. Server:", result.serverInfo.name);
        
        // Send initialized notification
        await this.notify("notifications/initialized");
        return result;
    }

    async notify(method, params = {}) {
        if (!this.isReady) throw new Error("MCP Client not connected");
        
        const request = {
            jsonrpc: "2.0",
            method: method,
            params: params
        };
        
        // Fire and forget for notifications, but we still send via POST
        await axios.post(this.serverUrl, request, {
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            }
        });
    }

    async call(method, params = {}) {
        if (!this.isReady) throw new Error("MCP Client not connected");

        const id = uuidv4();
        const request = {
            jsonrpc: "2.0",
            id: id,
            method: method,
            params: params
        };

        return new Promise(async (resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            
            try {
                // MCP over SSE: Send POST to the same URL
                const response = await axios.post(this.serverUrl, request, {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/event-stream'
                    },
                    responseType: 'text' // Get raw text to handle SSE or JSON
                });
                
                console.log(`POST response status: ${response.status}`);
                console.log(`POST response content-type: ${response.headers['content-type']}`);

                let responseData = response.data;
                // Try to parse as JSON if it looks like JSON
                if (typeof responseData === 'string' && (responseData.trim().startsWith('{') || responseData.trim().startsWith('['))) {
                     try { responseData = JSON.parse(responseData); } catch(e) {}
                }

                // Check for SSE in POST response
                if (typeof response.data === 'string' && response.data.includes('data: ')) {
                     console.log("Detected SSE in POST response, parsing...");
                     const lines = response.data.split('\n');
                     for (const line of lines) {
                         if (line.trim().startsWith('data: ')) {
                             const dataStr = line.trim().substring(6);
                             try {
                                 const msg = JSON.parse(dataStr);
                                 console.log("Parsed message from POST-SSE:", msg);
                                 if (msg.id && this.pendingRequests.has(msg.id)) {
                                     const { resolve, reject } = this.pendingRequests.get(msg.id);
                                     if (msg.error) reject(msg.error);
                                     else resolve(msg.result);
                                     this.pendingRequests.delete(msg.id);
                                     return; 
                                 }
                             } catch(e) { console.error("Failed to parse POST-SSE data", e); }
                         }
                     }
                }

                // Check for Direct JSON response
                if (responseData && (responseData.result || responseData.error || responseData.id === id)) {
                   console.log("Received direct HTTP response:", JSON.stringify(responseData).substring(0, 100));
                   if (this.pendingRequests.has(id)) {
                        const { resolve, reject } = this.pendingRequests.get(id);
                        if (responseData.error) {
                            reject(responseData.error);
                        } else {
                            resolve(responseData.result);
                        }
                        this.pendingRequests.delete(id);
                   }
                } else {
                    console.log("POST sent (not direct response), waiting for SSE response...");
                }
            } catch (e) {
                this.pendingRequests.delete(id);
                reject(e);
            }
        });
    }

    async listTools() {
        const response = await this.call("tools/list");
        return response.tools;
    }

    async callTool(name, args) {
        try {
            const response = await this.call("tools/call", {
                name: name,
                arguments: args
            });
            return response;
        } catch (e) {
            throw e;
        }
    }
}

module.exports = McpClient;
