import os
import json
import asyncio
from pathlib import Path
import time
from datetime import datetime, timezone
from fastapi import FastAPI, status, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from typing import List
from logger_service import sys_logger
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis
from pydantic import AliasChoices, BaseModel, Field
from groq import Groq
import chromadb
from dotenv import load_dotenv
from worker import celery_app
from embeddings_service import encoder
from celery import chain
import worker as tasks
from gaurd_service import guard_firewall
from services.ai_agent import (
    analyze_ticket,
    generate_reply
)
from services.email_service import send_email

from sqlalchemy import func, text
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from fastapi.middleware.cors import CORSMiddleware
from config import settings

# Auto-create tables in database on startup
models.Base.metadata.create_all(bind=engine)

BASE_DIR = Path(__file__).resolve().parent

# Load local .env configurations from this app folder, regardless of where uvicorn is run.
load_dotenv(BASE_DIR / ".env")

app = FastAPI(
    title="Enterprise AI Ticket Automation Platform",
    version="1.0.0",
    # Hide interactive docs if running explicitly in an active production cloud setting
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None
)

# ─── HARDENED SECURITY SHIELD CONFIGURATION ──────────────────────────────────
# Restricts inbound API cross-origin fetch requests strictly to authorized frontend domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"], # Lock down to explicit required HTTP verbs
    allow_headers=["Content-Type", "Authorization"],
)

@app.middleware("http")
async def audit_api_performance_layer(request: Request, call_next):
    """
    Asynchronously intercepts every single inbound cloud route request,
    calculates exact database/network latency speeds, and outputs metrics in JSON.
    """
    start_time = time.time()
    
    # Let the request pass down the pipeline routing channels smoothly
    response = await call_next(request)
    
    execution_duration_ms = round((time.time() - start_time) * 1000, 2)
    
    # Package context telemetry to slide effortlessly into our structured logger
    sys_logger.info(
        f"API Request Finalized: {request.method} {request.url.path} -> Status {response.status_code}",
        extra={"extra_context": {
            "http_method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": execution_duration_ms,
            "client_ip": request.client.host if request.client else "unknown"
        }}
    )
    
    return response

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 1. Initialize Clients securely via Environment Variables
chroma_client = chromadb.Client()

def get_groq_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to ai-ticket-api/.env or set it in your terminal before starting uvicorn."
        )
    return Groq(api_key=api_key)

# 2. Setup Vector Database (RAG Layer)
collection = chroma_client.get_or_create_collection(name="ticket_knowledge")

# Seed the vector database with company policy on startup
with open(BASE_DIR / "company_policy.txt", "r") as f:
    policy_text = f.read()

chunks = [chunk.strip() for chunk in policy_text.split("\n\n") if chunk.strip()]
collection.add(
    documents=chunks,
    ids=[f"policy_chunk_{i}" for i in range(len(chunks))]
)

# 3. Define the Incoming Request Schema
class Ticket(BaseModel):
    sender: str
    subject: str
    message: str

class TicketCreate(BaseModel):
    sender: str
    subject: str
    body: str = Field(validation_alias=AliasChoices("body", "summary"))
    attachment_url: str | None = None

class OverrideRequest(BaseModel):
    manual_action: str

# 4. Define Agentic Execution Tools (The Python "Hands")
def lookup_refund_eligibility(user_email: str) -> str:
    """Looks up if a user is eligible for a refund based on internal corporate tracking logs."""
    if "btech" in user_email.lower() or "vikas" in user_email.lower():
        return "DENIED: System logs verify that B.Tech training keys have already been activated for this account."
    return "APPROVED: Account within the standard 14-day window. No keys activated."

def trigger_account_audit(user_email: str, issue_description: str) -> str:
    """Flags a user account for a manual backend system technical or security audit."""
    return f"SUCCESS: Technical incident token generated for {user_email}. Issue registered: '{issue_description}'."

