#!/usr/bin/env python3
"""
Production Deployment Script

⚠️  DEVELOPMENT ONLY - NOT FOR PRODUCTION USE ⚠️

This script is a development/testing tool for local deployment scenarios.
For production deployments, use:
- Render.com: See render.yaml and GUIDE/SIMPLIFIED_SETUP.md
- VPS: See scripts/start_production.sh
- Direct Python: uvicorn hyperagent.api.main:app

Concept: Automated deployment to production environment
Logic: Validate environment, run migrations, deploy services, verify health
Security: Checks for required secrets, validates configuration
"""
import os
import sys
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, List
import argparse

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class ProductionDeployment:
    """
    Production Deployment Manager
    
    Concept: Orchestrates production deployment process
    Logic: Pre-flight checks → Migrations → Deploy → Verify → Rollback if needed
    """
    
    def __init__(self, environment: str = "production"):
        self.environment = environment
        self.required_secrets = [
            "DATABASE_URL",
            "REDIS_URL",
            "GEMINI_API_KEY",
            "JWT_SECRET_KEY",
            "PRIVATE_KEY"
        ]
        self.required_services = ["postgres", "redis"]
    
    async def deploy(self) -> bool:
        """
        Execute full deployment process
        
        Returns:
            bool: True if deployment successful, False otherwise
        """
        print("[*] Starting production deployment...")
        
        try:
            # Step 1: Pre-flight checks
            if not await self._preflight_checks():
                print("[-] Pre-flight checks failed")
                return False
            
            # Step 2: Run database migrations
            if not await self._run_migrations():
                print("[-] Database migrations failed")
                return False
            
            # Step 3: Deploy application
            if not await self._deploy_application():
                print("[-] Application deployment failed")
                return False
            
            # Step 4: Verify deployment
            if not await self._verify_deployment():
                print("[-] Deployment verification failed")
                return False
            
            print("[+] Production deployment completed successfully")
            return True
            
        except Exception as e:
            print(f"[-] Deployment failed: {e}")
            await self._rollback()
            return False
    
    async def _preflight_checks(self) -> bool:
        """Validate environment and configuration"""
        print("[*] Running pre-flight checks...")
        
        # Check required secrets
        missing_secrets = []
        for secret in self.required_secrets:
            if not os.getenv(secret):
                missing_secrets.append(secret)
        
        if missing_secrets:
            print(f"[-] Missing required secrets: {', '.join(missing_secrets)}")
            return False
        
        # Check service connectivity
        for service in self.required_services:
            if not await self._check_service_health(service):
                print(f"[-] Service {service} is not healthy")
                return False
        
        # Check database connection
        try:
            from hyperagent.core.config import settings
            import asyncpg
            
            conn = await asyncpg.connect(settings.database_url)
            await conn.close()
            print("[+] Database connection verified")
        except Exception as e:
            print(f"[-] Database connection failed: {e}")
            return False
        
        # Check Redis connection
        try:
            import redis.asyncio as redis
            redis_client = await redis.from_url(os.getenv("REDIS_URL"))
            await redis_client.ping()
            await redis_client.close()
            print("[+] Redis connection verified")
        except Exception as e:
            print(f"[-] Redis connection failed: {e}")
            return False
        
        print("[+] Pre-flight checks passed")
        return True
    
    async def _check_service_health(self, service: str) -> bool:
        """Check if service is healthy"""
        import aiohttp
        
        # Service-specific health check URLs
        health_checks = {
            "postgres": None,  # Checked via connection test
            "redis": None,     # Checked via connection test
            "hyperagent": os.getenv("HEALTH_CHECK_URL", "http://localhost:8000/api/v1/health"),
            "x402-verifier": "http://localhost:3002/health",
        }
        
        health_url = health_checks.get(service)
        if not health_url:
            # Database/Redis are checked via connection tests
            return True
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(health_url, timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("status") in ["healthy", "ok"]
                    return False
        except Exception as e:
            print(f"[-] Health check for {service} failed: {e}")
            return False
    
    async def _run_migrations(self) -> bool:
        """Run Alembic database migrations"""
        print("[*] Running database migrations...")
        
        try:
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                cwd=project_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print("[+] Database migrations completed")
                return True
            else:
                print(f"[-] Migration error: {result.stderr}")
                return False
        except Exception as e:
            print(f"[-] Migration failed: {e}")
            return False
    
    async def _deploy_application(self) -> bool:
        """Deploy application (Docker or direct)"""
        print("[*] Deploying application...")
        
        deployment_method = os.getenv("DEPLOYMENT_METHOD", "docker")
        
        if deployment_method == "docker":
            return await self._deploy_docker()
        else:
            return await self._deploy_direct()
    
    async def _deploy_docker(self) -> bool:
        """Deploy using Docker"""
        try:
            # Build Docker image
            print("[*] Building Docker image...")
            build_result = subprocess.run(
                ["docker", "build", "-t", "hyperagent:latest", "."],
                cwd=project_root,
                capture_output=True
            )
            
            if build_result.returncode != 0:
                print("[-] Docker build failed")
                return False
            
            # Deploy with docker-compose
            print("[*] Starting services with docker-compose...")
            deploy_result = subprocess.run(
                ["docker-compose", "up", "-d"],
                cwd=project_root,
                capture_output=True
            )
            
            if deploy_result.returncode == 0:
                print("[+] Docker deployment completed")
                return True
            else:
                print("[-] Docker deployment failed")
                return False
        except Exception as e:
            print(f"[-] Docker deployment error: {e}")
            return False
    
    async def _deploy_direct(self) -> bool:
        """Deploy directly (systemd, supervisor, etc.)"""
        print("[*] Direct deployment (systemd/supervisor)")
        print("[!] Direct deployment not implemented - use start_production.sh instead")
        print("[!] For production, see GUIDE/SIMPLIFIED_SETUP.md")
        return False
    
    async def _verify_deployment(self) -> bool:
        """Verify deployment is healthy"""
        print("[*] Verifying deployment...")
        
        import aiohttp
        
        health_url = os.getenv("HEALTH_CHECK_URL", "http://localhost:8000/api/v1/health")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(health_url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("status") == "healthy":
                            print("[+] Deployment verified - service is healthy")
                            return True
                        else:
                            print("[-] Service health check returned unhealthy status")
                            return False
                    else:
                        print(f"[-] Health check failed with status {response.status}")
                        return False
        except Exception as e:
            print(f"[-] Health check error: {e}")
            return False
    
    async def _rollback(self):
        """Rollback deployment if it fails"""
        print("[*] Rolling back deployment...")
        
        try:
            # Stop current deployment
            subprocess.run(
                ["docker-compose", "down"],
                cwd=project_root,
                capture_output=True
            )
            
            # Restore previous version if available
            previous_image = os.getenv("PREVIOUS_IMAGE_TAG")
            if previous_image:
                print(f"[*] Rolling back to previous image: {previous_image}")
                subprocess.run(
                    ["docker", "pull", previous_image],
                    cwd=project_root,
                    capture_output=True
                )
                subprocess.run(
                    ["docker-compose", "up", "-d"],
                    cwd=project_root,
                    capture_output=True
                )
            
            print("[!] Rollback completed")
        except Exception as e:
            print(f"[-] Rollback error: {e}")


async def main():
    """Main deployment entry point"""
    parser = argparse.ArgumentParser(description="Deploy HyperAgent to production")
    parser.add_argument(
        "--environment",
        default="production",
        choices=["production", "staging"],
        help="Deployment environment"
    )
    parser.add_argument(
        "--skip-checks",
        action="store_true",
        help="Skip pre-flight checks (not recommended)"
    )
    
    args = parser.parse_args()
    
    deployer = ProductionDeployment(environment=args.environment)
    
    if args.skip_checks:
        print("[!] WARNING: Skipping pre-flight checks")
    
    success = await deployer.deploy()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())

