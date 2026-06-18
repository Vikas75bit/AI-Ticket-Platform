import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# We point Celery to our local high-speed Redis Docker container listening on port 6379
celery_app = Celery(
    "tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

# Configuration overrides for production safety
celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    worker_max_tasks_per_child=100  # Automatically cycle workers to protect memory leaks
)


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


@celery_app.task(name="tasks.process_ticket_async", bind=True, max_retries=3)
def process_ticket_async(self, ticket_data: dict):
    """
    This function runs COMPLETELY in the background. 
    It processes the AI logic and saves the record straight to Supabase.
    """
    db = SessionLocal()
    try:
        sender = ticket_data["sender"]
        subject = ticket_data["subject"]
        message = ticket_data["message"]
        
        incoming_query = f"Subject: {subject}. Message: {message}"
        
        # Connect to the local ChromaDB Client inside the background process
        chroma_client = chromadb.Client()
        collection = chroma_client.get_or_create_collection(name="ticket_knowledge")
        results = collection.query(query_texts=[incoming_query], n_results=1)
        retrieved_context = results['documents'][0][0] if results['documents'] else "No specific policy found."

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an advanced enterprise AI Agent with access to tool-calling functions.\n"
                    "You MUST use the internal company context provided below to dictate your tool calling logic.\n"
                    "When calling a function/tool, you MUST strictly output the parameters in proper JSON format matching the schema rules provided.\n"
                    "Do not invent functions outside the provided tools_schema list.\n\n"
                    f"INTERNAL COMPANY CONTEXT:\n{retrieved_context}"
                )
            },
            {"role": "user", "content": incoming_query}
        ]

        # Call the active production Groq model
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools_schema,
            tool_choice="auto"
        )
        
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        summary_text = "General inquiry handled without automation tools."
        urgency_level = "Low"
        dept = "Sales"
        sentiment_val = "Neutral"
        action_text = "No automated action required."

        if tool_calls:
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                if function_name == "lookup_refund_eligibility":
                    action_text = lookup_refund_eligibility(user_email=sender)
                    summary_text = "Automated refund check executed."
                    urgency_level = "Medium"
                    dept = "Billing"
                    sentiment_val = "Anxious"
                    
                elif function_name == "trigger_account_audit":
                    action_text = trigger_account_audit(
                        user_email=sender, 
                        issue_description=function_args.get("issue_description", subject)
                    )
                    summary_text = "System audit triggered for critical technical failure."
                    urgency_level = "High"
                    dept = "Technical Support"
                    sentiment_val = "Stressed"

        # DATABASE WRITE: Create a new database record row using our SQLAlchemy models
        db_ticket = models.Ticket(
            sender=sender,
            subject=subject,
            summary=summary_text,
            urgency=urgency_level,
            department=dept,
            sentiment=sentiment_val,
            action_taken=action_text
        )
        db.add(db_ticket)
        db.commit() # Save straight to Supabase cloud!
        
        return {"status": "Completed", "ticket_subject": subject, "urgency": urgency_level}

    except Exception as exc:
        db.rollback()
        # If the external AI API hits a rate limit, Celery will automatically back off and try again later!
        raise self.retry(exc=exc, countdown=10)
    finally:
        db.close()


import redis

# Connect to your existing Redis service instance
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def broadcast_pipeline_update(ticket_id: int, status: str, action: str):
    """
    Helper function to publish task status payloads directly into the Redis channel.
    """
    payload = {
        "ticket_id": ticket_id,
        "status": status,
        "action_taken": action
    }
    try:
        redis_client.publish("ticket_updates", json.dumps(payload))
    except Exception as e:
        print(f"Error broadcasting pipeline update: {e}")

# ─── TASK 1: THE SEMANTIC KNOWLEDGE MATCHER ────────────────────────────────
@celery_app.task
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
        ticket.urgency = "Knowledge Matched"
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
@celery_app.task
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
        
        # Simulate our high-speed Groq Llama 3.3 contextual text generation string
        # In your active environment, this hooks straight into your Groq chat.completions client
        raw_llm_output = f"Automated Resolution: Evaluated client claims using custom asset parameter background rules. Action Matrix Rule applied: {context}"
        
        # Run our Day 18 output firewall guardrail check to prevent data leaks or bad styling
        validated_resolution = guard_firewall.verify_output(raw_llm_output, context)
        
        ticket.urgency = "LLM Drafting Complete"
        ticket.action_taken = validated_resolution
        db.commit()
        
        # 🔥 BROADCAST IMMEDIATELY DOWN THE STREAM
        broadcast_pipeline_update(ticket_id, "LLM Drafting Complete", validated_resolution)
        return {"ticket_id": ticket_id, "resolution": validated_resolution}
    finally:
        db.close()

# ─── TASK 3: THE ADMIN NOTIFICATION AUDITOR ──────────────────────────────────
@celery_app.task
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
        
        ticket.urgency = "Admin Notified"
        db.commit()
        
        # 🔥 BROADCAST THE FINAL COMPLETION FLAG
        broadcast_pipeline_update(ticket_id, "Admin Notified", ticket.action_taken or "")
        return f"Pipeline execution for Ticket #{ticket_id} verified and sealed cleanly."
    finally:
        db.close()