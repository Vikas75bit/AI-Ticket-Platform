# services/ai_agent.py

import os
import json
from groq import Groq

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = "llama-3.1-8b-instant"


def analyze_ticket(ticket_text: str, context: str = ""):

    prompt = f"""
You are an enterprise support ticket triage AI.

Analyze the ticket and return ONLY valid JSON.

Ticket:
{ticket_text}

Relevant Company Context:
{context}

Return:

{{
    "department": "",
    "urgency": "",
    "sentiment": "",
    "summary": "",
    "recommended_action": ""
}}

Rules:

department must be one of:
Billing
Support
Technical
Training
General

urgency must be one of:
Low
Medium
High

sentiment must be one of:
Neutral
Frustrated
Angry
Confused
Happy

Return ONLY JSON.
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content

    return json.loads(content)

def generate_reply(
    ticket_text: str,
    context: str = ""
):

    prompt = f"""
You are a professional customer support agent.

Customer Issue:
{ticket_text}

Relevant Company Context:
{context}

Write a professional support response.

Do not invent policies.
Keep the tone polite and concise.
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3
    )

    return response.choices[0].message.content