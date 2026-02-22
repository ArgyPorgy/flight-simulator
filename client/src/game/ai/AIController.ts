/**
 * AI Controller for intelligent aircraft behavior
 * Can use LLM (like GPT) for decision making or fall back to rule-based AI
 */

import * as THREE from 'three';

export interface AIDecision {
  targetHeading: number;
  targetAltitude: number;
  targetSpeed: number;
  action: 'cruise' | 'climb' | 'descend' | 'turn' | 'avoid' | 'follow' | 'patrol';
  reasoning?: string;
}

export interface FlightContext {
  position: THREE.Vector3;
  altitude: number;
  speed: number;
  heading: number;
  nearbyTraffic: Array<{
    callsign: string;
    distance: number;
    bearing: number;
    altitude: number;
  }>;
  playerPosition: THREE.Vector3;
  playerAltitude: number;
}

type AIMode = 'llm' | 'rule-based';

export class AIController {
  private mode: AIMode = 'rule-based';
  private apiEndpoint: string | null = null;
  private apiKey: string | null = null;
  private decisionCache: Map<string, { decision: AIDecision; timestamp: number }> = new Map();
  private cacheDuration = 5000; // 5 seconds cache

  constructor() {
    // Check if LLM API is configured
    this.checkLLMConfig();
  }

