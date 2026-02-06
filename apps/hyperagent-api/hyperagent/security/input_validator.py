"""Input Validator - Layer 1 of 7-Layer Security Defense"""

import logging
import re
from typing import Optional, Tuple

from hyperagent.cache.redis_manager import RedisManager

logger = logging.getLogger(__name__)

MAX_PROMPT_LENGTH = 4000
RATE_LIMIT_REQUESTS_PER_MINUTE = 10
RATE_LIMIT_WINDOW_SECONDS = 60

JAILBREAK_PATTERNS = [
    r"ignore\s+(previous|all|all previous)\s+instructions?",
    r"forget\s+(previous|all|everything)",
    r"you\s+are\s+now\s+(a|an)\s+",
    r"pretend\s+you\s+are",
    r"act\s+as\s+if",
    r"system\s*:\s*",
    r"system\s+message",
    r"override\s+safety",
    r"disable\s+safety",
    r"bypass\s+security",
    r"ignore\s+safety",
    r"you\s+must\s+not",
    r"you\s+cannot",
    r"you\s+should\s+not",
    r"disregard",
    r"disobey",
]

INJECTION_PATTERNS = {
    "sql": [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
        r"(--|#|/\*|\*/)",
        r"(\b(UNION|OR|AND)\s+\d+\s*=\s*\d+)",
        r"('|(\\')|(;)|(\\;))",
    ],
    "xss": [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
        r"<img[^>]*onerror\s*=",
    ],
    "js": [
        r"eval\s*\(",
        r"Function\s*\(",
        r"setTimeout\s*\(",
        r"setInterval\s*\(",
        r"document\.(cookie|location)",
        r"window\.(location|open)",
    ],
}


class InputValidator:
    """Validates user input for security threats (Layer 1)"""

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize Input Validator

        Args:
            redis_manager: Optional Redis manager for rate limiting
        """
        self.redis_manager = redis_manager
        self._compiled_jailbreak_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in JAILBREAK_PATTERNS
        ]
        self._compiled_injection_patterns = {
            attack_type: [re.compile(p, re.IGNORECASE) for p in patterns]
            for attack_type, patterns in INJECTION_PATTERNS.items()
        }

    async def validate(self, prompt: str, user_id: str, ip_address: Optional[str] = None) -> Tuple[bool, str]:
        """
        Validate user input for security threats

        Args:
            prompt: User's input prompt
            user_id: User identifier
            ip_address: Optional IP address for rate limiting

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not prompt or not isinstance(prompt, str):
            return False, "Prompt must be a non-empty string"

        if len(prompt) > MAX_PROMPT_LENGTH:
            return False, f"Prompt exceeds maximum length of {MAX_PROMPT_LENGTH} characters"

        is_valid, error = await self._check_jailbreak(prompt)
        if not is_valid:
            logger.warning(f"Jailbreak detected for user {user_id}: {error}")
            return False, error

        is_valid, error = await self._check_injection(prompt)
        if not is_valid:
            logger.warning(f"Injection detected for user {user_id}: {error}")
            return False, error

        is_valid, error = await self._check_rate_limit(user_id, ip_address)
        if not is_valid:
            logger.warning(f"Rate limit exceeded for user {user_id}: {error}")
            return False, error

        return True, ""

    async def _check_jailbreak(self, prompt: str) -> Tuple[bool, str]:
        """Check for jailbreak patterns"""
        prompt_lower = prompt.lower()

        for pattern in self._compiled_jailbreak_patterns:
            if pattern.search(prompt_lower):
                return False, "Prompt contains potentially harmful instructions"

        if "ignore" in prompt_lower and "instruction" in prompt_lower:
            return False, "Prompt attempts to ignore instructions"

        return True, ""

    async def _check_injection(self, prompt: str) -> Tuple[bool, str]:
        """Check for injection patterns (SQL, XSS, JS)"""
        for attack_type, patterns in self._compiled_injection_patterns.items():
            for pattern in patterns:
                if pattern.search(prompt):
                    return False, f"Potential {attack_type.upper()} injection detected"

        return True, ""

    async def _check_rate_limit(self, user_id: str, ip_address: Optional[str] = None) -> Tuple[bool, str]:
        """Check rate limit per user/IP"""
        if not self.redis_manager:
            return True, ""

        identifiers = [f"user:{user_id}"]
        if ip_address:
            identifiers.append(f"ip:{ip_address}")

        for identifier in identifiers:
            key = f"ratelimit:{identifier}"
            current_count = await self.redis_manager.get(key)

            if current_count is None:
                current_count = 0
            else:
                try:
                    current_count = int(current_count)
                except (ValueError, TypeError):
                    current_count = 0

            if current_count >= RATE_LIMIT_REQUESTS_PER_MINUTE:
                return False, f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS_PER_MINUTE} requests per minute."

            await self.redis_manager.set(
                key, str(current_count + 1), ttl=RATE_LIMIT_WINDOW_SECONDS
            )

        return True, ""

    async def log_suspicious_activity(
        self, user_id: str, prompt: str, reason: str, ip_address: Optional[str] = None
    ):
        """Log suspicious activity for monitoring"""
        logger.warning(
            f"Suspicious activity detected - User: {user_id}, "
            f"IP: {ip_address}, Reason: {reason}, "
            f"Prompt preview: {prompt[:100]}"
        )

        if self.redis_manager:
            try:
                await self.redis_manager.set(
                    f"suspicious:{user_id}:{ip_address or 'unknown'}",
                    {
                        "user_id": user_id,
                        "ip_address": ip_address,
                        "reason": reason,
                        "prompt_preview": prompt[:200],
                    },
                    ttl=86400,
                )
            except Exception as e:
                logger.error(f"Failed to log suspicious activity: {e}")

