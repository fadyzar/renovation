export interface ValidationResult {
  isValid: boolean;
  violations: ContactViolation[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContactViolation {
  type: 'phone' | 'email' | 'url' | 'social' | 'suspicious';
  matched: string;
  pattern: string;
}

const PHONE_PATTERNS = [
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,4}/g,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{10,}\b/g,
  /(?:zero|one|two|three|four|five|six|seven|eight|nine)[\s-]*(?:zero|one|two|three|four|five|six|seven|eight|nine)[\s-]*(?:zero|one|two|three|four|five|six|seven|eight|nine)/gi,
  /\b0\s?5\s?[0-9]\s?[0-9-.\s]{6,}\b/g,
  /\b\+?[0-9]{1,4}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{2,4}\b/g,
];

const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g,
  /[a-zA-Z0-9._%+-]+\s*\[\s*at\s*\]\s*[a-zA-Z0-9.-]+\s*\[\s*dot\s*\]\s*[a-zA-Z]{2,}/gi,
  /[a-zA-Z0-9._%+-]+\s+at\s+[a-zA-Z0-9.-]+\s+dot\s+[a-zA-Z]{2,}/gi,
];

const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /\b[a-zA-Z0-9-]+\.(com|net|org|io|co|info|biz|me|app|dev)\b/gi,
];

const SOCIAL_PATTERNS = [
  /whatsapp/gi,
  /telegram/gi,
  /\bwa\b/gi,
  /instagram/gi,
  /\binsta\b/gi,
  /facebook/gi,
  /\bfb\b/gi,
  /linkedin/gi,
  /twitter/gi,
  /snapchat/gi,
  /tiktok/gi,
  /discord/gi,
  /skype/gi,
  /viber/gi,
  /wechat/gi,
];

const SUSPICIOUS_PATTERNS = [
  /message\s+me\s+(?:on|at|through|via)/gi,
  /text\s+me\s+(?:on|at|outside|privately)/gi,
  /call\s+me\s+(?:on|at|outside)/gi,
  /reach\s+(?:me|out)\s+(?:on|at|outside|via)/gi,
  /contact\s+me\s+(?:on|at|outside|privately|directly)/gi,
  /find\s+me\s+on/gi,
  /search\s+(?:me|my\s+name)\s+on/gi,
  /add\s+me\s+on/gi,
  /dm\s+me/gi,
  /send\s+(?:me|details)\s+(?:outside|privately|directly)/gi,
  /share\s+(?:contact|details)\s+(?:outside|later|privately)/gi,
  /off\s+platform/gi,
  /outside\s+(?:the\s+)?(?:platform|app|site)/gi,
  /bypass/gi,
];

const NUMBER_WORD_MAP: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  Object.entries(NUMBER_WORD_MAP).forEach(([word, digit]) => {
    normalized = normalized.replace(new RegExp(word, 'g'), digit);
  });

  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/[.\-()]/g, '');

  return normalized;
}

function detectPhoneNumbers(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];
  const normalized = normalizeText(text);

  if (/\d{8,}/.test(normalized)) {
    violations.push({
      type: 'phone',
      matched: 'obfuscated phone number detected',
      pattern: 'normalized_digits',
    });
  }

  PHONE_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.replace(/\D/g, '').length >= 8) {
          violations.push({
            type: 'phone',
            matched: match,
            pattern: `phone_pattern_${index}`,
          });
        }
      });
    }
  });

  return violations;
}

function detectEmails(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];

  EMAIL_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        violations.push({
          type: 'email',
          matched: match,
          pattern: `email_pattern_${index}`,
        });
      });
    }
  });

  return violations;
}

function detectUrls(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];

  URL_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        violations.push({
          type: 'url',
          matched: match,
          pattern: `url_pattern_${index}`,
        });
      });
    }
  });

  return violations;
}

function detectSocialMedia(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];

  SOCIAL_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        violations.push({
          type: 'social',
          matched: match,
          pattern: `social_pattern_${index}`,
        });
      });
    }
  });

  return violations;
}

function detectSuspiciousIntent(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];

  SUSPICIOUS_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        violations.push({
          type: 'suspicious',
          matched: match,
          pattern: `suspicious_pattern_${index}`,
        });
      });
    }
  });

  return violations;
}

function calculateSeverity(violations: ContactViolation[]): 'low' | 'medium' | 'high' | 'critical' {
  if (violations.length === 0) return 'low';

  const hasPhone = violations.some(v => v.type === 'phone');
  const hasEmail = violations.some(v => v.type === 'email');
  const hasUrl = violations.some(v => v.type === 'url');
  const hasSocial = violations.some(v => v.type === 'social');
  const hasSuspicious = violations.some(v => v.type === 'suspicious');

  if (hasPhone || hasEmail) return 'critical';
  if (hasUrl || hasSocial) return 'high';
  if (hasSuspicious) return 'medium';

  return 'low';
}

export function validateMessage(message: string): ValidationResult {
  const violations: ContactViolation[] = [
    ...detectPhoneNumbers(message),
    ...detectEmails(message),
    ...detectUrls(message),
    ...detectSocialMedia(message),
    ...detectSuspiciousIntent(message),
  ];

  const uniqueViolations = Array.from(
    new Map(violations.map(v => [`${v.type}:${v.matched}`, v])).values()
  );

  return {
    isValid: uniqueViolations.length === 0,
    violations: uniqueViolations,
    severity: calculateSeverity(uniqueViolations),
  };
}

export function getViolationMessage(result: ValidationResult): string {
  if (result.isValid) return '';

  const { violations, severity } = result;

  if (severity === 'critical') {
    return '🚫 Contact details detected. Phone numbers and email addresses can only be shared after the security deposit is paid.';
  }

  if (severity === 'high') {
    return '⚠️ External links and social media references are not allowed before the deposit is paid.';
  }

  if (severity === 'medium') {
    return '⚠️ This message appears to be requesting off-platform communication. Please use the chat after the deposit is paid.';
  }

  return '⚠️ Please keep communication on the platform until the deposit is paid.';
}