  private checkLLMConfig(): void {
    // Check for environment variables or localStorage config
    const savedConfig = typeof localStorage !== 'undefined' 
      ? localStorage.getItem('ai_config') 
      : null;
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.apiEndpoint && config.apiKey) {
          this.apiEndpoint = config.apiEndpoint;
          this.apiKey = config.apiKey;
          this.mode = 'llm';
          console.log('AI Controller: LLM mode enabled');
        }
      } catch (e) {
        console.warn('AI Controller: Invalid config, using rule-based mode');
      }
    }
  }

  /**
   * Configure LLM API (can be called from settings)
   */
  public configureLLM(apiEndpoint: string, apiKey: string): void {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
    this.mode = 'llm';
    
    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ai_config', JSON.stringify({ apiEndpoint, apiKey }));
    }
  }

  /**
   * Get AI decision for an aircraft
   */
  public async getDecision(callsign: string, context: FlightContext): Promise<AIDecision> {
    // Check cache first
    const cached = this.decisionCache.get(callsign);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.decision;
    }

    let decision: AIDecision;

    if (this.mode === 'llm' && this.apiEndpoint && this.apiKey) {
      try {
        decision = await this.getLLMDecision(callsign, context);
      } catch (e) {
        console.warn(`AI Controller: LLM failed for ${callsign}, using rule-based`);
        decision = this.getRuleBasedDecision(callsign, context);
      }
    } else {
      decision = this.getRuleBasedDecision(callsign, context);
    }

    // Cache the decision
    this.decisionCache.set(callsign, { decision, timestamp: Date.now() });

    return decision;
  }

  /**
   * Get decision from LLM API
   */
  private async getLLMDecision(callsign: string, context: FlightContext): Promise<AIDecision> {
    const prompt = this.buildPrompt(callsign, context);

    const response = await fetch(this.apiEndpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an AI pilot controlling aircraft ${callsign} in a flight simulator. 
Make realistic flight decisions based on the current situation. 
Respond ONLY with valid JSON in this exact format:
{
  "targetHeading": <number 0-360>,
  "targetAltitude": <number in feet>,
  "targetSpeed": <number in knots>,
  "action": "<cruise|climb|descend|turn|avoid|follow|patrol>",
  "reasoning": "<brief explanation>"
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    const decision = JSON.parse(content);
    return {
      targetHeading: decision.targetHeading || context.heading,
      targetAltitude: decision.targetAltitude || context.altitude,
      targetSpeed: decision.targetSpeed || context.speed,
      action: decision.action || 'cruise',
      reasoning: decision.reasoning,
    };
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(callsign: string, context: FlightContext): string {
    const nearbyStr = context.nearbyTraffic.length > 0
      ? context.nearbyTraffic.map(t => 
          `- ${t.callsign}: ${t.distance.toFixed(0)}m away, bearing ${t.bearing.toFixed(0)}°, alt ${t.altitude.toFixed(0)}ft`
        ).join('\n')
      : 'None';

    return `
Current situation for ${callsign}:
- Position: (${context.position.x.toFixed(0)}, ${context.position.z.toFixed(0)})
- Altitude: ${context.altitude.toFixed(0)} feet
- Speed: ${context.speed.toFixed(0)} knots
- Heading: ${context.heading.toFixed(0)}°

Player aircraft:
- Distance: ${context.position.distanceTo(context.playerPosition).toFixed(0)}m
- Altitude: ${context.playerAltitude.toFixed(0)} feet

Nearby traffic:
${nearbyStr}

What should ${callsign} do? Consider:
1. Maintain safe separation from other aircraft (min 500m horizontal, 300ft vertical)
2. Fly interesting patterns near the player
3. Avoid collisions
4. Maintain realistic flight behavior

Respond with your decision as JSON.`;
  }

  /**
   * Rule-based AI decision (fallback)
   */
  private getRuleBasedDecision(callsign: string, context: FlightContext): AIDecision {
    const distanceToPlayer = context.position.distanceTo(context.playerPosition);
    
    // Default: patrol around the area
    let action: AIDecision['action'] = 'patrol';
    let targetHeading = context.heading;
    let targetAltitude = context.altitude;
    let targetSpeed = context.speed;
    let reasoning = 'Continuing patrol pattern';

    // Check for collision avoidance with nearby traffic
    for (const traffic of context.nearbyTraffic) {
      if (traffic.distance < 500) {
        // Too close! Avoid
        action = 'avoid';
        targetHeading = (context.heading + 90) % 360; // Turn right
        targetAltitude = context.altitude + 500; // Climb
        reasoning = `Avoiding ${traffic.callsign} - too close`;
        break;
      }
    }

    // Check distance to player
    if (distanceToPlayer < 300) {
      // Too close to player, move away
      action = 'avoid';
      const dx = context.position.x - context.playerPosition.x;
      const dz = context.position.z - context.playerPosition.z;
      targetHeading = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
      targetAltitude = context.altitude + 300;
      reasoning = 'Avoiding player aircraft';
    } else if (distanceToPlayer > 5000) {
      // Too far from player, come closer
      action = 'follow';
      const dx = context.playerPosition.x - context.position.x;
      const dz = context.playerPosition.z - context.position.z;
      targetHeading = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
      reasoning = 'Moving closer to player area';
    } else if (distanceToPlayer > 2000 && distanceToPlayer < 4000) {
      // Good distance - do interesting maneuvers
      const maneuver = Math.floor(Date.now() / 10000) % 4;
      switch (maneuver) {
        case 0:
          action = 'turn';
          targetHeading = (context.heading + 30) % 360;
          reasoning = 'Performing banking turn';
          break;
        case 1:
          action = 'climb';
          targetAltitude = Math.min(context.altitude + 500, 3000);
          reasoning = 'Climbing to higher altitude';
          break;
        case 2:
          action = 'descend';
          targetAltitude = Math.max(context.altitude - 300, 500);
          reasoning = 'Descending';
          break;
        default:
          action = 'cruise';
          reasoning = 'Maintaining cruise';
      }
    }

    // Altitude bounds
    targetAltitude = Math.max(300, Math.min(targetAltitude, 4000));
    
    // Speed bounds
    targetSpeed = Math.max(100, Math.min(targetSpeed, 250));

    return {
      targetHeading,
      targetAltitude,
      targetSpeed,
      action,
      reasoning,
    };
  }

  /**
   * Get current mode
   */
  public getMode(): AIMode {
    return this.mode;
  }

  /**
   * Check if LLM is configured
   */
  public isLLMConfigured(): boolean {
    return this.mode === 'llm' && !!this.apiEndpoint && !!this.apiKey;
  }
}

// Singleton instance
export const aiController = new AIController();
