import { BehavioralMetrics } from './types';

// Heuristics Constants
const BOT_TYPING_THRESHOLD_MS = 50; // Bots type faster than 50ms between keys
const BOT_MOUSE_EFFICIENCY_THRESHOLD = 0.95; // Perfect straight lines are suspicious
const HUMAN_MIN_INTERACTION_TIME_MS = 1000; // Humans take at least 1s to fill a form

export interface BehavioralAnalysisResult {
    isBot: boolean;
    reasons: string[];
}

export function analyzeBehavior(metrics: BehavioralMetrics): BehavioralAnalysisResult {
    const reasons: string[] = [];
    let score = 100;

    // 1. Interaction Time Check
    // If the entire form was filled in < 1 second, it's likely a script
    if (metrics.interactionTime * 1000 < HUMAN_MIN_INTERACTION_TIME_MS) {
        score -= 50;
        reasons.push('Super-human interaction speed detected');
    }

    // 2. Mouse Path Efficiency Check
    // Efficiency = Distance / PathLength. 1.0 means a perfect straight line.
    // Humans rarely move in perfect straight lines.
    if (metrics.mousePathEfficiency > BOT_MOUSE_EFFICIENCY_THRESHOLD) {
        score -= 30;
        reasons.push('Robotic mouse movement detected');
    }

    // 3. Typing Variance Check (Placeholder for real variance calc)
    // If variance is 0 (all keystrokes exact same duration), it's a bot
    if (metrics.typingVariance === 0) {
        score -= 40;
        reasons.push('Zero typing variance (scripted input)');
    }

    // 4. Typing Speed Check (if raw keystrokes available)
    if (metrics.keystrokes && metrics.keystrokes.length > 0) {
        const avgFlight = metrics.keystrokes.reduce((sum, k) => sum + k.flight, 0) / metrics.keystrokes.length;
        if (avgFlight < BOT_TYPING_THRESHOLD_MS) {
            score -= 30;
            reasons.push('Typing speed exceeds human capability');
        }
    }

    // Decision
    const isBot = score < 50;

    return { isBot, reasons };
}
