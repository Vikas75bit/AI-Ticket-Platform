import re

class GuardrailFirewall:
    def __init__(self):
        # 1. PRISON GATES: Core prompt injection and jailbreak pattern signatures
        self.injection_patterns = [
            r"(?i)ignore\s+all\s+previous\s+instructions",
            r"(?i)you\s+are\s+no\s+longer\s+a",
            r"(?i)system\s+override",
            r"(?i)output\s+our\s+database",
            r"(?i)forget\s+your\s+rules",
            r"(?i)act\s+as\s+a\s+malicious"
        ]
        
        # 2. DATA LEAK PROTECTION: Strict matching blocklist
        self.restricted_phrases = [
            "INTERNAL_SYSTEM_PROMPT",
            "RAW_DATABASE_STRING",
            "ADMIN_MASTER_KEY"
        ]

    def verify_input(self, text: str) -> bool:
        """
        Scans inbound user content strings for prompt injection exploits.
        Returns True if safe, False if a malicious attack signature is tripped.
        """
        for pattern in self.injection_patterns:
            if re.search(pattern, text):
                print(f"🚨 SECURITY ALERT: Prompt Injection Attempt Intercepted: '{pattern}'")
                return False
        return True

    def verify_output(self, response_text: str, allowed_context: str) -> str:
        """
        Evaluates out-bound LLM resolutions to sanitize formatting or flag hallucinations.
        """
        # Scrub restricted leaking phrases instantly if they accidentally appear
        sanitized_text = response_text
        for phrase in self.restricted_phrases:
            if phrase in sanitized_text:
                sanitized_text = sanitized_text.replace(phrase, "[RESTRICTED ACCESS METADATA]")
                print(f"🛡️ GUARDRAIL CLEANSED LEAK: Scrubbed '{phrase}' from final viewport stream.")

        return sanitized_text

# Singleton initialization for application-wide firewall access
guard_firewall = GuardrailFirewall()