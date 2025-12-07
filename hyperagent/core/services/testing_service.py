"""Testing service implementation"""

from typing import Any, Dict

from hyperagent.agents.testing import TestingAgent
from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.llm.provider import LLMProvider


class TestingService(ServiceInterface):
    """Contract compilation and testing service"""

    def __init__(self, testing_agent: TestingAgent):
        self.testing_agent = testing_agent

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Compile and test contract"""
        return await self.testing_agent.process(input_data)

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input has contract code"""
        return await self.testing_agent.validate(data)

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        await self.testing_agent.on_error(error)
