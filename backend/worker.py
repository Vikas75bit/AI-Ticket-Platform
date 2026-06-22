import os
from dotenv import load_dotenv

load_dotenv()


import json
import os
from groq import Groq
import chromadb
from database import SessionLocal
import models
from embeddings_service import encoder
from gaurd_service import guard_firewall
from logger_service import sys_logger

# Initialize our AI clients inside the isolated worker environment
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Step 5 Schemas duplicated for worker validation
tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "lookup_refund_eligibility",
            "description": "Use this tool when a customer explicitly requests a refund or money back for a purchase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {"type": "string", "description": "The email address of the customer making the request."}
                },
                "required": ["user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_account_audit",
            "description": "Use this tool ONLY when a customer reports server crashes, database errors, timeouts, or potential security vulnerabilities.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {"type": "string", "description": "The customer email address."},
                    "issue_description": {"type": "string", "description": "A brief technical summary of the system failure or crash."}
                },
                "required": ["user_email", "issue_description"]
            }
        }
    }
]

def lookup_refund_eligibility(user_email: str) -> str:
    if "btech" in user_email.lower() or "vikas" in user_email.lower():
        return "DENIED: System logs verify that B.Tech training keys have already been activated for this account."
    return "APPROVED: Account within the standard 14-day window. No keys activated."

def trigger_account_audit(user_email: str, issue_description: str) -> str:
    return f"SUCCESS: Technical incident token generated for {user_email}. Issue registered: '{issue_description}'."


def broadcast_pipeline_update(
    ticket_id: int,
    status: str,
    action: str
):
    print(
        f"Ticket {ticket_id} | {status} | {action}"
    )

# ─── TASK 1: THE SEMANTIC KNOWLEDGE MATCHER ────────────────────────────────
def step_1_match_knowledge(ticket_id: int) -> dict:
    """
    Task 1: Pulls the raw ticket body, computes the live Groq Nomic embedding,
    and runs the cosine-distance similarity match against the knowledge base.
    """
    db = SessionLocal()
    try:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        if not ticket:
            return {"ticket_id": ticket_id, "context": "Ticket missing."}
        
        # Compute real coordinates on the fly using our Groq service
        query_vector = encoder.get_vector(ticket.summary or ticket.description or ticket.subject or "")
        
        # Run our custom Supabase RPC vector matcher function
        from sqlalchemy import text
        match = db.execute(
            text("SELECT * FROM match_knowledge(:embedding, :threshold, :limit)"),
            {"embedding": str(query_vector), "threshold": 0.3, "limit": 1}
        ).fetchone()
        
        matched_context = match.content if match else "No matching company policy rules found."
        
        # Update progress tracking metadata on the ticket
        ticket.workflow_stage = "Knowledge Matched"
        ticket.action_taken = f"[System Step 1 Complete] Context extracted."
        db.commit()
        
        # 🔥 BROADCAST IMMEDIATELY DOWN THE STREAM
        broadcast_pipeline_update(ticket_id, "Knowledge Matched", ticket.action_taken)
        
        # Replace old loose prints with structural tracing logs
        sys_logger.info(
            f"Celery Step 1 Complete: Vector match processed cleanly for Ticket #{ticket_id}",
            extra={"extra_context": {
                "ticket_id": ticket_id,
                "workflow_step": "knowledge_match",
                "status": "Success"
            }}
        )
        return {"ticket_id": ticket_id, "context": matched_context}
    finally:
        db.close()

# ─── TASK 2: THE CONTEXT-INJECTED LLM GENERATOR ────────────────────────────
def step_2_generate_resolution(prev_step_data: dict) -> dict:
    """
    Task 2: Receives the matched policy context, injects it into Llama 3.3, 
    runs the output through the guardrail firewall, and writes the secure response.
    """
    ticket_id = prev_step_data["ticket_id"]
    context = prev_step_data["context"]
    
    db = SessionLocal()
    try:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"""
You are an enterprise support triage AI.

Company Context:
{context}

Analyze the ticket and return:

Department:
Priority:
Summary:
Action:
"""
                },
                {
                    "role": "user",
                    "content": f"""
Subject: {ticket.subject}

Description:
{ticket.description}
"""
                }
            ]
        )

        raw_llm_output = response.choices[0].message.content
        
        # Run our Day 18 output firewall guardrail check to prevent data leaks or bad styling
        validated_resolution = guard_firewall.verify_output(raw_llm_output, context)
        
        # Extract fields from the validated LLM output
        import re

        def extract_field(field_name: str) -> str:
            pattern = rf"(?:^|\n)\s*\*?\*?{field_name}\*?\*?:\s*(.*?)(?=\n\s*\*?\*?(?:Department|Priority|Summary|Action):|$)"
            match = re.search(pattern, validated_resolution, re.DOTALL | re.IGNORECASE)
            return match.group(1).strip() if match else ""

        extracted_department = extract_field("Department") or ticket.department or "General"
        extracted_priority = extract_field("Priority") or ticket.urgency or "Medium"
        extracted_summary = extract_field("Summary") or ticket.summary or ""
        extracted_action = extract_field("Action") or validated_resolution

        ticket.department = extracted_department
        ticket.urgency = extracted_priority
        ticket.workflow_stage = "LLM Drafting Complete"
        ticket.summary = extracted_summary
        ticket.action_taken = extracted_action
        db.commit()
        
        # 🔥 BROADCAST IMMEDIATELY DOWN THE STREAM
        broadcast_pipeline_update(ticket_id, "LLM Drafting Complete", ticket.action_taken)
        return {"ticket_id": ticket_id, "resolution": validated_resolution}
    finally:
        db.close()

# ─── TASK 3: THE ADMIN NOTIFICATION AUDITOR ──────────────────────────────────
def step_3_notify_admin(prev_step_data: dict) -> str:
    """
    Task 3: Takes the finalized secure response, simulates a live notification ping 
    to the admin system console logs, and marks the workflow pipeline as 100% complete.
    """
    ticket_id = prev_step_data["ticket_id"]
    
    db = SessionLocal()
    try:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        
        # Upgrade your terminal log triggers to strict production compliance
        sys_logger.warning(
            f"Celery Pipeline Sealed: Final notification broadcast completed for Ticket #{ticket_id}",
            extra={"extra_context": {
                "ticket_id": ticket_id,
                "workflow_step": "admin_notified",
                "pipeline_state": "CLOSED"
            }}
        )
        
        ticket.workflow_stage = "Admin Notified"
        db.commit()
        
        # 🔥 BROADCAST THE FINAL COMPLETION FLAG
        broadcast_pipeline_update(ticket_id, "Admin Notified", ticket.action_taken or "")
        return f"Pipeline execution for Ticket #{ticket_id} verified and sealed cleanly."
    finally:
        db.close()
