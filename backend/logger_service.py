import logging
import json
import time
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        """Transforms standard log metadata records into clean, indexable JSON tokens."""
        log_packet = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "module": record.module,
            "filename": record.filename,
            "line_number": record.lineno,
            "message": record.getMessage()
        }
        
        # Capture extra dynamic context payload variables passed into the logger call
        if hasattr(record, "extra_context"):
            log_packet["context"] = record.extra_context
            
        return json.dumps(log_packet)

def setup_production_logger():
    """Initializes and hardens the centralized JSON streaming engine channel handles."""
    logger = logging.getLogger("enterprise_saas")
    logger.setLevel(logging.INFO)
    
    # Prevent duplicate log handler stacking rules if initialized multiple times
    if not logger.handlers:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(JSONFormatter())
        logger.addHandler(console_handler)
        
    return logger

# Instant singleton instance ready for cross-module distribution
sys_logger = setup_production_logger()
