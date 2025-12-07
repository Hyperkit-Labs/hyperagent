"""Alith SDK client wrapper"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AlithError(Exception):
    """Alith SDK error"""

    pass


class AlithClient:
    """
    Alith SDK Client

    Concept: Wrapper for Alith SDK integration
    Logic: Provides interface to Alith agent framework
    Usage: Initialize agents, execute AI operations
    Benefits: Decentralized AI, optional TEE support, high-performance inference

    Documentation: https://alith.lazai.network/docs/get-started
    Installation: pip install alith -U

    Note:
    - Alith SDK does not require an API key
    - TEE (Trusted Execution Environment) is optional and provides secure execution
      for sensitive operations but is not required for basic agent functionality
    """

    def __init__(self):
        self._agents: Dict[str, Any] = {}  # Agent pool for reuse
        self._initialized = False
        self.sdk_available = False
        self.Agent = None
        self.LLM = None
        self.TEE = None
        self.tee = None

        # Initialize Alith SDK (no API key needed)
        try:
            from alith import LLM, TEE, Agent

            self.sdk_available = True
            self.Agent = Agent
            self.LLM = LLM
            self.TEE = TEE

            # TEE is optional - try to initialize, continue without if unavailable
            try:
                self.tee = TEE()
                logger.info("Alith SDK initialized with TEE support")
            except Exception as tee_error:
                logger.info(f"TEE not available: {tee_error}. Continuing without TEE.")
                self.tee = None

            logger.info("Alith SDK initialized successfully")
        except ImportError:
            self.sdk_available = False
            logger.error(
                "Alith SDK not available. Install with: pip install alith -U. "
                "Alith features will not work without the SDK."
            )
        except Exception as e:
            self.sdk_available = False
            logger.error(f"Alith SDK initialization failed: {e}. Alith features will not work.")

    def _select_model(self) -> str:
        """
        Auto-select model: Gemini first, OpenAI fallback

        Concept: Smart model selection based on available API keys
        Logic: Check Gemini first (default), fallback to OpenAI
        """
        from hyperagent.core.config import settings

        if settings.gemini_api_key:
            return "gemini-pro"
        elif settings.openai_api_key:
            return "gpt-4"
        else:
            raise ValueError(
                "No LLM API key configured (GEMINI_API_KEY or OPENAI_API_KEY required)"
            )

    async def initialize_agent(
        self,
        name: str,
        model: Optional[str] = None,
        tools: Optional[list] = None,
        preamble: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initialize Alith agent

        Concept: Create AI agent instance with specific model
        Logic:
            1. Auto-select model if not provided (Gemini-first, OpenAI fallback)
            2. Create agent configuration
            3. Initialize agent instance
            4. Store in agent pool
            5. Return agent handle

        Args:
            name: Agent identifier
            model: LLM model to use (gpt-4, gemini-pro, etc.). If None, auto-selects.
            tools: List of tools available to agent
            preamble: System prompt/preamble for agent behavior

        Returns:
            Agent configuration and ID
        """
        try:
            # Check if agent already exists in pool
            if name in self._agents:
                logger.info(f"Reusing existing agent: {name}")
                return {
                    "status": "reused",
                    "agent_name": name,
                    "agent_id": self._agents[name].get("agent_id"),
                }

            # Auto-select model if not provided
            if model is None:
                model = self._select_model()
                logger.info(f"Auto-selected model: {model} for agent: {name}")

            # Use actual SDK if available
            if self.sdk_available:
                # Create agent with Alith SDK
                default_preamble = (
                    preamble or f"You are a {name} agent for smart contract operations."
                )

                agent = self.Agent(model=model, preamble=default_preamble, tools=tools or [])

                agent_id = f"agent_{name}_{uuid.uuid4().hex[:8]}"
                self._agents[name] = {
                    "agent": agent,
                    "agent_id": agent_id,
                    "model": model,
                    "tools": tools or [],
                    "preamble": default_preamble,
                    "initialized_at": datetime.now(),
                }

                logger.info(f"Initialized Alith agent: {name} (ID: {agent_id}) with model: {model}")

                return {
                    "status": "initialized",
                    "agent_name": name,
                    "model": model,
                    "agent_id": agent_id,
                    "tools": tools or [],
                    "sdk_available": True,
                }
            else:
                # SDK not available - raise error instead of fallback
                raise AlithError(
                    f"Alith SDK not available. Cannot initialize agent '{name}'. "
                    "Install with: pip install alith -U"
                )
        except Exception as e:
            logger.error(f"Failed to initialize Alith agent {name}: {e}", exc_info=True)
            raise AlithError(f"Failed to initialize agent: {e}")

    async def execute_agent(
        self, agent_name: str, prompt: str, context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Execute agent with prompt

        Concept: Run AI agent with given prompt and context
        Logic:
            1. Get agent from pool (or initialize if needed)
            2. Execute agent with prompt
            3. Return response

        Args:
            agent_name: Name of agent to execute
            prompt: Input prompt for agent
            context: Additional context (contract code, audit results, etc.)

        Returns:
            Agent response string
        """
        # Check if agent exists
        if agent_name not in self._agents:
            logger.warning(f"Agent {agent_name} not found, initializing...")
            await self.initialize_agent(agent_name)

        try:
            # Use actual SDK if available
            if self.sdk_available and self._agents[agent_name].get("agent"):
                agent = self._agents[agent_name]["agent"]

                # Build full prompt with context if provided
                full_prompt = prompt
                if context:
                    context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
                    full_prompt = f"{prompt}\n\nContext:\n{context_str}"

                # Execute agent
                response = agent.prompt(full_prompt)

                logger.info(
                    f"Agent {agent_name} executed successfully (response length: {len(str(response))})"
                )
                return str(response)
            else:
                # SDK not available - raise error
                raise AlithError(
                    f"Alith SDK not available. Cannot execute agent '{agent_name}'. "
                    "Install with: pip install alith -U"
                )

        except Exception as e:
            logger.error(f"Failed to execute agent {agent_name}: {e}", exc_info=True)
            raise AlithError(f"Agent execution failed: {e}")

    async def stop_agent(self, agent_name: str) -> bool:
        """
        Stop and remove agent from pool

        Concept: Clean up agent resources
        Logic:
            1. Stop agent execution
            2. Remove from pool
            3. Clean up resources
        """
        if agent_name in self._agents:
            # SDK agents may have cleanup methods
            # if self.sdk_available and hasattr(self._agents[agent_name].get("agent"), "stop"):
            #     await self._agents[agent_name]["agent"].stop()

            del self._agents[agent_name]
            logger.info(f"Stopped agent: {agent_name}")
            return True
        return False

    def list_agents(self) -> list:
        """List all initialized agents"""
        return list(self._agents.keys())

    def is_sdk_available(self) -> bool:
        """Check if Alith SDK is available"""
        return self.sdk_available

    async def execute_agent_with_tools(
        self,
        agent_name: str,
        prompt: str,
        tools: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None,
        tool_handler: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute agent with tool calling support

        Concept: Run AI agent with tools that can be autonomously called
        Logic:
            1. Get agent from pool (or initialize if needed)
            2. Execute agent with tools using prompt_with_tools
            3. Execute any tool calls made by agent
            4. Return response and tool execution results

        Args:
            agent_name: Name of agent to execute
            prompt: Input prompt for agent
            tools: List of tool definitions (from alith_tools.get_deployment_tools())
            context: Additional context (contract code, audit results, etc.)
            tool_handler: Optional AlithToolHandler for executing tools

        Returns:
            {
                "response": "Agent's text response",
                "tool_calls": [...],  # Tools agent decided to call
                "tool_results": [...],  # Results from tool execution
                "success": True/False
            }
        """
        # Check if agent exists
        if agent_name not in self._agents:
            logger.warning(f"Agent {agent_name} not found, initializing...")
            await self.initialize_agent(agent_name)

        try:
            if self.sdk_available and self._agents[agent_name].get("agent"):
                agent = self._agents[agent_name]["agent"]

                # Build full prompt with context if provided
                full_prompt = prompt
                if context:
                    context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
                    full_prompt = f"{prompt}\n\nContext:\n{context_str}"

                # Use prompt_with_tools if available
                if hasattr(agent, "prompt_with_tools"):
                    response = agent.prompt_with_tools(full_prompt, tools=tools)

                    # Execute tools if handler provided
                    tool_results = []
                    if tool_handler and hasattr(response, "tool_calls"):
                        for tool_call in getattr(response, "tool_calls", []):
                            tool_name = tool_call.get("name")
                            tool_params = tool_call.get("parameters", {})
                            result = await tool_handler.execute_tool(tool_name, tool_params)
                            tool_results.append(
                                {"tool": tool_name, "parameters": tool_params, "result": result}
                            )

                    return {
                        "response": (
                            str(response.text) if hasattr(response, "text") else str(response)
                        ),
                        "tool_calls": getattr(response, "tool_calls", []),
                        "tool_results": tool_results,
                        "success": True,
                    }
                else:
                    # Fallback to regular prompt if prompt_with_tools not available
                    logger.warning("prompt_with_tools not available, using regular prompt")
                    response = agent.prompt(full_prompt)
                    return {
                        "response": str(response),
                        "tool_calls": [],
                        "tool_results": [],
                        "success": True,
                    }
            else:
                # SDK not available - raise error
                raise AlithError(
                    f"Alith SDK not available. Cannot execute agent '{agent_name}' with tools. "
                    "Install with: pip install alith -U"
                )
        except Exception as e:
            logger.error(f"Failed to execute agent {agent_name} with tools: {e}", exc_info=True)
            raise AlithError(f"Agent execution with tools failed: {e}")

    async def initialize_web3_agent(
        self,
        name: str,
        network: str,
        private_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initialize agent with Web3 capabilities

        Concept: Create agent with built-in Web3 integration
        Logic:
            1. Initialize agent with Web3 configuration
            2. Enable wallet management, transaction sending, contract interaction
            3. Store in agent pool

        Args:
            name: Agent identifier
            network: Target blockchain network
            private_key: Optional private key for transactions
            model: LLM model (auto-selected if not provided)

        Returns:
            Agent configuration with Web3 capabilities
        """
        try:
            if name in self._agents:
                logger.info(f"Reusing existing Web3 agent: {name}")
                return {
                    "status": "reused",
                    "agent_name": name,
                    "agent_id": self._agents[name].get("agent_id"),
                }

            # Auto-select model if not provided
            if model is None:
                model = self._select_model()

            if self.sdk_available:
                from hyperagent.core.config import settings

                default_preamble = (
                    f"You are a {name} Web3 agent for blockchain operations on {network}."
                )

                # Initialize agent with Web3 config if Alith supports it
                # Note: Actual implementation depends on Alith SDK's Web3 API
                agent_config = {"model": model, "preamble": default_preamble}

                # Add Web3 configuration if Alith SDK supports it
                # This is a placeholder - actual API may differ
                if hasattr(self.Agent, "__init__"):
                    # Try to initialize with Web3 config
                    try:
                        agent = self.Agent(
                            model=model,
                            preamble=default_preamble,
                            web3_config=(
                                {
                                    "network": network,
                                    "private_key": private_key or settings.private_key,
                                }
                                if hasattr(self.Agent, "__init__")
                                else None
                            ),
                        )
                    except TypeError:
                        # Fallback if Web3 config not supported
                        agent = self.Agent(model=model, preamble=default_preamble)
                else:
                    agent = self.Agent(model=model, preamble=default_preamble)

                agent_id = f"web3_agent_{name}_{uuid.uuid4().hex[:8]}"
                self._agents[name] = {
                    "agent": agent,
                    "agent_id": agent_id,
                    "model": model,
                    "network": network,
                    "web3_enabled": True,
                    "initialized_at": datetime.now(),
                }

                logger.info(f"Initialized Web3 agent: {name} (ID: {agent_id}) on {network}")

                return {
                    "status": "initialized",
                    "agent_name": name,
                    "model": model,
                    "network": network,
                    "agent_id": agent_id,
                    "web3_enabled": True,
                }
            else:
                # SDK not available - raise error
                raise AlithError(
                    f"Alith SDK not available. Cannot initialize Web3 agent '{name}'. "
                    "Install with: pip install alith -U"
                )
        except Exception as e:
            logger.error(f"Failed to initialize Web3 agent {name}: {e}", exc_info=True)
            raise AlithError(f"Failed to initialize Web3 agent: {e}")

    async def orchestrate_workflow(
        self, workflow_steps: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Orchestrate multi-agent workflow

        Concept: Coordinate multiple agents with task dependencies
        Logic:
            1. Execute agents in dependency order
            2. Pass results between agents
            3. Support parallel execution where possible
            4. Return final workflow result

        Args:
            workflow_steps: List of workflow steps
                [
                    {
                        "agent": "contract_generator",
                        "task": "Generate ERC20 contract",
                        "depends_on": [],
                        "prompt": "...",
                        "parallel": False
                    },
                    {
                        "agent": "auditor",
                        "task": "Audit contract",
                        "depends_on": ["contract_generator"],
                        "prompt": "...",
                        "parallel": False
                    }
                ]
            context: Initial context for workflow

        Returns:
            {
                "status": "completed" | "failed",
                "results": {...},  # Results from each step
                "final_result": {...}
            }
        """
        try:
            results = {}
            workflow_context = context or {}

            # Build dependency graph
            completed_tasks = set()

            while len(completed_tasks) < len(workflow_steps):
                # Find tasks ready to execute (dependencies met)
                ready_tasks = [
                    step
                    for step in workflow_steps
                    if step["task"] not in completed_tasks
                    and all(dep in completed_tasks for dep in step.get("depends_on", []))
                ]

                if not ready_tasks:
                    # Circular dependency or missing dependency
                    remaining = [
                        s["task"] for s in workflow_steps if s["task"] not in completed_tasks
                    ]
                    raise AlithError(f"Workflow stuck: dependencies not met for {remaining}")

                # Execute ready tasks (parallel if possible)
                tasks_to_run = [t for t in ready_tasks if not t.get("parallel", False)]
                parallel_tasks = [t for t in ready_tasks if t.get("parallel", False)]

                # Execute sequential tasks
                for step in tasks_to_run:
                    agent_name = step.get("agent")
                    prompt = step.get("prompt", "")
                    task_name = step.get("task")

                    # Add context from previous steps
                    full_prompt = prompt
                    if workflow_context:
                        context_str = "\n".join([f"{k}: {v}" for k, v in workflow_context.items()])
                        full_prompt = f"{prompt}\n\nContext from previous steps:\n{context_str}"

                    result = await self.execute_agent(agent_name, full_prompt, workflow_context)
                    results[task_name] = result
                    workflow_context[task_name] = result
                    completed_tasks.add(task_name)

                    logger.info(f"Completed workflow step: {task_name}")

                # Execute parallel tasks
                if parallel_tasks:
                    parallel_results = await asyncio.gather(
                        *[
                            self.execute_agent(
                                step.get("agent"), step.get("prompt", ""), workflow_context
                            )
                            for step in parallel_tasks
                        ],
                        return_exceptions=True,
                    )

                    for step, result in zip(parallel_tasks, parallel_results):
                        task_name = step.get("task")
                        if isinstance(result, Exception):
                            results[task_name] = {"error": str(result)}
                        else:
                            results[task_name] = result
                            workflow_context[task_name] = result
                        completed_tasks.add(task_name)
                        logger.info(f"Completed parallel workflow step: {task_name}")

            return {"status": "completed", "results": results, "final_result": workflow_context}
        except Exception as e:
            logger.error(f"Workflow orchestration failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "results": results if "results" in locals() else {},
            }
