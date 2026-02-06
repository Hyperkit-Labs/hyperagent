"""MLflow integration for build tracking and observability"""

import logging
from typing import Any, Dict, Optional, List

from hyperagent.billing.cost_estimator import CostEstimator
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class MLflowTracker:
    """Tracks all builds in MLflow and exports to Prometheus"""

    def __init__(self):
        """Initialize MLflow Tracker"""
        self._mlflow_client = None
        self._run_id: Optional[str] = None
        self.cost_estimator = CostEstimator()

    def _get_mlflow_client(self):
        """Lazy initialization of MLflow client"""
        if self._mlflow_client is None:
            try:
                import mlflow

                mlflow_uri = getattr(settings, "mlflow_tracking_uri", None) or "http://mlflow:5000"
                mlflow.set_tracking_uri(mlflow_uri)
                self._mlflow_client = mlflow
            except ImportError:
                logger.warning("mlflow package not installed. Install with: pip install mlflow")
                return None
            except Exception as e:
                logger.warning(f"Failed to initialize MLflow: {e}")
                return None

        return self._mlflow_client

    async def log_build(
        self,
        build_id: str,
        prompt: str,
        chain: str,
        model_used: str,
        metrics: Dict[str, Any],
    ):
        """
        Log build to MLflow with cost tracking and profit metrics

        Args:
            build_id: Build identifier
            prompt: User prompt
            chain: Target blockchain
            model_used: LLM model used
            metrics: Build metrics (latency, credits, audit findings, success, 
                     input_tokens, output_tokens, revenue_usdc)
        """
        mlflow = self._get_mlflow_client()
        if not mlflow:
            logger.warning("MLflow not available, skipping build logging")
            return

        try:
            with mlflow.start_run(run_name=f"build_{build_id}"):
                mlflow.set_tag("build_id", build_id)
                mlflow.set_tag("chain", chain)
                mlflow.set_tag("model", model_used)

                mlflow.log_param("prompt", prompt[:500])
                mlflow.log_param("prompt_length", len(prompt))
                mlflow.log_param("chain", chain)
                mlflow.log_param("model_used", model_used)

                mlflow.log_metric("latency_seconds", metrics.get("latency", 0))
                mlflow.log_metric("credits_used", metrics.get("credits", 0))
                mlflow.log_metric("audit_findings_count", len(metrics.get("audit_findings", [])))
                mlflow.log_metric("success", 1 if metrics.get("success") else 0)

                if metrics.get("gas_used"):
                    mlflow.log_metric("gas_used", metrics["gas_used"])

                if metrics.get("risk_score"):
                    mlflow.log_metric("risk_score", metrics["risk_score"])

                input_tokens = metrics.get("input_tokens", 0)
                output_tokens = metrics.get("output_tokens", 0)
                
                if input_tokens or output_tokens:
                    split_data = self.cost_estimator.calculate_token_split(
                        model=model_used,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens
                    )
                    
                    mlflow.log_metric("input_tokens", split_data["input_tokens"])
                    mlflow.log_metric("output_tokens", split_data["output_tokens"])
                    mlflow.log_metric("total_tokens", split_data["total_tokens"])
                    mlflow.log_metric("input_percentage", split_data["input_percentage"])
                    mlflow.log_metric("output_percentage", split_data["output_percentage"])
                    mlflow.log_metric("context_cost_usd", split_data["cost_breakdown"]["context_cost"])
                    mlflow.log_metric("generation_cost_usd", split_data["cost_breakdown"]["generation_cost"])
                    mlflow.log_metric("cost_usd", split_data["total_cost_usd"])
                    
                    credits = int(split_data["total_cost_usd"] / self.cost_estimator.credit_rate)
                    mlflow.log_metric("credits_burned", credits)
                    
                    revenue_usdc = metrics.get("revenue_usdc", 0)
                    if revenue_usdc > 0:
                        profit_data = self.cost_estimator.calculate_profit(
                            revenue_usdc=revenue_usdc,
                            actual_cost_usd=split_data["total_cost_usd"]
                        )
                        
                        mlflow.log_metric("revenue_usdc", profit_data["revenue_usdc"])
                        mlflow.log_metric("profit_usd", profit_data["profit_usd"])
                        mlflow.log_metric("profit_margin_percent", profit_data["profit_margin_percent"])
                        
                        logger.info(
                            f"Build {build_id} profit: ${profit_data['profit_usd']:.4f} "
                            f"({profit_data['profit_margin_percent']:.1f}% margin) "
                            f"| Token split: {split_data['input_percentage']:.1f}% input / "
                            f"{split_data['output_percentage']:.1f}% output"
                        )

                self._run_id = mlflow.active_run().info.run_id
                logger.info(f"Logged build {build_id} to MLflow: {self._run_id}")

        except Exception as e:
            logger.error(f"Failed to log build to MLflow: {e}", exc_info=True)

    async def export_to_prometheus(self, build_id: str, metrics: Dict[str, Any]):
        """Export metrics to Prometheus"""
        try:
            from hyperagent.monitoring.metrics import (
                build_completed,
                build_duration,
                build_credits_used,
            )

            build_completed.labels(
                chain=metrics.get("chain", "unknown"),
                status="success" if metrics.get("success") else "failed",
            ).inc()

            if metrics.get("latency"):
                build_duration.labels(chain=metrics.get("chain", "unknown")).observe(
                    metrics["latency"]
                )

            if metrics.get("credits"):
                build_credits_used.labels(
                    model=metrics.get("model", "unknown")
                ).inc(metrics["credits"])

        except Exception as e:
            logger.error(f"Failed to export to Prometheus: {e}")

    async def query_builds(
        self,
        build_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Query builds from MLflow

        Args:
            build_id: Optional build ID filter
            user_id: Optional user ID filter
            status: Optional status filter
            limit: Maximum results

        Returns:
            List of build dictionaries
        """
        mlflow = self._get_mlflow_client()
        if not mlflow:
            return []

        try:
            from mlflow.tracking import MlflowClient

            client = MlflowClient()
            filter_string = ""
            if build_id:
                filter_string += f"tags.build_id = '{build_id}'"
            if status:
                if filter_string:
                    filter_string += " AND "
                filter_string += f"tags.status = '{status}'"

            runs = client.search_runs(
                experiment_ids=["0"],
                filter_string=filter_string if filter_string else None,
                max_results=limit,
            )

            results = []
            for run in runs:
                results.append(
                    {
                        "build_id": run.data.tags.get("build_id"),
                        "chain": run.data.tags.get("chain"),
                        "model": run.data.tags.get("model"),
                        "latency": run.data.metrics.get("latency_seconds", 0),
                        "credits": run.data.metrics.get("credits_used", 0),
                        "success": run.data.metrics.get("success", 0) == 1,
                        "timestamp": run.info.start_time,
                    }
                )

            return results

        except Exception as e:
            logger.error(f"Failed to query builds from MLflow: {e}")
            return []