# 5. Define the Groq Tool Schemas (The Blueprint for Llama 3)
tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "lookup_refund_eligibility",
            "description": "Use this tool when a customer explicitly requests a refund or money back for a purchase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {
                        "type": "string",
                        "description": "The email address of the customer making the request."
                    }
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
                    "user_email": {
                        "type": "string",
                        "description": "The customer email address."
                    },
                    "issue_description": {
                        "type": "string",
                        "description": "A brief technical summary of the system failure or crash."
                    }
                },
                "required": ["user_email", "issue_description"]
            }
        }
    }
]

@app.get("/")
def home():
    return {"message": "AI Agentic RAG Ticket API Running"}

@app.post("/analyze-ticket", status_code=202)
def analyze_ticket_async(ticket: Ticket):
    """
    Accepts the customer ticket data instantly, offloads it to the 
    Redis queue for Celery to process, and returns a tracking token immediately.
    """
    try:
        # Convert our Pydantic model into a serializable standard Python dictionary
        ticket_payload = {
            "sender": ticket.sender,
            "subject": ticket.subject,
            "message": ticket.message
        }
        
        # OBLITERATE THE BOTTLENECK: Offload the task to Redis using Celery's .delay() method
        # This execution takes less than 5 milliseconds!
        task = celery_app.send_task("tasks.process_ticket_async", args=[ticket_payload])
        
        # Hand back an instant 202 Accepted response along with the tracking identifier
        return {
            "status": "Queued",
            "message": "Ticket successfully offloaded to background execution queue.",
            "task_id": task.id
        }
        
    except Exception as e:
        return {
            "status": "Queue Error",
            "message": f"Failed to push task into background broker: {str(e)}"
        }

@app.get("/tickets")
def get_tickets(db: Session = Depends(get_db)):
    """Fetches every single support ticket record resting inside the cloud database."""
    tickets = db.query(models.Ticket).order_by(models.Ticket.created_at.desc()).all()
    
    # Query comment counts in bulk in a single query
    comment_counts = dict(
        db.query(models.TicketComment.ticket_id, func.count(models.TicketComment.id))
        .group_by(models.TicketComment.ticket_id)
        .all()
    )
    
    result = []
    for t in tickets:
        t_dict = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        t_dict["comment_count"] = comment_counts.get(t.id, 0)
        result.append(t_dict)
    return result


@app.post("/tickets")
def ingest_customer_ticket(ticket_data: TicketCreate, db: Session = Depends(get_db)):
    # --- GATE 1: INPUT FIREWALL SECURITY GUARDRAIL (Day 18 Security) ---
    if not guard_firewall.verify_input(ticket_data.body) or not guard_firewall.verify_input(ticket_data.subject):
        raise HTTPException(
            status_code=400,
            detail="Security Violation: Malicious payload input signature or prompt injection sequence detected."
        )

    # 1. Fetch the workspace admin account tracking row from user_roles
    # (For testing, we grab the first admin profile in the workspace)
    admin_quota = db.query(models.UserRole).filter(models.UserRole.role == "admin").first()

    if not admin_quota:
        raise HTTPException(
            status_code=500,
            detail="System Configuration Error: No administrative workspace quota account found."
        )

    # 2. THE METRIC GUARDRAIL: Block the ticket if a Free Tier quota is breached
    if admin_quota.subscription_tier == "free" and admin_quota.tickets_processed >= 10:
        # Halt execution and return a clean 402 Payment Required status code
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Usage Quota Exceeded: This workspace has reached its free limit of 10 autonomous triages. Upgrade to Premium required."
        )

    # 3. Instantly commit a baseline skeleton ticket record to the database so the user gets a 200 OK
    new_ticket = models.Ticket(
        sender=ticket_data.sender,
        subject=ticket_data.subject,
        description=ticket_data.body,
        summary="Queued",
        urgency="Queued",  # Starting state status
        department="Operations",
        action_taken="Worker allocation pending...",
        attachment_url=ticket_data.attachment_url
    )
    db.add(new_ticket)

    # COUNTER INCREMENT: Bump the tickets_processed counter inside user_roles by 1!
    admin_quota.tickets_processed += 1

    db.commit()
    db.refresh(new_ticket)

    try:
        send_email(
            recipient=ticket_data.sender,
            subject=f"Ticket #{new_ticket.id} Received",
            body=f"""
Hello,

Your support ticket has been successfully received.

Ticket ID:
{new_ticket.id}

Subject:
{ticket_data.subject}

Current Status:
Open

Our support team will review your request shortly.

Regards,
AI Ticket Platform
"""
        )
    except Exception as e:
        print(
            f"Email notification failed: {e}"
        )

    # 4. TRIGGER THE ASYNC AGENTIC CHAIN WORKFLOW
    # We stitch our micro-tasks together. Task 1 passes its dict to Task 2, Task 2 to Task 3!
    agentic_pipeline = chain(
        tasks.step_1_match_knowledge.s(new_ticket.id),
        tasks.step_2_generate_resolution.s(),
        tasks.step_3_notify_admin.s()
    )
    
    # Fire the entire pipeline off our main thread straight into Redis!
    try:
        agentic_pipeline.apply_async()
    except Exception as celery_err:
        print(f"Failed to queue background agentic pipeline (is Redis running?): {celery_err}")

    # 5. Return the payload response instantly back to the frontend UI layout frame
    return {
        "status": "Success",
        "message": "Ticket safely queued. Agent multi-step automation workflow chain initialized in background.",
        "ticket_id": new_ticket.id
    }


