import axios from 'axios';
import { AIProvider, AIAnalysisRequest, AIProviderResponse } from './aiSecurityBrain.types';
import { AIOutputSchema } from './aiSecurityBrain.schema';
import { logger } from '../../utils/logger';

export class OllamaProvider implements AIProvider {
    private baseUrl: string;
    private model: string;
    private timeoutMs: number;

    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama3'; // Default to something standard
        this.timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '5000', 10);
    }

    async analyze(request: AIAnalysisRequest): Promise<AIProviderResponse> {
        const prompt = `${request.systemPrompt}\n\n<SECURITY_EVIDENCE>\n${request.evidenceJson}\n</SECURITY_EVIDENCE>\n\nTASK:\n${request.taskPrompt}`;

        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                format: 'json'
            }, {
                timeout: this.timeoutMs,
                maxContentLength: 1048576 // 1MB limit
            });

            if (!response.data || !response.data.response) {
                throw new Error("Invalid response from Ollama");
            }

            const rawResponse = response.data.response;
            
            // Try to parse the JSON
            let parsedJson: any;
            try {
                parsedJson = JSON.parse(rawResponse);
            } catch (e) {
                throw new Error("AI_INVALID_RESPONSE");
            }

            // Validate against strict schema
            const validationResult = AIOutputSchema.safeParse(parsedJson);
            if (!validationResult.success) {
                logger.warn(`[OllamaProvider] Schema validation failed: ${JSON.stringify(validationResult.error)}`);
                throw new Error("AI_SCHEMA_VALIDATION_FAILED");
            }

            return validationResult.data;

        } catch (error: any) {
            if (error.message === "AI_INVALID_RESPONSE" || error.message === "AI_SCHEMA_VALIDATION_FAILED") {
                throw error;
            }
            if (error.code === 'ECONNABORTED') {
                throw new Error("AI_TIMEOUT");
            }
            logger.error(`[OllamaProvider] Request failed: ${error.message}`);
            throw new Error("AI_UNAVAILABLE");
        }
    }
}
