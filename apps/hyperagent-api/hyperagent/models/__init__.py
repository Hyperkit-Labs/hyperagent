"""Database models"""

from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

from hyperagent.models.audit import SecurityAudit
from hyperagent.models.contract import GeneratedContract
from hyperagent.models.deployment import Deployment
from hyperagent.models.event_log import EventLog
from hyperagent.models.payment_history import PaymentHistory
from hyperagent.models.spending_control import SpendingControl
from hyperagent.models.template import ContractTemplate
from hyperagent.models.app_document import AppDocument

# Import all models here for Alembic autogenerate
from hyperagent.models.user import User
from hyperagent.models.workflow import Workflow