@app.get("/tickets/user/{user_email}")
def get_user_tickets(user_email: str, db: Session = Depends(get_db)):
    """Fetches tickets submitted by a single user email."""
    normalized_email = user_email.strip().lower()
    tickets = (
        db.query(models.Ticket)
        .filter(func.lower(models.Ticket.sender) == normalized_email)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    
    # Query comment counts in bulk in a single query
    ticket_ids = [t.id for t in tickets]
    comment_counts = {}
    if ticket_ids:
        comment_counts = dict(
            db.query(models.TicketComment.ticket_id, func.count(models.TicketComment.id))
            .filter(models.TicketComment.ticket_id.in_(ticket_ids))
            .group_by(models.TicketComment.ticket_id)
            .all()
        )
        
    result = []
    for t in tickets:
        t_dict = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        t_dict["comment_count"] = comment_counts.get(t.id, 0)
        result.append(t_dict)
    return result



@app.get("/tickets/high")
def get_high_priority_tickets(db: Session = Depends(get_db)):
    """Fetches ONLY the tickets categorized under 'High' urgency status."""
    tickets = db.query(models.Ticket).filter(models.Ticket.urgency == "High").all()
    return tickets

@app.get("/tickets/billing")
def get_billing_tickets(db: Session = Depends(get_db)):
    """Fetches ONLY the tickets routed to the Billing department."""
    tickets = db.query(models.Ticket).filter(models.Ticket.department == "Billing").all()
    return tickets

@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Computes live aggregated system KPIs across the cloud database cluster."""
    total_count = db.query(models.Ticket).count()
    
    high_priority_count = db.query(models.Ticket).filter(
        models.Ticket.urgency == "High"
    ).count()

    return {
        "total_tickets": total_count,
        "high_priority_tickets": high_priority_count,
        "system_status": "Healthy" if total_count > 0 else "Empty"
    }


@app.get("/analytics/operations")
def get_operations_analytics(
    db: Session = Depends(get_db)
):
    all_tickets = db.query(models.Ticket).all()
    
    open_count = 0
    in_progress_count = 0
    resolved_count = 0
    closed_count = 0
    resolved_tickets = []
    
    for ticket in all_tickets:
        status = ticket.status
        if status == "Open":
            open_count += 1
        elif status == "In Progress":
            in_progress_count += 1
        elif status == "Resolved":
            resolved_count += 1
        elif status == "Closed":
            closed_count += 1
            
        if ticket.resolved_at is not None:
            resolved_tickets.append(ticket)

    total_resolution_hours = 0

    for ticket in resolved_tickets:
        resolved_at = ticket.resolved_at
        created_at = ticket.created_at
        if resolved_at.tzinfo is not None:
            resolved_at = resolved_at.replace(tzinfo=None)
        if created_at.tzinfo is not None:
            created_at = created_at.replace(tzinfo=None)
        duration = resolved_at - created_at
        total_resolution_hours += (
            duration.total_seconds() / 3600
        )

    average_resolution_hours = 0

    if len(resolved_tickets) > 0:
        average_resolution_hours = round(
            total_resolution_hours /
            len(resolved_tickets),
            2
        )

    department_stats = {}
    for ticket in all_tickets:
        department = ticket.department
        if department and department.strip() and department != "Unknown":
            department_stats[department] = department_stats.get(department, 0) + 1

    top_department = "None"
    if department_stats:
        top_department = max(department_stats, key=department_stats.get)

    urgency_stats = {}
    for ticket in all_tickets:
        urgency = ticket.urgency
        if urgency and urgency.strip() and urgency not in ("Unknown", "Queued", "Knowledge Matched", "LLM Drafting Complete", "Admin Notified"):
            urgency_stats[urgency] = urgency_stats.get(urgency, 0) + 1

    most_common_urgency = "None"
    if urgency_stats:
        most_common_urgency = max(urgency_stats, key=urgency_stats.get)

    today = datetime.now(timezone.utc).date()
    resolved_today = 0
    for ticket in resolved_tickets:
        if ticket.resolved_at and ticket.resolved_at.date() == today:
            resolved_today += 1

    resolved_this_week = 0
    for ticket in resolved_tickets:
        if not ticket.resolved_at:
            continue
        age_days = (today - ticket.resolved_at.date()).days
        if age_days <= 7:
            resolved_this_week += 1

    return {
        "open_tickets": open_count,
        "in_progress_tickets": in_progress_count,
        "resolved_tickets": resolved_count,
        "closed_tickets": closed_count,
        "avg_resolution_hours": average_resolution_hours,
        "top_department": top_department,
        "most_common_urgency": most_common_urgency,
        "resolved_today": resolved_today,
        "resolved_this_week": resolved_this_week
    }

@app.patch("/tickets/{ticket_id}/override")
def override_ticket_action(ticket_id: int, payload: OverrideRequest, db: Session = Depends(get_db)):
    """
    Locates an existing ticket row in Supabase by its unique ID
    and overwrites the autonomous AI text with a compliance-stamped human override directive.
    """
    # Query the PostgreSQL table for that specific record index
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    
    # If the manager passes a bunk ID number, exit out safely
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Target ticket record not found in system architecture.")
    
    # Apply the human text alongside a highly visible compliance marker
    db_ticket.action_taken = f"[MANUAL OVERRIDE BY MANAGER] {payload.manual_action}"
    
    # Commit the transaction to save it persistently inside Supabase cloud
    db.commit()
    db.refresh(db_ticket)
    
    return {
        "status": "Success",
        "message": f"Autonomous action for ticket #{ticket_id} has been permanently overridden.",
        "updated_action": db_ticket.action_taken
    }


class StatusUpdate(BaseModel):
    status: str

@app.patch("/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    new_status = payload.status
    old_status = ticket.status
    ticket.status = new_status

    if new_status == "Resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    elif new_status != "Resolved":
        ticket.resolved_at = None

    db.commit()
    db.refresh(ticket)

    try:
        if old_status != new_status:
            send_email(
                recipient=ticket.sender,
                subject=f"Ticket #{ticket.id} Status Updated",
                body=f"""
Hello,

Your support ticket status has changed.

Ticket ID:
{ticket.id}

Subject:
{ticket.subject}

Previous Status:
{old_status}

New Status:
{new_status}

You can log in to the portal to view additional details.

Regards,
AI Ticket Platform
"""
            )
    except Exception as e:
        print(
            f"Status update email failed: {e}"
        )

    try:
        if (
            new_status == "Resolved"
            and old_status != "Resolved"
        ):
            resolution_note = (
                ticket.resolution_note
                or "No resolution note provided."
            )
            send_email(
                recipient=ticket.sender,
                subject=f"Ticket #{ticket.id} Resolved",
                body=f"""
Hello,

Your support ticket has been resolved.

Ticket ID:
{ticket.id}

Subject:
{ticket.subject}

Resolution Details:

{resolution_note}

Thank you for contacting support.

Regards,
AI Ticket Platform
"""
            )
    except Exception as e:
        print(
            f"Resolution email failed: {e}"
        )

    return {
        "status": "Success",
        "message": f"Ticket #{ticket_id} status updated to {new_status}.",
        "ticket_status": ticket.status,
        "resolved_at": ticket.resolved_at
    }

@app.get("/api/v1/tickets/stream")
async def stream_ticket_events():
    """
    Persistent HTTP client highway endpoint. Natively yields text/event-stream 
    data tokens directly into the connected React view browser.
    """
    async def event_generator():
        # Open an asynchronous connection to the Redis broker
        async_redis = aioredis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        pubsub = async_redis.pubsub()
        
        try:
            try:
                await pubsub.subscribe("ticket_updates")
            except Exception as e:
                # Gracefully yield error packet to browser instead of throwing traceback
                yield f"data: {{\"error\": \"Failed to connect to Redis broker: {str(e)}\"}}\n\n"
                await asyncio.sleep(2.0)
                await async_redis.close()
                return

            while True:
                try:
                    # Listen endlessly for messages broadcasting down the channel pipes
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message:
                        data_packet = message["data"]
                        # SSE protocol demands a strict 'data: <payload>\n\n' format rule!
                        yield f"data: {data_packet}\n\n"
                except Exception as e:
                    yield f"data: {{\"error\": \"Redis connection interrupted: {str(e)}\"}}\n\n"
                    await asyncio.sleep(2.0)
                    try:
                        await pubsub.subscribe("ticket_updates")
                    except Exception:
                        pass
                # Keep the thread breathing space clear
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            # Safely tear down connections if a user closes their browser dashboard tab
            try:
                await pubsub.unsubscribe("ticket_updates")
                await async_redis.close()
            except Exception:
                pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/tickets/{ticket_id}/comments")
def get_comments(
    ticket_id: int,
    db: Session = Depends(get_db)
):

    comments = (
        db.query(models.TicketComment)
        .filter(
            models.TicketComment.ticket_id == ticket_id
        )
        .order_by(
            models.TicketComment.created_at.asc()
        )
        .all()
    )

    return comments


@app.post("/tickets/{ticket_id}/comments")
def create_comment(
    ticket_id: int,
    payload: dict,
    db: Session = Depends(get_db)
):

    comment = models.TicketComment(
        ticket_id=ticket_id,
        sender=payload.get("sender"),
        message=payload.get("message")
    )

    db.add(comment)

    db.commit()

    db.refresh(comment)

    return comment


@app.post("/tickets/{ticket_id}/suggest-reply")
def suggest_reply(
    ticket_id: int,
    db: Session = Depends(get_db)
):

    ticket = (
        db.query(models.Ticket)
        .filter(models.Ticket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    comments = (
        db.query(models.TicketComment)
        .filter(models.TicketComment.ticket_id == ticket_id)
        .order_by(models.TicketComment.created_at.asc())
        .all()
    )

    conversation_text = "\n".join(
        f"{c.sender}: {c.message}"
        for c in comments
    )

    ticket_text = f"""
Subject:
{ticket.subject}

Summary:
{ticket.summary}

Conversation:
{conversation_text}
"""

    suggestion = generate_reply(
        ticket_text,
        ticket.action_taken or ""
    )

    return {
        "reply": suggestion
    }



import httpx # For hitting embedding endpoints efficiently

class KnowledgeIngest(BaseModel):
    title: str
    content: str

@app.post("/knowledge/ingest")
def ingest_corporate_knowledge(data: KnowledgeIngest, db: Session = Depends(get_db)):
    """
    Generates real-time semantic embeddings on raw text strings and commits them to Supabase.
    """
    live_768_vector = encoder.get_vector(data.content)

    new_knowledge = models.KnowledgeBase(
        title=data.title,
        content=data.content,
        embedding=live_768_vector
    )
    db.add(new_knowledge)
    db.commit()
    db.refresh(new_knowledge)
    return {"status": "Success", "id": new_knowledge.id}

@app.get("/knowledge")
def get_knowledge(
    db: Session = Depends(get_db)
):
    knowledge_items = (
        db.query(
            models.KnowledgeBase.id,
            models.KnowledgeBase.title,
            models.KnowledgeBase.content
        )
        .all()
    )
    result = [
        {
            "id": item.id,
            "title": item.title,
            "content": item.content,
            "embedding": None
        }
        for item in knowledge_items
    ]
    return result

@app.delete("/knowledge/{knowledge_id}")
def delete_knowledge(
    knowledge_id: int,
    db: Session = Depends(get_db)
):

    knowledge = (
        db.query(models.KnowledgeBase)
        .filter(
            models.KnowledgeBase.id == knowledge_id
        )
        .first()
    )

    if not knowledge:
        raise HTTPException(
            status_code=404,
            detail="Knowledge article not found"
        )

    db.delete(knowledge)
    db.commit()

    return {
        "status": "Success",
        "message": "Knowledge article deleted"
    }


# ─── 1. THE WEBSOCKET CONNECTION POOL ENGINE ────────────────────────────
class CommandConsoleManager:
    def __init__(self):
        # Keeps an active track array list of all live connected admin socket channels
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📡 ADMIN TERMINAL LINKED: Active Consoles = {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"🔌 TERMINAL DISCONNECTED: Active Consoles = {len(self.active_connections)}")

    async def send_private_message(self, message: str, websocket: WebSocket):
        """Sends a direct message reply frame back to the specific admin who ran a command."""
        await websocket.send_text(message)

    async def broadcast_system_alert(self, message: str):
        """Broadcasts a terminal message alert out to every single connected admin view panel."""
        for connection in self.active_connections:
            await connection.send_text(message)

# Initialize our active socket pool manager singleton
console_manager = CommandConsoleManager()


# ─── 2. THE BI-DIRECTIONAL OVERRIDE WEBSOCKET ROUTE ─────────────────────
@app.websocket("/api/v1/ws/admin")
async def admin_override_socket_gateway(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    Full-duplex WebSocket gateway. Listens for live admin command strings, 
    executes rapid mutations, and streams frame updates back up the pipe instantly.
    """
    await console_manager.connect(websocket)
    
    try:
        # Keep the socket tunnel open endlessly listening for data frames
        while True:
            raw_data = await websocket.receive_text()
            print(f"📥 RAW COMMAND FRAME CAUGHT: {raw_data}")
            
            try:
                # Expecting incoming JSON frames like: {"command": "/override", "ticket_id": 1, "status": "Critical"}
                payload = json.loads(raw_data)
                command = payload.get("command")
                ticket_id = payload.get("ticket_id")
                new_status = payload.get("status")
                
                # PROCESS CRITICAL OVERRIDE ROUTINE
                if command == "/override" and ticket_id:
                    # Snatch the ticket straight out of the database, bypassing the queue lines
                    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
                    if ticket:
                        ticket.urgency = new_status
                        ticket.action_taken = f"[MANUAL ADMIN OVERRIDE EXECUTION]: Status hot-swapped over live WebSocket terminal connection."
                        db.commit()
                        
                        # Return success frame to the user instantly over the same socket connection
                        success_reply = json.dumps({
                            "type": "SUCCESS",
                            "message": f"System Hijack Complete. Ticket #{ticket_id} status forced to '{new_status}'."
                        })
                        await console_manager.send_private_message(success_reply, websocket)
                    else:
                        await console_manager.send_private_message(json.dumps({"type": "ERROR", "message": "Target Ticket ID not found."}), websocket)
                else:
                    await console_manager.send_private_message(json.dumps({"type": "ERROR", "message": "Unknown command syntax structure."}), websocket)
                    
            except Exception as inner_err:
                await websocket.send_text(json.dumps({"type": "ERROR", "message": f"Frame compilation failure: {str(inner_err)}"}))
                
    except WebSocketDisconnect:
        console_manager.disconnect(websocket)
