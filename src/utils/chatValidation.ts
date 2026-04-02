import { supabase } from '../lib/supabase';

interface BlockedPattern {
  id: string;
  pattern_type: 'regex' | 'keyword' | 'phrase';
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ViolationDetection {
  isViolation: boolean;
  violationType?: 'phone_number' | 'email' | 'social_media' | 'bypass_attempt' | 'external_contact';
  detectedPattern?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  warningMessage?: string;
}

let cachedPatterns: BlockedPattern[] | null = null;

export async function loadBlockedPatterns(): Promise<BlockedPattern[]> {
  if (cachedPatterns) {
    return cachedPatterns;
  }

  const { data, error } = await supabase
    .from('blocked_patterns')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('Error loading blocked patterns:', error);
    return [];
  }

  cachedPatterns = data || [];
  return cachedPatterns;
}

export async function detectViolations(message: string): Promise<ViolationDetection> {
  const patterns = await loadBlockedPatterns();

  for (const pattern of patterns) {
    let isMatch = false;

    if (pattern.pattern_type === 'regex') {
      try {
        const regex = new RegExp(pattern.pattern, 'i');
        isMatch = regex.test(message);
      } catch (e) {
        console.error('Invalid regex pattern:', pattern.pattern);
        continue;
      }
    } else if (pattern.pattern_type === 'keyword') {
      isMatch = message.toLowerCase().includes(pattern.pattern.toLowerCase());
    } else if (pattern.pattern_type === 'phrase') {
      isMatch = message.toLowerCase().includes(pattern.pattern.toLowerCase());
    }

    if (isMatch) {
      const violationType = determineViolationType(pattern);
      return {
        isViolation: true,
        violationType,
        detectedPattern: pattern.pattern,
        severity: pattern.severity,
        warningMessage: getWarningMessage(violationType, pattern.severity),
      };
    }
  }

  return { isViolation: false };
}

function determineViolationType(pattern: BlockedPattern): ViolationDetection['violationType'] {
  if (pattern.pattern.match(/phone|number|\d{10}/i)) {
    return 'phone_number';
  }
  if (pattern.pattern.match(/email|@/i)) {
    return 'email';
  }
  if (pattern.pattern.match(/whatsapp|telegram/i)) {
    return 'social_media';
  }
  if (pattern.pattern.match(/contact|reach|talk outside/i)) {
    return 'external_contact';
  }
  return 'bypass_attempt';
}

function getWarningMessage(
  type?: ViolationDetection['violationType'],
  severity?: 'low' | 'medium' | 'high' | 'critical'
): string {
  if (severity === 'critical') {
    return 'This message cannot be sent as it violates our platform policies. All communications and payments must go through our platform to ensure your safety and protection.';
  }

  switch (type) {
    case 'phone_number':
      return 'Please avoid sharing phone numbers. All communication should happen through our secure platform to protect both parties.';
    case 'email':
      return 'Please avoid sharing email addresses. All communication should happen through our secure platform to protect both parties.';
    case 'social_media':
      return 'Please keep all communication within our platform. This ensures protection for both parties and proper documentation.';
    case 'external_contact':
      return 'All communication and payments must go through our platform. This protects both parties and ensures proper documentation.';
    case 'bypass_attempt':
      return 'Please keep all communication and transactions within our platform for your protection.';
    default:
      return 'This message may violate our platform policies. Please keep all communication professional and within the platform.';
  }
}

export async function logViolation(
  conversationId: string,
  messageId: string | null,
  violatorId: string,
  violation: ViolationDetection,
  originalMessage: string
): Promise<void> {
  if (!violation.isViolation || !violation.violationType) return;

  try {
    await supabase.from('chat_violations').insert({
      conversation_id: conversationId,
      message_id: messageId,
      violator_id: violatorId,
      violation_type: violation.violationType,
      detected_pattern: violation.detectedPattern || '',
      original_message: originalMessage,
      severity: violation.severity || 'medium',
      action_taken: violation.severity === 'critical' ? 'message_blocked' : 'warning',
    });
  } catch (error) {
    console.error('Error logging violation:', error);
  }
}

export function sanitizeMessage(message: string): string {
  return message
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, '[EMAIL REDACTED]');
}
